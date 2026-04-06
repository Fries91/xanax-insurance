import os
import secrets
from datetime import datetime, timezone, timedelta

import requests
from flask import Flask, jsonify, request

from db import (
    init_db,
    seed_plans,
    get_plans,
    get_plan,
    upsert_member_auth,
    get_member_by_session,
    clear_member_session,
    get_member_enrollment,
    enroll_member_plan,
    create_claim,
    get_member_claims,
    get_all_claims,
    get_pending_claim_count,
    get_latest_claim_for_plan,
    set_claim_status,
)

app = Flask(__name__)

init_db()
seed_plans()

FACTION_ID = int(os.getenv("FACTION_ID", "123456"))
ADMIN_TORN_ID = int(os.getenv("ADMIN_TORN_ID", "3679030"))
TORN_API_BASE = os.getenv("TORN_API_BASE", "https://api.torn.com")
TORN_API_TIMEOUT = 20


def api_error(message, status=400, extra=None):
    payload = {"ok": False, "error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status


def normalize_dt(value):
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return None

        parsed = None
        candidates = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S.%f",
        ]
        for fmt in candidates:
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue

        if parsed is None:
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                return text

        dt = parsed

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def iso_z(dt):
    if not dt:
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def serialize_claim(claim):
    if not claim:
        return claim

    row = dict(claim)
    created_dt = normalize_dt(row.get("created_at"))
    reviewed_dt = normalize_dt(row.get("reviewed_at"))
    row["created_at"] = iso_z(created_dt)
    row["reviewed_at"] = iso_z(reviewed_dt)
    return row


def serialize_claims(claims):
    return [serialize_claim(c) for c in (claims or [])]


def serialize_plan(plan):
    if not plan:
        return None
    row = dict(plan)
    return row


def get_session_member():
    token = request.headers.get("X-Session-Token", "").strip()
    if not token:
        return None
    return get_member_by_session(token)


def require_auth():
    member = get_session_member()
    if not member:
        return None, api_error("Not authenticated", 401)
    if int(member["faction_id"]) != FACTION_ID:
        return None, api_error("Faction members only", 403)
    return member, None


def require_admin():
    member, err = require_auth()
    if err:
        return None, err
    if not int(member.get("is_admin", 0)):
        return None, api_error("Admin only", 403)
    return member, None


def call_torn_key_info(api_key: str):
    url = f"{TORN_API_BASE}/v2/key/info"
    res = requests.get(
        url,
        headers={"Authorization": f"ApiKey {api_key}"},
        timeout=TORN_API_TIMEOUT,
    )
    res.raise_for_status()
    return res.json()


def call_torn_user_profile(api_key: str):
    url = f"{TORN_API_BASE}/user/?selections=profile&key={api_key}"
    res = requests.get(url, timeout=TORN_API_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    if isinstance(data, dict) and data.get("error"):
        raise ValueError(data["error"].get("error", "Torn API error"))
    return data


def get_plan_rules_state(member_torn_id, plan):
    latest_claim = get_latest_claim_for_plan(member_torn_id, plan["plan_key"])
    pending_count = get_pending_claim_count(member_torn_id, plan["plan_key"])

    cooldown_hours = int(plan.get("cooldown_hours", 0) or 0)
    max_pending_claims = int(plan.get("max_pending_claims", 1) or 1)

    cooldown_until = None
    cooldown_remaining_hours = 0

    if latest_claim and cooldown_hours > 0:
        latest_dt = normalize_dt(latest_claim.get("created_at"))
        if latest_dt:
            until_dt = latest_dt + timedelta(hours=cooldown_hours)
            now_dt = datetime.now(timezone.utc)
            if until_dt > now_dt:
                cooldown_until = until_dt
                seconds_left = (until_dt - now_dt).total_seconds()
                cooldown_remaining_hours = max(1, int((seconds_left + 3599) // 3600))

    rules = {
        "cooldown_hours": cooldown_hours,
        "cooldown_until": iso_z(cooldown_until) if cooldown_until else None,
        "cooldown_remaining_hours": cooldown_remaining_hours,
        "max_pending_claims": max_pending_claims,
        "pending_claims": pending_count,
        "can_submit_claim": True,
    }

    if pending_count >= max_pending_claims:
        rules["can_submit_claim"] = False
        rules["block_reason"] = "You already have the maximum pending claims for this plan."

    if cooldown_until:
        rules["can_submit_claim"] = False
        rules["block_reason"] = f"Cooldown active for about {cooldown_remaining_hours} more hour(s)."

    return rules


@app.get("/")
def home():
    return jsonify({"ok": True, "app": "Faction Xanax Insurance", "status": "running"})


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/insurance/auth/verify")
def insurance_auth_verify():
    data = request.get_json(force=True)
    api_key = (data.get("api_key") or "").strip()

    if not api_key:
        return api_error("Missing API key", 400)

    try:
        key_info = call_torn_key_info(api_key)
        user_obj = (key_info or {}).get("user") or {}
        user_id = int(user_obj.get("id") or 0)
        faction_id = int(user_obj.get("faction_id") or 0)

        if not user_id:
            return api_error("Could not verify user from API key", 403)

        profile = call_torn_user_profile(api_key)
        name = str(profile.get("name") or f"User {user_id}")
        faction = profile.get("faction") or {}
        position = str(faction.get("position") or "")

    except requests.HTTPError:
        return api_error("Torn API request failed", 502)
    except Exception as exc:
        return api_error(f"Authentication failed: {exc}", 403)

    if faction_id != FACTION_ID:
        return api_error("Faction members only", 403)

    session_token = secrets.token_urlsafe(32)
    is_admin = 1 if user_id == ADMIN_TORN_ID else 0

    upsert_member_auth(
        torn_id=user_id,
        name=name,
        faction_id=faction_id,
        position=position,
        is_admin=is_admin,
        session_token=session_token,
        api_key=api_key,
    )

    return jsonify({
        "ok": True,
        "session_token": session_token,
        "member": {
            "torn_id": user_id,
            "name": name,
            "faction_id": faction_id,
            "position": position,
            "is_admin": bool(is_admin),
        },
        "tos": {
            "data_storage": "Session token stored locally in browser. API key stored on service for authenticated insurance access.",
            "data_sharing": "No public sharing. Insurance data visible to service owner/admins as needed for claims handling.",
            "purpose": "Faction-only insurance authentication, enrollments, and claim review.",
            "key_access": "Uses player's Torn API key for authentication and faction verification."
        }
    })


@app.post("/api/insurance/auth/logout")
def insurance_auth_logout():
    member = get_session_member()
    if member:
        clear_member_session(member["session_token"])
    return jsonify({"ok": True})


@app.get("/api/insurance/plans")
def insurance_plans():
    plans = [serialize_plan(p) for p in get_plans()]
    return jsonify({"ok": True, "plans": plans})


@app.get("/api/insurance/me")
def insurance_me():
    member, err = require_auth()
    if err:
        return err

    plan_key = (request.args.get("plan_key") or "").strip()
    enrollment = get_member_enrollment(member["torn_id"], plan_key or None)
    claims = get_member_claims(member["torn_id"], plan_key or None)

    plan_rules = None
    if plan_key:
        plan = get_plan(plan_key)
        if plan:
            plan_rules = get_plan_rules_state(member["torn_id"], plan)

    return jsonify({
        "ok": True,
        "member": {
            "torn_id": member["torn_id"],
            "name": member["name"],
            "faction_id": member["faction_id"],
            "position": member.get("position", ""),
            "is_admin": bool(member.get("is_admin", 0)),
        },
        "enrollment": enrollment,
        "claims": serialize_claims(claims),
        "plan_rules": plan_rules,
    })


@app.post("/api/insurance/enroll")
def insurance_enroll():
    member, err = require_auth()
    if err:
        return err

    data = request.get_json(force=True)
    plan_key = (data.get("plan_key") or "").strip()

    plan = get_plan(plan_key)
    if not plan:
        return api_error("Plan not found", 404)

    enroll_member_plan(member["torn_id"], plan_key)

    return jsonify({
        "ok": True,
        "message": "Enrolled successfully",
        "plan": serialize_plan(plan)
    })


@app.post("/api/insurance/claim")
def insurance_claim():
    member, err = require_auth()
    if err:
        return err

    data = request.get_json(force=True)
    plan_key = (data.get("plan_key") or "").strip()
    proof_text = (data.get("proof_text") or "").strip()

    try:
        jump_count = int(data.get("jump_count", 1))
    except (ValueError, TypeError):
        return api_error("Invalid jump count", 400)

    plan = get_plan(plan_key)
    if not plan:
        return api_error("Plan not found", 404)

    enrollment = get_member_enrollment(member["torn_id"], plan_key)
    if not enrollment:
        return api_error("You are not enrolled in this plan", 403)

    if jump_count < int(plan["min_count"]) or jump_count > int(plan["max_count"]):
        return api_error("Jump count outside plan coverage", 400)

    plan_rules = get_plan_rules_state(member["torn_id"], plan)
    if not plan_rules["can_submit_claim"]:
        return api_error(
            plan_rules.get("block_reason", "Claim blocked by plan rules."),
            400,
            {"plan_rules": plan_rules}
        )

    requested_amount = int(plan["payout_amount"])
    claim_id = create_claim(
        torn_id=member["torn_id"],
        name=member["name"],
        faction_id=member["faction_id"],
        plan_key=plan_key,
        jump_count=jump_count,
        proof_text=proof_text,
        requested_amount=requested_amount,
    )

    return jsonify({
        "ok": True,
        "message": "Claim submitted",
        "claim_id": claim_id,
        "requested_amount": requested_amount
    })


@app.get("/api/insurance/admin/claims")
def insurance_admin_claims():
    member, err = require_admin()
    if err:
        return err

    return jsonify({
        "ok": True,
        "admin": {
            "torn_id": member["torn_id"],
            "name": member["name"]
        },
        "claims": serialize_claims(get_all_claims())
    })


@app.post("/api/insurance/admin/claims/<int:claim_id>/approve")
def insurance_admin_approve(claim_id):
    member, err = require_admin()
    if err:
        return err

    set_claim_status(claim_id, "approved", member["torn_id"])
    return jsonify({"ok": True, "message": "Claim approved"})


@app.post("/api/insurance/admin/claims/<int:claim_id>/deny")
def insurance_admin_deny(claim_id):
    member, err = require_admin()
    if err:
        return err

    set_claim_status(claim_id, "denied", member["torn_id"])
    return jsonify({"ok": True, "message": "Claim denied"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
