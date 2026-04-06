import os
from flask import Flask, jsonify, request

from db import (
    init_db,
    seed_plans,
    get_plans,
    get_plan,
    get_member_plan,
    enroll_member,
    create_claim,
    get_member_claims,
    get_all_claims,
    set_claim_status,
)

app = Flask(__name__)

init_db()
seed_plans()

FACTION_ID = int(os.getenv("FACTION_ID", "123456"))  # replace in Render env
ADMIN_TORN_ID = int(os.getenv("ADMIN_TORN_ID", "3679030"))


@app.get("/")
def home():
    return jsonify({
        "ok": True,
        "app": "Faction Xanax Insurance",
        "status": "running"
    })


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/insurance/plans")
def insurance_plans():
    return jsonify({
        "ok": True,
        "plans": get_plans()
    })


@app.get("/api/insurance/me")
def insurance_me():
    try:
        torn_id = int(request.args.get("torn_id", "0"))
        plan_key = (request.args.get("plan_key") or "").strip()
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid torn_id"}), 400

    if not torn_id:
        return jsonify({"ok": False, "error": "Missing torn_id"}), 400

    member = get_member_plan(torn_id, plan_key or None)
    claims = get_member_claims(torn_id, plan_key or None)

    return jsonify({
        "ok": True,
        "member": member,
        "claims": claims
    })


@app.post("/api/insurance/enroll")
def insurance_enroll():
    data = request.get_json(force=True)

    try:
        torn_id = int(data.get("torn_id", 0))
        faction_id = int(data.get("faction_id", 0))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Invalid numeric fields"}), 400

    name = (data.get("name") or "").strip()
    plan_key = (data.get("plan_key") or "").strip()

    if not torn_id or not faction_id or not name or not plan_key:
        return jsonify({"ok": False, "error": "Missing fields"}), 400

    if faction_id != FACTION_ID:
        return jsonify({"ok": False, "error": "Faction members only"}), 403

    plan = get_plan(plan_key)
    if not plan:
        return jsonify({"ok": False, "error": "Plan not found"}), 404

    enroll_member(torn_id, name, faction_id, plan_key)

    return jsonify({
        "ok": True,
        "message": "Enrolled successfully",
        "plan": plan
    })


@app.post("/api/insurance/claim")
def insurance_claim():
    data = request.get_json(force=True)

    try:
        torn_id = int(data.get("torn_id", 0))
        faction_id = int(data.get("faction_id", 0))
        jump_count = int(data.get("jump_count", 1))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Invalid numeric fields"}), 400

    name = (data.get("name") or "").strip()
    plan_key = (data.get("plan_key") or "").strip()
    proof_text = (data.get("proof_text") or "").strip()

    if not torn_id or not faction_id or not name or not plan_key:
        return jsonify({"ok": False, "error": "Missing fields"}), 400

    if faction_id != FACTION_ID:
        return jsonify({"ok": False, "error": "Faction members only"}), 403

    plan = get_plan(plan_key)
    if not plan:
        return jsonify({"ok": False, "error": "Plan not found"}), 404

    membership = get_member_plan(torn_id, plan_key)
    if not membership:
        return jsonify({"ok": False, "error": "You are not enrolled in this plan"}), 403

    if jump_count < int(plan["min_count"]) or jump_count > int(plan["max_count"]):
        return jsonify({"ok": False, "error": "Jump count outside plan coverage"}), 400

    requested_amount = int(plan["payout_amount"])
    claim_id = create_claim(
        torn_id=torn_id,
        name=name,
        faction_id=faction_id,
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
    try:
        torn_id = int(request.args.get("torn_id", "0"))
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid torn_id"}), 400

    if torn_id != ADMIN_TORN_ID:
        return jsonify({"ok": False, "error": "Admin only"}), 403

    return jsonify({
        "ok": True,
        "claims": get_all_claims()
    })


@app.post("/api/insurance/admin/claims/<int:claim_id>/approve")
def insurance_admin_approve(claim_id):
    data = request.get_json(force=True)

    try:
        admin_torn_id = int(data.get("admin_torn_id", 0))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Invalid admin_torn_id"}), 400

    if admin_torn_id != ADMIN_TORN_ID:
        return jsonify({"ok": False, "error": "Admin only"}), 403

    set_claim_status(claim_id, "approved", admin_torn_id)

    return jsonify({"ok": True, "message": "Claim approved"})


@app.post("/api/insurance/admin/claims/<int:claim_id>/deny")
def insurance_admin_deny(claim_id):
    data = request.get_json(force=True)

    try:
        admin_torn_id = int(data.get("admin_torn_id", 0))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Invalid admin_torn_id"}), 400

    if admin_torn_id != ADMIN_TORN_ID:
        return jsonify({"ok": False, "error": "Admin only"}), 403

    set_claim_status(claim_id, "denied", admin_torn_id)

    return jsonify({"ok": True, "message": "Claim denied"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
