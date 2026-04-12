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

SYNC_SECRET = os.getenv("SYNC_SECRET", "6282")
FACTION_ID = str(os.getenv("FACTION_ID", "49384")).strip()
ADMIN_PLAYER_ID = str(os.getenv("ADMIN_PLAYER_ID", "3679030")).strip()
TORN_API_BASE = os.getenv("TORN_API_BASE", "https://api.torn.com").rstrip("/")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "20"))
WARSTACK_MANAGER_IDS = {x.strip() for x in str(os.getenv("WARSTACK_MANAGER_IDS", "3275528,1905671")).split(",") if x.strip()}


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
    return "" if value is None else str(value).strip()


def normalize_bool(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    return 1 if str(value).strip().lower() in {"1", "true", "yes", "y", "on"} else 0


def parse_torn_key_info(data: dict[str, Any]) -> dict[str, str]:
    user_obj = data.get("user") or {}
    faction_obj = data.get("faction") or {}
    player_id = normalize_text(user_obj.get("id") or user_obj.get("player_id") or data.get("player_id"))
    player_name = normalize_text(user_obj.get("name") or user_obj.get("player_name") or data.get("player_name"))
    faction_id = normalize_text(user_obj.get("faction_id") or faction_obj.get("id") or data.get("faction_id"))
    faction_name = normalize_text(faction_obj.get("name") or data.get("faction_name"))
    position = normalize_text(
        user_obj.get("position")
        or user_obj.get("faction_position")
        or faction_obj.get("position")
        or faction_obj.get("rank")
        or data.get("position")
        or data.get("faction_position")
    )
    return {
        "player_id": player_id,
        "player_name": player_name or (f"Player {player_id}" if player_id else ""),
        "faction_id": faction_id,
        "faction_name": faction_name,
        "position": position,
    }


def torn_lookup_user(api_key: str) -> tuple[dict[str, Any] | None, str | None]:
    if not api_key:
        return None, "missing api key"

    # 1) Check that the key itself is valid / active
    key_url = f"{TORN_API_BASE}/v2/key/info"
    try:
        resp = requests.get(key_url, headers={"Authorization": f"ApiKey {api_key}"}, timeout=REQUEST_TIMEOUT)
    except requests.Timeout:
        return None, "torn lookup timed out"
    except requests.RequestException:
        return None, "torn lookup failed"

    try:
        key_data = resp.json()
    except Exception:
        key_data = None

    if resp.status_code != 200:
        if isinstance(key_data, dict):
            err = key_data.get("error")
            if isinstance(err, dict):
                msg = normalize_text(err.get("error") or err.get("message"))
                if msg:
                    return None, msg
            msg = normalize_text(key_data.get("error") or key_data.get("message"))
            if msg:
                return None, msg
        return None, f"torn lookup failed ({resp.status_code})"

    if isinstance(key_data, dict):
        err = key_data.get("error")
        if isinstance(err, dict):
            msg = normalize_text(err.get("error") or err.get("message"))
            return None, msg or "torn api returned an error"
        if err:
            return None, normalize_text(err) or "torn api returned an error"

    # 2) Read the key owner's actual player/faction identity from user basic
    # Torn docs note that omitting the user ID returns the key owner's own data.
    user_url = f"{TORN_API_BASE}/user/?selections=basic&key={api_key}"
    try:
        user_resp = requests.get(user_url, timeout=REQUEST_TIMEOUT)
    except requests.Timeout:
        return None, "torn user basic timed out"
    except requests.RequestException:
        return None, "torn user basic lookup failed"

    try:
        user_data = user_resp.json()
    except Exception:
        user_data = None

    if user_resp.status_code != 200:
        if isinstance(user_data, dict):
            err = user_data.get("error")
            if isinstance(err, dict):
                msg = normalize_text(err.get("error") or err.get("message"))
                if msg:
                    return None, msg
            msg = normalize_text(user_data.get("error") or user_data.get("message"))
            if msg:
                return None, msg
        return None, f"torn user basic lookup failed ({user_resp.status_code})"

    if not isinstance(user_data, dict):
        return None, "invalid torn user response"

    err = user_data.get("error")
    if isinstance(err, dict):
        msg = normalize_text(err.get("error") or err.get("message"))
        return None, msg or "torn user basic returned an error"
    if err:
        return None, normalize_text(err) or "torn user basic returned an error"

    # normalize old v1 user/basic payload into the structure parse_torn_key_info expects
    basic_identity = {
        "player_id": normalize_text(user_data.get("player_id")),
        "player_name": normalize_text(user_data.get("name")),
        "faction_id": normalize_text(user_data.get("faction", {}).get("faction_id") if isinstance(user_data.get("faction"), dict) else ""),
        "faction_name": normalize_text(user_data.get("faction", {}).get("faction_name") if isinstance(user_data.get("faction"), dict) else ""),
        "position": normalize_text(user_data.get("faction", {}).get("position") if isinstance(user_data.get("faction"), dict) else ""),
        "key_info": key_data if isinstance(key_data, dict) else {},
        "user": {
            "id": normalize_text(user_data.get("player_id")),
            "name": normalize_text(user_data.get("name")),
            "faction_id": normalize_text(user_data.get("faction", {}).get("faction_id") if isinstance(user_data.get("faction"), dict) else ""),
            "position": normalize_text(user_data.get("faction", {}).get("position") if isinstance(user_data.get("faction"), dict) else ""),
        },
        "faction": {
            "id": normalize_text(user_data.get("faction", {}).get("faction_id") if isinstance(user_data.get("faction"), dict) else ""),
            "name": normalize_text(user_data.get("faction", {}).get("faction_name") if isinstance(user_data.get("faction"), dict) else ""),
            "position": normalize_text(user_data.get("faction", {}).get("position") if isinstance(user_data.get("faction"), dict) else ""),
        }
    }
    return basic_identity, None


def role_from_position(position: str) -> str:
    p = normalize_text(position).lower()
    if not p:
        return "member"
    if "co" in p and "leader" in p:
        return "co-leader"
    if "leader" in p:
        return "leader"
    return "member"


def verify_admin_by_key(api_key: str):
    data, lookup_err = torn_lookup_user(api_key)
    if not data:
        return None, lookup_err or "admin login failed"
    info = parse_torn_key_info(data)
    if not info["player_id"]:
        return None, "admin key recognized but no player id was returned"
    if ADMIN_PLAYER_ID and info["player_id"] != ADMIN_PLAYER_ID:
        return None, "not configured admin"
    return {
        "player_id": info["player_id"],
        "name": info["player_name"],
        "faction_id": info["faction_id"],
        "faction_name": info["faction_name"],
        "position": info["position"],
        "role": "admin",
    }, None


def verify_faction_member(auth: dict[str, Any]):
    api_key = normalize_text(auth.get("api_key"))
    faction_id_lock = normalize_text(auth.get("faction_id")) or FACTION_ID
    data, lookup_err = torn_lookup_user(api_key)
    if not data:
        return None, lookup_err or "member login failed"
    info = parse_torn_key_info(data)
    if not info["player_id"]:
        return None, "member key recognized but no player id was returned"
    if faction_id_lock and info["faction_id"] != faction_id_lock:
        return None, "wrong faction"
    return {
        "player_id": info["player_id"],
        "name": info["player_name"],
        "faction_id": info["faction_id"],
        "faction_name": info["faction_name"],
        "position": info["position"],
        "role": role_from_position(info["position"]),
    }, None


def verify_any_logged_in_user(auth: dict[str, Any]):
    admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
    if admin_key:
        admin_user, admin_err = verify_admin_by_key(admin_key)
        if admin_user:
            return admin_user, None
        if normalize_text(auth.get("admin_api_key")):
            return None, admin_err
    return verify_faction_member(auth)


def user_can_manage_warstack(user: dict[str, Any]) -> bool:
    role = normalize_text(user.get("role")).lower()
    player_id = normalize_text(user.get("player_id"))
    return role in {"admin", "leader"} or player_id in WARSTACK_MANAGER_IDS


def user_can_request_xanax(user: dict[str, Any]) -> bool:
    role = normalize_text(user.get("role")).lower()
    return role in {"admin", "leader"}


def build_war_tab_state(user: dict[str, Any]) -> dict[str, Any]:
    state = claims.get_war_tab_state()
    state["viewerCanManage"] = user_can_manage_warstack(user)
    state["viewerRole"] = normalize_text(user.get("role"))
    state["viewerName"] = normalize_text(user.get("name"))
    return state




def build_alert_state(user: dict[str, Any]) -> dict[str, Any]:
    counts = claims.get_alert_counts()
    counts["viewerIsAdmin"] = normalize_text(user.get("role")).lower() == "admin"
    counts["viewerRole"] = normalize_text(user.get("role"))
    return counts


def get_required_payment(plan: str, stage: str = "") -> tuple[str, str]:
    p = normalize_text(plan).lower()
    s = normalize_text(stage).lower()
    if p == "pride":
        return "Xanax", "2"
    if p == "envy":
        return "Xanax", "5"
    if p == "wrath":
        return "Xanax", "2"
    if p == "greed":
        return "Xanax", "1"
    return "Xanax", "0"
def build_xanax_request_state(user: dict[str, Any]) -> dict[str, Any]:
    state = claims.get_xanax_request_state()
    state["viewerCanRequest"] = user_can_request_xanax(user)
    state["viewerIsAdmin"] = normalize_text(user.get("role")).lower() == "admin"
    state["viewerRole"] = normalize_text(user.get("role"))
    state["viewerName"] = normalize_text(user.get("name"))
    return state


def clean_claim_payload(claim: dict[str, Any], existing: dict[str, Any] | None) -> dict[str, Any]:
    existing = existing or {}
    merged = {**existing, **(claim or {})}
    text_fields = [
        "id", "member", "memberId", "plan", "status", "note", "loss", "proof", "stack", "payout",
        "decision", "updatedAt", "createdAt", "armedAt", "armedPlan", "armedStage", "armedEnergy",
        "armedBoosterCd", "expiresAt", "odDetectedAt", "ruleCheck", "detectStatus", "requiredPaymentItem",
        "requiredPaymentQty", "memberPaymentVerifiedAt", "memberPaymentProof", "adminReceiptVerifiedAt",
        "adminReceiptProof", "adminPayoutVerifiedAt", "adminPayoutProof", "notifiedAt", "reviewedBy",
        "paidAt", "completedAt"
    ]
    bool_fields = [
        "memberPaymentVerified", "adminReceiptVerified", "adminPayoutVerified", "isRead", "isNotified", "locked"
    ]
    clean: dict[str, Any] = {}
    for key in text_fields:
        clean[key] = normalize_text(merged.get(key))
    for key in bool_fields:
        clean[key] = normalize_bool(merged.get(key))
    clean["updatedAt"] = clean["updatedAt"] or now_iso()
    clean["createdAt"] = clean["createdAt"] or normalize_text(existing.get("createdAt")) or now_iso()
    return clean


@app.route("/api/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return ok_options()
    return jsonify({"ok": True, "time": now_iso()})


@app.route("/api/auth/admin-key-login", methods=["POST", "OPTIONS"])
def auth_admin_key_login():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    user, err = verify_admin_by_key(normalize_text(payload.get("api_key")))
    if not user:
        return json_error(err or "admin login failed", 403)
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
    unread_only = bool(normalize_bool(payload.get("unreadOnly")))
    member_id = normalize_text(payload.get("memberId")) or None
    status = normalize_text(payload.get("status")) or None
    return jsonify({"ok": True, "claims": claims.list_claims(unread_only=unread_only, member_id=member_id, status=status)})


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
    return jsonify({
        "ok": True,
        "summary": claims.get_financial_summary(),
        "viewer": {"player_id": user["player_id"], "name": user["name"], "role": user["role"]},
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
    state = build_war_tab_state(user)
    return jsonify({"ok": True, "state": state, "war_tab": state})


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
        return json_error("only admin, leader, co-leader, or configured managers may activate or deactivate the war tab", 403)
    claims.set_war_tab_state(
        enabled=normalize_bool(payload.get("enabled")),
        updated_by=normalize_text(user.get("name")),
        updated_by_id=normalize_text(user.get("player_id")),
    )
    state = build_war_tab_state(user)
    return jsonify({"ok": True, "state": state, "war_tab": state})

@app.route("/api/xanax-request/state", methods=["POST", "OPTIONS"])
def xanax_request_state():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    state = build_xanax_request_state(user)
    return jsonify({"ok": True, "state": state})

@app.route("/api/xanax-request/request", methods=["POST", "OPTIONS"])
def xanax_request_request():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    if not user_can_request_xanax(user):
        return json_error("only admin, leader, or co-leader may request the faction cut", 403)
    summary = claims.get_financial_summary()
    total_owed = float(summary.get("faction_cut_xanax", 0) or 0)
    claims.request_xanax_cut(
        total_owed=total_owed,
        requested_by=normalize_text(user.get("name")),
        requested_by_id=normalize_text(user.get("player_id")),
    )
    state = build_xanax_request_state(user)
    return jsonify({"ok": True, "state": state})

@app.route("/api/xanax-request/mark-sent", methods=["POST", "OPTIONS"])
def xanax_request_mark_sent():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    if normalize_text(user.get("role")).lower() != "admin":
        return json_error("only admin may mark the faction cut as sent", 403)
    claims.mark_xanax_cut_sent(
        sent_by=normalize_text(user.get("name")),
        sent_by_id=normalize_text(user.get("player_id")),
    )
    state = build_xanax_request_state(user)
    return jsonify({"ok": True, "state": state})

@app.route("/api/xanax-request/reset", methods=["POST", "OPTIONS"])
def xanax_request_reset():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    if normalize_text(user.get("role")).lower() != "admin":
        return json_error("only admin may reset the faction cut total", 403)
    claims.reset_xanax_cut(
        reset_by=normalize_text(user.get("name")),
        reset_by_id=normalize_text(user.get("player_id")),
    )
    state = build_xanax_request_state(user)
    return jsonify({"ok": True, "state": state})


@app.route("/api/alerts/state", methods=["POST", "OPTIONS"])
def alerts_state():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    return jsonify({"ok": True, "state": build_alert_state(user)})

@app.route("/api/activations/pull", methods=["POST", "OPTIONS"])
def activations_pull():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    auth = payload.get("auth") or {}
    user, err = verify_any_logged_in_user(auth)
    if not user:
        return json_error(err or "auth failed", 403)
    status = normalize_text(payload.get("status")) or None
    if normalize_text(user.get("role")).lower() == "admin":
        rows = claims.list_activations(status=status)
    else:
        rows = claims.list_activations(member_id=normalize_text(user.get("player_id")), status=status)
    return jsonify({"ok": True, "activations": rows})

@app.route("/api/activations/push", methods=["POST", "OPTIONS"])
def activations_push():
    if request.method == "OPTIONS":
        return ok_options()
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return json_error("unauthorized", 403)
    action = normalize_text(payload.get("action"))
    auth = payload.get("auth") or {}
    activation = payload.get("activation") or {}
    activation_id = normalize_text(activation.get("id"))
    if not activation_id:
        return json_error("missing activation id", 400)

    existing = claims.get_activation(activation_id)

    if action == "member_request":
        user, err = verify_faction_member(auth)
        if not user:
            return json_error(err or "member auth failed", 403)
        plan = normalize_text(activation.get("plan"))
        stage = normalize_text(activation.get("stage"))
        item, qty = get_required_payment(plan, stage)
        clean = {
            "id": activation_id,
            "member": normalize_text(user.get("name")),
            "memberId": normalize_text(user.get("player_id")),
            "plan": plan,
            "stage": stage,
            "status": "Pending verification",
            "requiredPaymentItem": item,
            "requiredPaymentQty": qty,
            "paymentNote": normalize_text(activation.get("paymentNote")),
            "memberPaymentVerified": 0,
            "memberPaymentVerifiedAt": "",
            "adminReceiptVerified": 0,
            "adminReceiptVerifiedAt": "",
            "reviewedBy": "",
            "reviewNote": "",
            "createdAt": normalize_text(existing.get("createdAt")) if existing else now_iso(),
            "updatedAt": now_iso(),
        }
        claims.upsert_activation(clean)
        history.add_entry(activation_id, f'{user["name"]} [{user["player_id"]}] requested activation for {plan} {stage}.')
        return jsonify({"ok": True, "activation": claims.get_activation(activation_id)})

    admin_key = normalize_text(auth.get("admin_api_key") or auth.get("api_key"))
    user, err = verify_admin_by_key(admin_key)
    if not user:
        return json_error(err or "admin auth failed", 403)
    if not existing:
        return json_error("activation not found", 404)

    clean = dict(existing)
    clean["updatedAt"] = now_iso()
    clean["reviewedBy"] = normalize_text(user.get("name"))
    clean["reviewNote"] = normalize_text(activation.get("reviewNote")) or normalize_text(existing.get("reviewNote"))

    if action == "admin_verify_payment":
        clean["memberPaymentVerified"] = 1
        clean["memberPaymentVerifiedAt"] = now_iso()
        clean["status"] = "Pending receipt"
        claims.upsert_activation(clean)
        history.add_entry(activation_id, f'Admin {user["name"]} verified member payment.')
        return jsonify({"ok": True, "activation": claims.get_activation(activation_id)})

    if action == "admin_verify_receipt":
        clean["adminReceiptVerified"] = 1
        clean["adminReceiptVerifiedAt"] = now_iso()
        clean["status"] = "Activated"
        claims.upsert_activation(clean)
        history.add_entry(activation_id, f'Admin {user["name"]} verified receipt and activated the plan.')
        return jsonify({"ok": True, "activation": claims.get_activation(activation_id)})

    if action == "admin_reject":
        clean["status"] = "Rejected"
        claims.upsert_activation(clean)
        history.add_entry(activation_id, f'Admin {user["name"]} rejected activation. {clean["reviewNote"]}')
        return jsonify({"ok": True, "activation": claims.get_activation(activation_id)})

    return json_error("invalid activation action", 400)

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

    if action in {"member_submit", "auto_detect"}:
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
        if action == "auto_detect":
            clean["detectStatus"] = normalize_text(clean.get("detectStatus")) or "auto_detected"
            clean["odDetectedAt"] = normalize_text(clean.get("odDetectedAt")) or now_iso()
            clean["ruleCheck"] = normalize_text(clean.get("ruleCheck")) or "Auto-detected during active coverage window."

        claims.upsert_claim(clean)
        if action == "auto_detect":
            history.add_entry(
                claim_id,
                f'{user["name"]} [{user["player_id"]}] auto-detected OD claim created. Status set to Pending review.'
            )
        else:
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
