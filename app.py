from __future__ import annotations

import os
import requests
from flask import Flask, jsonify, request
from db import ClaimsStore, ClaimHistoryStore

app = Flask(__name__)
claims = ClaimsStore(os.getenv("DB_PATH", "claims.sqlite3"))
history = ClaimHistoryStore(os.getenv("DB_PATH", "claims.sqlite3"))

SYNC_SECRET = os.getenv("SYNC_SECRET", "change-me")
FACTION_ID = str(os.getenv("FACTION_ID", "")).strip()
ADMIN_PLAYER_ID = str(os.getenv("ADMIN_PLAYER_ID", "")).strip()

def corsify(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return resp

@app.after_request
def after_request(resp):
    return corsify(resp)

@app.route("/api/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    return jsonify({"ok": True, "service": "xanax-insurance-api", "faction_lock": FACTION_ID, "admin_player_id": ADMIN_PLAYER_ID})

def check_secret(payload: dict) -> bool:
    return (payload or {}).get("secret", "") == SYNC_SECRET

def torn_lookup_user(api_key: str) -> dict | None:
    url = "https://api.torn.com/v2/key/info"
    r = requests.get(url, headers={"Authorization": f"ApiKey {api_key}"}, timeout=20)
    if r.status_code != 200:
        return None
    data = r.json()
    return data if isinstance(data, dict) else None

def verify_admin_by_key(api_key: str):
    if not api_key or not ADMIN_PLAYER_ID:
        return None, "missing admin api key or admin player id"
    data = torn_lookup_user(api_key)
    if not data:
        return None, "torn api lookup failed"
    user_obj = data.get("user") or {}
    player_id = str(user_obj.get("id", "")).strip()
    player_name = str(user_obj.get("name", "")).strip() or f"Player {player_id}"
    if not player_id:
        return None, "could not identify player from api key"
    if player_id != ADMIN_PLAYER_ID:
        return None, "api key owner is not the configured admin"
    return {"username": player_id, "name": player_name, "role": "admin"}, None

def verify_faction_member(auth: dict):
    api_key = str((auth or {}).get("api_key", "")).strip()
    faction_id = str((auth or {}).get("faction_id", "")).strip() or FACTION_ID
    if not api_key or not faction_id:
        return None, "missing api key or faction id"
    data = torn_lookup_user(api_key)
    if not data:
        return None, "torn api lookup failed"
    user_obj = data.get("user") or {}
    player_id = str(user_obj.get("id", "")).strip()
    player_name = str(user_obj.get("name", "")).strip() or f"Player {player_id}"
    player_faction_id = str(user_obj.get("faction_id", "")).strip()
    if not player_id:
        return None, "could not identify player from api key"
    if player_faction_id != str(faction_id):
        return None, "player is not in the locked faction"
    return {"username": player_id, "name": player_name, "role": "member", "faction_id": player_faction_id}, None

@app.route("/api/auth/admin-key-login", methods=["POST", "OPTIONS"])
def auth_admin_key_login():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return jsonify({"ok": False, "error": "unauthorized"}), 403
    api_key = str(payload.get("api_key", "")).strip()
    user, err = verify_admin_by_key(api_key)
    if not user:
        return jsonify({"ok": False, "error": err or "admin api key login failed"}), 403
    return jsonify({"ok": True, "user": user})

@app.route("/api/auth/faction-login", methods=["POST", "OPTIONS"])
def auth_faction_login():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return jsonify({"ok": False, "error": "unauthorized"}), 403
    user, err = verify_faction_member(payload)
    if not user:
        return jsonify({"ok": False, "error": err or "faction login failed"}), 403
    return jsonify({"ok": True, "user": user})

@app.route("/api/claims/pull", methods=["POST", "OPTIONS"])
def pull_claims():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return jsonify({"ok": False, "error": "unauthorized"}), 403
    return jsonify({"ok": True, "claims": claims.list_claims()})

@app.route("/api/claims/history", methods=["POST", "OPTIONS"])
def claim_history():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return jsonify({"ok": False, "error": "unauthorized"}), 403
    claim_id = str(payload.get("claim_id", "")).strip()
    if not claim_id:
        return jsonify({"ok": False, "error": "missing claim id"}), 400
    return jsonify({"ok": True, "history": history.list_history(claim_id)})

@app.route("/api/claims/push", methods=["POST", "OPTIONS"])
def push_claim():
    if request.method == "OPTIONS":
        return corsify(jsonify({"ok": True}))
    payload = request.get_json(silent=True) or {}
    if not check_secret(payload):
        return jsonify({"ok": False, "error": "unauthorized"}), 403

    action = str(payload.get("action", "")).strip()
    auth = payload.get("auth") or {}
    claim = payload.get("claim") or {}
    claim_id = str(claim.get("id", "")).strip()
    if not claim_id:
        return jsonify({"ok": False, "error": "missing claim id"}), 400

    existing = claims.get_claim(claim_id)
    clean = {
        "id": claim_id,
        "plan": str(claim.get("plan", "None")),
        "status": str(claim.get("status", "Not submitted")),
        "note": str(claim.get("note", "")),
        "loss": str(claim.get("loss", "")),
        "proof": str(claim.get("proof", "")),
        "stack": str(claim.get("stack", "")),
        "payout": str(claim.get("payout", "")),
        "decision": str(claim.get("decision", "")),
        "member": str(claim.get("member", "Guest")),
        "updatedAt": str(claim.get("updatedAt", "")),
    }

    if action == "member_submit":
        user, err = verify_faction_member(auth)
        if not user:
            return jsonify({"ok": False, "error": err or "member auth failed"}), 403
        clean["member"] = user["name"]
        clean["status"] = "Pending review"
        clean["payout"] = existing.get("payout", "") if existing else ""
        clean["decision"] = existing.get("decision", "") if existing else ""
        if existing and existing.get("member") not in ("", user["name"]):
            return jsonify({"ok": False, "error": "members may only update their own claims"}), 403
        claims.upsert_claim(clean)
        history.add_entry(claim_id, f'{user["name"]} submitted claim as member. Status set to Pending review.')
        return jsonify({"ok": True, "claim": clean})

    if action == "admin_update":
        admin_key = str((auth or {}).get("admin_api_key", "")).strip()
        user, err = verify_admin_by_key(admin_key)
        if not user:
            return jsonify({"ok": False, "error": err or "admin auth failed"}), 403
        allowed = {"Pending review", "Under review", "Approved", "Denied", "Paid"}
        if clean["status"] not in allowed:
            return jsonify({"ok": False, "error": "invalid status"}), 400
        claims.upsert_claim(clean)
        msg = f'Admin updated claim to {clean["status"]}.'
        if clean["decision"]:
            msg += f' Note: {clean["decision"]}.'
        if clean["payout"]:
            msg += f' Payout: {clean["payout"]}.'
        history.add_entry(claim_id, msg)
        return jsonify({"ok": True, "claim": clean})

    return jsonify({"ok": False, "error": "invalid claim action"}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
