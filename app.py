from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import requests
from flask import Flask, jsonify, request
from db import ClaimsStore, ClaimHistoryStore

app = Flask(__name__)

DB_PATH = os.getenv("DB_PATH", "claims.sqlite3")
claims = ClaimsStore(DB_PATH)
history = ClaimHistoryStore(DB_PATH)

SYNC_SECRET = os.getenv("SYNC_SECRET", "change-me")
FACTION_ID = str(os.getenv("FACTION_ID", "")).strip()
ADMIN_PLAYER_ID = str(os.getenv("ADMIN_PLAYER_ID", "")).strip()
TORN_API_BASE = os.getenv("TORN_API_BASE", "https://api.torn.com").rstrip("/")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "20"))
WARSTACK_MANAGER_IDS = {
    x.strip()
    for x in str(os.getenv("WARSTACK_MANAGER_IDS", "")).split(",")
    if x.strip()
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def corsify(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return resp


@app.after_request
def after_request(resp):
    return corsify(resp)


def ok_options():
    return corsify(jsonify({"ok": True}))


def check_secret(payload: dict[str, Any]) -> bool:
    return str((payload or {}).get("secret", "")).strip() == SYNC_SECRET


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_bool(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    text = str(value).strip().lower()
    return 1 if text in {"1", "true", "yes", "y", "on"} else 0


def parse_torn_key_info(data: dict[str, Any]) -> dict[str, str]:
    user_obj = data.get("user") or {}
    faction_obj = data.get("faction") or {}

    player_id = normalize_text(
        user_obj.get("id")
        or user_obj.get("player_id")
        or data.get("player_id")
    )
    player_name = normalize_text(
        user_obj.get("name")
        or user_obj.get("player_name")
        or data.get("player_name")
    )

    faction_id = normalize_text(
        user_obj.get("faction_id")
        or faction_obj.get("id")
        or data.get("faction_id")
    )
    faction_name = normalize_text(
        faction_obj.get("name")
        or data.get("faction_name")
    )

    return {
        "player_id": player_id,
        "player_name": player_name or (f"Player {player_id}" if player_id else ""),
        "faction_id": faction_id,
        "faction_name": faction_name,
    }


def torn_lookup_user(api_key: str) -> dict[str, Any] | None:
    if not api_key:
        return None
    url = f"{TORN_API_BASE}/v2/key/info"
    try:
        r = requests.get(
            url,
            headers={"Authorization": f"ApiKey {api_key}"},
            timeout=REQUEST_TIMEOUT,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def verify_admin_by_key(api_key@app.route("/api/warstack/state", methods=["POST", "OPTIONS"])
def warstack_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    state = build_warstack_state(user)
    return jsonify({
        "ok": True,
        "state": state,
        "warstack": state,
    })


@app.route("/api/warstack/set-state", methods=["POST", "OPTIONS"])
def warstack_set_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    if not user_can_manage_warstack(user):
        return json_error("only configured warstack managers may change this state", 403)

    enabled = normalize_bool(payload.get("enabled"))
    claims.set_warstack_state(
        enabled=enabled,
        updated_by=normalize_text(user.get("name")),
        updated_by_id=normalize_text(user.get("player_id")),
    )

    state = build_warstack_state(user)
    return jsonify({
        "ok": True,
        "state": state,
        "warstack": state,
    })


@app.route("/api/claims/history", methods=["POST", "OPTIONS"])
def claim_history():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    claim_id = normalize_text(payload.get("claim_id"))
    if claim_id:
        return jsonify({"ok": True, "history": history.list_history(claim_id)})

    limit = int(payload.get("limit", 100) or 100)
    return jsonify({"ok": True, "history": history.list_recent(limit=limit)})


@app.route("/api/claims/push", methods=["POST", "OPTIONS"])
def push_claim():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    action = normalize_text(payload.get("action"))
    auth = payload.get("auth") or {}
    claim = payload.get("claim") or {}
    claim_id = normalize_text(claim.get("id"))

    if not claim_id:
        return json_error("missing claim id", 400)

    existing = claims.get_claim(claim_id)
    clean = clean_claim_payload(claim, existing)

    if existing and normalize_bool(existing.get("locked")) and action not in {
        "admin_mark_read",
        "admin_mark_unread",
        "admin_mark_notified",
    }:
        return json_error("claim is locked", 403)

    if action == "member_submit":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        clean["member"] = user["name"]
        clean["memberId"] = user["player_id"]
        clean["status"] = "Pending review"
        clean["isRead"] = 0
        clean["isNotified"] = 0
        clean["notifiedAt"] = ""
        clean["reviewedBy"] = normalize_text(existing.get("reviewedBy")) if existing else ""
        clean["paidAt"] = normalize_text(existing.get("paidAt")) if existing else ""
        clean["completedAt"] = normalize_text(existing.get("completedAt")) if existing else ""
        clean["locked"] = normalize_bool(existing.get("locked")) if existing else 0

        claims.upsert_claim(clean)
        history.add_entry(
            claim_id,
            f'{user["name"]} [{user["player_id"]}] submitted claim as member. Status set to Pending review.'
        )
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "member_mark_read":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'{user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_update":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        allowed = {"Pending review", "Under review", "Approved", "Denied", "Paid"}
        if clean["status"] not in allowed:
            return json_error("invalid status", 400)

        clean["reviewedBy"] = user["name"]
        if clean["status"] == "Paid" and not clean["paidAt"]:
            clean["paidAt"] = now_iso()

        claims.upsert_claim(clean)

        msg = f'Admin {user["name"]} updated claim to {clean["status"]}.'
        if clean["decision"]:
            msg += f' Note: {clean["decision"]}.'
        if clean["payout"]:
            msg += f' Payout: {clean["payout"]}.'
        history.add_entry(claim_id, msg)

        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_complete":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        clean["status"] = "Paid"
        clean["reviewedBy"] = user["name"]
        clean["paidAt"] = clean["paidAt"] or now_iso()
        clean["completedAt"] = now_iso()
        clean["locked"] = 1

        claims.upsert_claim(clean)
        history.add_entry(claim_id, f'Admin {user["name"]} completed and locked claim as Paid.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_read":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_unread":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=False)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as unread.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_notified":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_notified(claim_id, is_notified=True, notified_at=now_iso())
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as notified.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    return json_error("invalid claim action", 400)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000"))) login failed", 403)

    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/faction-login", methods=["POST", "OPTIONS"])
def auth_faction_login():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    user, err = verify_faction_member(payload)
    if not user:
        return json_error(err or "faction login failed", 403)

    return jsonify({"ok": True, "user": user})


@app.route("/api/claims/pull", methods=["POST", "OPTIONS"])
def pull_claims():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    unread_only = normalize_bool(payload.get("unreadOnly"))
    member_id = normalize_text(payload.get("memberId"))
    status = normalize_text(payload.get("status"))

    data = claims.list_claims(
        unread_only=bool(unread_only),
        member_id=member_id or None,
        status=status or None,
    )
    return jsonify({"ok": True, "claims": data})


@app.route("/api/overview/financial-summary", methods=["POST", "OPTIONS"])
def overview_financial_summary():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    summary = claims.get_financial_summary()
    return jsonify({
        "ok": True,
        "summary": summary,
        "viewer": {
            "player_id": user["player_id"],
            "name": user["name"],
            "role": user["role"],
        },
    })



@app.route("/api/warstack/state", methods=["POST", "OPTIONS"])
def warstack_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    state = build_warstack_state(user)
    return jsonify({
        "ok": True,
        "state": state,
        "warstack": state,
    })


@app.route("/api/warstack/set-state", methods=["POST", "OPTIONS"])
def warstack_set_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    if not user_can_manage_warstack(user):
        return json_error("only configured warstack managers may change this state", 403)

    enabled = normalize_bool(payload.get("enabled"))
    claims.set_warstack_state(
        enabled=enabled,
        updated_by=normalize_text(user.get("name")),
        updated_by_id=normalize_text(user.get("player_id")),
    )

    state = build_warstack_state(user)
    return jsonify({
        "ok": True,
        "state": state,
        "warstack": state,
    })


@app.route("/api/claims/history", methods=["POST", "OPTIONS"])
def claim_history():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    claim_id = normalize_text(payload.get("claim_id"))
    if claim_id:
        return jsonify({"ok": True, "history": history.list_history(claim_id)})

    limit = int(payload.get("limit", 100) or 100)
    return jsonify({"ok": True, "history": history.list_recent(limit=limit)})


@app.route("/api/claims/push", methods=["POST", "OPTIONS"])
def push_claim():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    action = normalize_text(payload.get("action"))
    auth = payload.get("auth") or {}
    claim = payload.get("claim") or {}
    claim_id = normalize_text(claim.get("id"))

    if not claim_id:
        return json_error("missing claim id", 400)

    existing = claims.get_claim(claim_id)
    clean = clean_claim_payload(claim, existing)

    if existing and normalize_bool(existing.get("locked")) and action not in {
        "admin_mark_read",
        "admin_mark_unread",
        "admin_mark_notified",
    }:
        return json_error("claim is locked", 403)

    if action == "member_submit":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        clean["member"] = user["name"]
        clean["memberId"] = user["player_id"]
        clean["status"] = "Pending review"
        clean["isRead"] = 0
        clean["isNotified"] = 0
        clean["notifiedAt"] = ""
        clean["reviewedBy"] = normalize_text(existing.get("reviewedBy")) if existing else ""
        clean["paidAt"] = normalize_text(existing.get("paidAt")) if existing else ""
        clean["completedAt"] = normalize_text(existing.get("completedAt")) if existing else ""
        clean["locked"] = normalize_bool(existing.get("locked")) if existing else 0

        claims.upsert_claim(clean)
        history.add_entry(
            claim_id,
            f'{user["name"]} [{user["player_id"]}] submitted claim as member. Status set to Pending review.'
        )
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "member_mark_read":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'{user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_update":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        allowed = {"Pending review", "Under review", "Approved", "Denied", "Paid"}
        if clean["status"] not in allowed:
            return json_error("invalid status", 400)

        clean["reviewedBy"] = user["name"]
        if clean["status"] == "Paid" and not clean["paidAt"]:
            clean["paidAt"] = now_iso()

        claims.upsert_claim(clean)

        msg = f'Admin {user["name"]} updated claim to {clean["status"]}.'
        if clean["decision"]:
            msg += f' Note: {clean["decision"]}.'
        if clean["payout"]:
            msg += f' Payout: {clean["payout"]}.'
        history.add_entry(claim_id, msg)

        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_complete":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        clean["status"] = "Paid"
        clean["reviewedBy"] = user["name"]
        clean["paidAt"] = clean["paidAt"] or now_iso()
        clean["completedAt"] = now_iso()
        clean["locked"] = 1

        claims.upsert_claim(clean)
        history.add_entry(claim_id, f'Admin {user["name"]} completed and locked claim as Paid.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_read":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_unread":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=False)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as unread.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_notified":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_notified(claim_id, is_notified=True, notified_at=now_iso())
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as notified.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    return json_error("invalid claim action", 400)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000"))) login failed", 403)

    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/faction-login", methods=["POST", "OPTIONS"])
def auth_faction_login():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    user, err = verify_faction_member(payload)
    if not user:
        return json_error(err or "faction login failed", 403)

    return jsonify({"ok": True, "user": user})


@app.route("/api/claims/pull", methods=["POST", "OPTIONS"])
def pull_claims():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    unread_only = normalize_bool(payload.get("unreadOnly"))
    member_id = normalize_text(payload.get("memberId"))
    status = normalize_text(payload.get("status"))

    data = claims.list_claims(
        unread_only=bool(unread_only),
        member_id=member_id or None,
        status=status or None,
    )
    return jsonify({"ok": True, "claims": data})


@app.route("/api/overview/financial-summary", methods=["POST", "OPTIONS"])
def overview_financial_summary():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    summary = claims.get_financial_summary()
    return jsonify({
        "ok": True,
        "summary": summary,
        "viewer": {
            "player_id": user["player_id"],
            "name": user["name"],
            "role": user["role"],
        },
    })



@app.route("/api/warstack/state", methods=["POST", "OPTIONS"])
def warstack_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    return jsonify({
        "ok": True,
        "warstack": build_warstack_state(user),
    })


@app.route("/api/warstack/set-state", methods=["POST", "OPTIONS"])
def warstack_set_state():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)

    if not user_can_manage_warstack(user):
        return json_error("only configured warstack managers may change this state", 403)

    enabled = normalize_bool(payload.get("enabled"))
    claims.set_warstack_state(
        enabled=enabled,
        updated_by=normalize_text(user.get("name")),
        updated_by_id=normalize_text(user.get("player_id")),
    )

    return jsonify({
        "ok": True,
        "warstack": build_warstack_state(user),
    })


@app.route("/api/claims/history", methods=["POST", "OPTIONS"])
def claim_history():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    claim_id = normalize_text(payload.get("claim_id"))
    if claim_id:
        return jsonify({"ok": True, "history": history.list_history(claim_id)})

    limit = int(payload.get("limit", 100) or 100)
    return jsonify({"ok": True, "history": history.list_recent(limit=limit)})


@app.route("/api/claims/push", methods=["POST", "OPTIONS"])
def push_claim():
    if request.method == "OPTIONS":
        return ok_options()

    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)

    action = normalize_text(payload.get("action"))
    auth = payload.get("auth") or {}
    claim = payload.get("claim") or {}
    claim_id = normalize_text(claim.get("id"))

    if not claim_id:
        return json_error("missing claim id", 400)

    existing = claims.get_claim(claim_id)
    clean = clean_claim_payload(claim, existing)

    if existing and normalize_bool(existing.get("locked")) and action not in {
        "admin_mark_read",
        "admin_mark_unread",
        "admin_mark_notified",
    }:
        return json_error("claim is locked", 403)

    if action == "member_submit":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        clean["member"] = user["name"]
        clean["memberId"] = user["player_id"]
        clean["status"] = "Pending review"
        clean["isRead"] = 0
        clean["isNotified"] = 0
        clean["notifiedAt"] = ""
        clean["reviewedBy"] = normalize_text(existing.get("reviewedBy")) if existing else ""
        clean["paidAt"] = normalize_text(existing.get("paidAt")) if existing else ""
        clean["completedAt"] = normalize_text(existing.get("completedAt")) if existing else ""
        clean["locked"] = normalize_bool(existing.get("locked")) if existing else 0

        claims.upsert_claim(clean)
        history.add_entry(
            claim_id,
            f'{user["name"]} [{user["player_id"]}] submitted claim as member. Status set to Pending review.'
        )
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "member_mark_read":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)

        if existing and normalize_text(existing.get("memberId")) not in {"", user["player_id"]}:
            return json_error("members may only update their own claims", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'{user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_update":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        allowed = {"Pending review", "Under review", "Approved", "Denied", "Paid"}
        if clean["status"] not in allowed:
            return json_error("invalid status", 400)

        clean["reviewedBy"] = user["name"]
        if clean["status"] == "Paid" and not clean["paidAt"]:
            clean["paidAt"] = now_iso()

        claims.upsert_claim(clean)

        msg = f'Admin {user["name"]} updated claim to {clean["status"]}.'
        if clean["decision"]:
            msg += f' Note: {clean["decision"]}.'
        if clean["payout"]:
            msg += f' Payout: {clean["payout"]}.'
        history.add_entry(claim_id, msg)

        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_complete":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        clean["status"] = "Paid"
        clean["reviewedBy"] = user["name"]
        clean["paidAt"] = clean["paidAt"] or now_iso()
        clean["completedAt"] = now_iso()
        clean["locked"] = 1

        claims.upsert_claim(clean)
        history.add_entry(claim_id, f'Admin {user["name"]} completed and locked claim as Paid.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_read":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=True)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as read.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_unread":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_read(claim_id, is_read=False)
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as unread.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    if action == "admin_mark_notified":
        admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return json_error(err or "admin auth failed", 403)

        claims.mark_notified(claim_id, is_notified=True, notified_at=now_iso())
        history.add_entry(claim_id, f'Admin {user["name"]} marked claim as notified.')
        return jsonify({"ok": True, "claim": claims.get_claim(claim_id)})

    return json_error("invalid claim action", 400)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
