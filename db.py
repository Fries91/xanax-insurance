from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class BaseStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = str(Path(db_path))

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn


class ClaimsStore(BaseStore):
    def __init__(self, db_path: str) -> None:
        super().__init__(db_path)
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS claims (
                    id TEXT PRIMARY KEY,
                    member TEXT NOT NULL DEFAULT '',
                    memberId TEXT NOT NULL DEFAULT '',
                    plan TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    loss TEXT NOT NULL DEFAULT '',
                    proof TEXT NOT NULL DEFAULT '',
                    stack TEXT NOT NULL DEFAULT '',
                    payout TEXT NOT NULL DEFAULT '',
                    decision TEXT NOT NULL DEFAULT '',
                    updatedAt TEXT NOT NULL DEFAULT '',
                    createdAt TEXT NOT NULL DEFAULT '',

                    armedAt TEXT NOT NULL DEFAULT '',
                    armedPlan TEXT NOT NULL DEFAULT '',
                    armedStage TEXT NOT NULL DEFAULT '',
                    armedEnergy TEXT NOT NULL DEFAULT '',
                    armedBoosterCd TEXT NOT NULL DEFAULT '',
                    expiresAt TEXT NOT NULL DEFAULT '',
                    odDetectedAt TEXT NOT NULL DEFAULT '',
                    ruleCheck TEXT NOT NULL DEFAULT '',
                    detectStatus TEXT NOT NULL DEFAULT '',

                    requiredPaymentItem TEXT NOT NULL DEFAULT '',
                    requiredPaymentQty TEXT NOT NULL DEFAULT '',
                    memberPaymentVerified INTEGER NOT NULL DEFAULT 0,
                    memberPaymentVerifiedAt TEXT NOT NULL DEFAULT '',
                    memberPaymentProof TEXT NOT NULL DEFAULT '',

                    adminReceiptVerified INTEGER NOT NULL DEFAULT 0,
                    adminReceiptVerifiedAt TEXT NOT NULL DEFAULT '',
                    adminReceiptProof TEXT NOT NULL DEFAULT '',

                    adminPayoutVerified INTEGER NOT NULL DEFAULT 0,
                    adminPayoutVerifiedAt TEXT NOT NULL DEFAULT '',
                    adminPayoutProof TEXT NOT NULL DEFAULT '',

                    isRead INTEGER NOT NULL DEFAULT 0,
                    isNotified INTEGER NOT NULL DEFAULT 0,
                    notifiedAt TEXT NOT NULL DEFAULT '',

                    reviewedBy TEXT NOT NULL DEFAULT '',
                    paidAt TEXT NOT NULL DEFAULT '',
                    completedAt TEXT NOT NULL DEFAULT '',
                    locked INTEGER NOT NULL DEFAULT 0
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS claim_history (
                    historyId INTEGER PRIMARY KEY AUTOINCREMENT,
                    claimId TEXT NOT NULL DEFAULT '',
                    at TEXT NOT NULL DEFAULT '',
                    text TEXT NOT NULL DEFAULT ''
                )
                """
            )


            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS activation_requests (
                    id TEXT PRIMARY KEY,
                    member TEXT NOT NULL DEFAULT '',
                    memberId TEXT NOT NULL DEFAULT '',
                    plan TEXT NOT NULL DEFAULT '',
                    stage TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT '',
                    requiredPaymentItem TEXT NOT NULL DEFAULT '',
                    requiredPaymentQty TEXT NOT NULL DEFAULT '',
                    paymentNote TEXT NOT NULL DEFAULT '',
                    memberPaymentVerified INTEGER NOT NULL DEFAULT 0,
                    memberPaymentVerifiedAt TEXT NOT NULL DEFAULT '',
                    adminReceiptVerified INTEGER NOT NULL DEFAULT 0,
                    adminReceiptVerifiedAt TEXT NOT NULL DEFAULT '',
                    reviewedBy TEXT NOT NULL DEFAULT '',
                    reviewNote TEXT NOT NULL DEFAULT '',
                    createdAt TEXT NOT NULL DEFAULT '',
                    updatedAt TEXT NOT NULL DEFAULT ''
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL DEFAULT '',
                    updatedAt TEXT NOT NULL DEFAULT '',
                    updatedBy TEXT NOT NULL DEFAULT '',
                    updatedById TEXT NOT NULL DEFAULT ''
                )
                """
            )

            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_member_id ON claims(memberId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_is_read ON claims(isRead)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_updated_at ON claims(updatedAt)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_claim_id ON claim_history(claimId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_at ON claim_history(at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activation_member_id ON activation_requests(memberId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activation_status ON activation_requests(status)")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS script_users (
                    memberId TEXT PRIMARY KEY,
                    member TEXT NOT NULL DEFAULT '',
                    role TEXT NOT NULL DEFAULT '',
                    platform TEXT NOT NULL DEFAULT '',
                    lastSeenAt TEXT NOT NULL DEFAULT '',
                    createdAt TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_script_users_last_seen ON script_users(lastSeenAt)")
            conn.commit()

            needed = {
                "member": "TEXT NOT NULL DEFAULT ''",
                "memberId": "TEXT NOT NULL DEFAULT ''",
                "plan": "TEXT NOT NULL DEFAULT ''",
                "status": "TEXT NOT NULL DEFAULT ''",
                "note": "TEXT NOT NULL DEFAULT ''",
                "loss": "TEXT NOT NULL DEFAULT ''",
                "proof": "TEXT NOT NULL DEFAULT ''",
                "stack": "TEXT NOT NULL DEFAULT ''",
                "payout": "TEXT NOT NULL DEFAULT ''",
                "decision": "TEXT NOT NULL DEFAULT ''",
                "updatedAt": "TEXT NOT NULL DEFAULT ''",
                "createdAt": "TEXT NOT NULL DEFAULT ''",
                "armedAt": "TEXT NOT NULL DEFAULT ''",
                "armedPlan": "TEXT NOT NULL DEFAULT ''",
                "armedStage": "TEXT NOT NULL DEFAULT ''",
                "armedEnergy": "TEXT NOT NULL DEFAULT ''",
                "armedBoosterCd": "TEXT NOT NULL DEFAULT ''",
                "expiresAt": "TEXT NOT NULL DEFAULT ''",
                "odDetectedAt": "TEXT NOT NULL DEFAULT ''",
                "ruleCheck": "TEXT NOT NULL DEFAULT ''",
                "detectStatus": "TEXT NOT NULL DEFAULT ''",
                "requiredPaymentItem": "TEXT NOT NULL DEFAULT ''",
                "requiredPaymentQty": "TEXT NOT NULL DEFAULT ''",
                "memberPaymentVerified": "INTEGER NOT NULL DEFAULT 0",
                "memberPaymentVerifiedAt": "TEXT NOT NULL DEFAULT ''",
                "memberPaymentProof": "TEXT NOT NULL DEFAULT ''",
                "adminReceiptVerified": "INTEGER NOT NULL DEFAULT 0",
                "adminReceiptVerifiedAt": "TEXT NOT NULL DEFAULT ''",
                "adminReceiptProof": "TEXT NOT NULL DEFAULT ''",
                "adminPayoutVerified": "INTEGER NOT NULL DEFAULT 0",
                "adminPayoutVerifiedAt": "TEXT NOT NULL DEFAULT ''",
                "adminPayoutProof": "TEXT NOT NULL DEFAULT ''",
                "isRead": "INTEGER NOT NULL DEFAULT 0",
                "isNotified": "INTEGER NOT NULL DEFAULT 0",
                "notifiedAt": "TEXT NOT NULL DEFAULT ''",
                "reviewedBy": "TEXT NOT NULL DEFAULT ''",
                "paidAt": "TEXT NOT NULL DEFAULT ''",
                "completedAt": "TEXT NOT NULL DEFAULT ''",
                "locked": "INTEGER NOT NULL DEFAULT 0",
            }

            for column, definition in needed.items():
                self._ensure_column(conn, "claims", column, definition)

            conn.commit()

    def _ensure_column(self, conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        names = {row["name"] for row in rows}
        if column not in names:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def upsert_claim(self, claim: dict[str, Any]) -> None:
        payload = {
            "id": str(claim.get("id", "")),
            "member": str(claim.get("member", "")),
            "memberId": str(claim.get("memberId", "")),
            "plan": str(claim.get("plan", "")),
            "status": str(claim.get("status", "")),
            "note": str(claim.get("note", "")),
            "loss": str(claim.get("loss", "")),
            "proof": str(claim.get("proof", "")),
            "stack": str(claim.get("stack", "")),
            "payout": str(claim.get("payout", "")),
            "decision": str(claim.get("decision", "")),
            "updatedAt": str(claim.get("updatedAt", "")) or now_iso(),
            "createdAt": str(claim.get("createdAt", "")) or now_iso(),
            "armedAt": str(claim.get("armedAt", "")),
            "armedPlan": str(claim.get("armedPlan", "")),
            "armedStage": str(claim.get("armedStage", "")),
            "armedEnergy": str(claim.get("armedEnergy", "")),
            "armedBoosterCd": str(claim.get("armedBoosterCd", "")),
            "expiresAt": str(claim.get("expiresAt", "")),
            "odDetectedAt": str(claim.get("odDetectedAt", "")),
            "ruleCheck": str(claim.get("ruleCheck", "")),
            "detectStatus": str(claim.get("detectStatus", "")),
            "requiredPaymentItem": str(claim.get("requiredPaymentItem", "")),
            "requiredPaymentQty": str(claim.get("requiredPaymentQty", "")),
            "memberPaymentVerified": int(claim.get("memberPaymentVerified", 0) or 0),
            "memberPaymentVerifiedAt": str(claim.get("memberPaymentVerifiedAt", "")),
            "memberPaymentProof": str(claim.get("memberPaymentProof", "")),
            "adminReceiptVerified": int(claim.get("adminReceiptVerified", 0) or 0),
            "adminReceiptVerifiedAt": str(claim.get("adminReceiptVerifiedAt", "")),
            "adminReceiptProof": str(claim.get("adminReceiptProof", "")),
            "adminPayoutVerified": int(claim.get("adminPayoutVerified", 0) or 0),
            "adminPayoutVerifiedAt": str(claim.get("adminPayoutVerifiedAt", "")),
            "adminPayoutProof": str(claim.get("adminPayoutProof", "")),
            "isRead": int(claim.get("isRead", 0) or 0),
            "isNotified": int(claim.get("isNotified", 0) or 0),
            "notifiedAt": str(claim.get("notifiedAt", "")),
            "reviewedBy": str(claim.get("reviewedBy", "")),
            "paidAt": str(claim.get("paidAt", "")),
            "completedAt": str(claim.get("completedAt", "")),
            "locked": int(claim.get("locked", 0) or 0),
        }

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO claims (
                    id, member, memberId, plan, status, note, loss, proof, stack, payout,
                    decision, updatedAt, createdAt, armedAt, armedPlan, armedStage, armedEnergy,
                    armedBoosterCd, expiresAt, odDetectedAt, ruleCheck, detectStatus,
                    requiredPaymentItem, requiredPaymentQty, memberPaymentVerified, memberPaymentVerifiedAt, memberPaymentProof,
                    adminReceiptVerified, adminReceiptVerifiedAt, adminReceiptProof,
                    adminPayoutVerified, adminPayoutVerifiedAt, adminPayoutProof,
                    isRead, isNotified, notifiedAt, reviewedBy, paidAt, completedAt, locked
                )
                VALUES (
                    :id, :member, :memberId, :plan, :status, :note, :loss, :proof, :stack, :payout,
                    :decision, :updatedAt, :createdAt, :armedAt, :armedPlan, :armedStage, :armedEnergy,
                    :armedBoosterCd, :expiresAt, :odDetectedAt, :ruleCheck, :detectStatus,
                    :requiredPaymentItem, :requiredPaymentQty, :memberPaymentVerified, :memberPaymentVerifiedAt, :memberPaymentProof,
                    :adminReceiptVerified, :adminReceiptVerifiedAt, :adminReceiptProof,
                    :adminPayoutVerified, :adminPayoutVerifiedAt, :adminPayoutProof,
                    :isRead, :isNotified, :notifiedAt, :reviewedBy, :paidAt, :completedAt, :locked
                )
                ON CONFLICT(id) DO UPDATE SET
                    member=excluded.member,
                    memberId=excluded.memberId,
                    plan=excluded.plan,
                    status=excluded.status,
                    note=excluded.note,
                    loss=excluded.loss,
                    proof=excluded.proof,
                    stack=excluded.stack,
                    payout=excluded.payout,
                    decision=excluded.decision,
                    updatedAt=excluded.updatedAt,
                    createdAt=COALESCE(NULLIF(claims.createdAt, ''), excluded.createdAt),
                    armedAt=excluded.armedAt,
                    armedPlan=excluded.armedPlan,
                    armedStage=excluded.armedStage,
                    armedEnergy=excluded.armedEnergy,
                    armedBoosterCd=excluded.armedBoosterCd,
                    expiresAt=excluded.expiresAt,
                    odDetectedAt=excluded.odDetectedAt,
                    ruleCheck=excluded.ruleCheck,
                    detectStatus=excluded.detectStatus,
                    requiredPaymentItem=excluded.requiredPaymentItem,
                    requiredPaymentQty=excluded.requiredPaymentQty,
                    memberPaymentVerified=excluded.memberPaymentVerified,
                    memberPaymentVerifiedAt=excluded.memberPaymentVerifiedAt,
                    memberPaymentProof=excluded.memberPaymentProof,
                    adminReceiptVerified=excluded.adminReceiptVerified,
                    adminReceiptVerifiedAt=excluded.adminReceiptVerifiedAt,
                    adminReceiptProof=excluded.adminReceiptProof,
                    adminPayoutVerified=excluded.adminPayoutVerified,
                    adminPayoutVerifiedAt=excluded.adminPayoutVerifiedAt,
                    adminPayoutProof=excluded.adminPayoutProof,
                    isRead=excluded.isRead,
                    isNotified=excluded.isNotified,
                    notifiedAt=excluded.notifiedAt,
                    reviewedBy=excluded.reviewedBy,
                    paidAt=excluded.paidAt,
                    completedAt=excluded.completedAt,
                    locked=excluded.locked
                """,
                payload,
            )
            conn.commit()

    def get_claim(self, claim_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
            return dict(row) if row else None

    def list_claims(
        self,
        unread_only: bool = False,
        member_id: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM claims WHERE 1=1"
        params: list[Any] = []

        if unread_only:
            query += " AND isRead = 0"
        if member_id:
            query += " AND memberId = ?"
            params.append(member_id)
        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY updatedAt DESC, rowid DESC"

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def mark_read(self, claim_id: str, is_read: bool = True) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE claims SET isRead = ?, updatedAt = ? WHERE id = ?",
                (1 if is_read else 0, now_iso(), claim_id),
            )
            conn.commit()

    def mark_notified(self, claim_id: str, is_notified: bool = True, notified_at: str = "") -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE claims
                SET isNotified = ?, notifiedAt = ?, updatedAt = ?
                WHERE id = ?
                """,
                (1 if is_notified else 0, notified_at or "", now_iso(), claim_id),
            )
            conn.commit()

    @staticmethod
    def _qty_to_int(value: Any) -> int:
        text = str(value or "").strip()
        if not text:
            return 0
        match = re.search(r"-?\d+", text.replace(",", ""))
        return int(match.group(0)) if match else 0

    def get_financial_summary(self) -> dict[str, Any]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    id,
                    member,
                    memberId,
                    plan,
                    status,
                    requiredPaymentItem,
                    requiredPaymentQty,
                    memberPaymentVerified,
                    adminReceiptVerified,
                    adminPayoutVerified,
                    updatedAt,
                    createdAt
                FROM claims
                ORDER BY updatedAt DESC, rowid DESC
                """
            ).fetchall()

        total_verified_xanax = 0
        verified_receipts_count = 0
        member_verified_count = 0
        payout_verified_count = 0
        plan_totals: dict[str, int] = {}

        for row in rows:
            item = str(row["requiredPaymentItem"] or "").strip().lower()
            qty = self._qty_to_int(row["requiredPaymentQty"])
            if item != "xanax" or qty <= 0:
                continue

            plan_name = str(row["plan"] or "Unknown").strip() or "Unknown"

            if int(row["memberPaymentVerified"] or 0):
                member_verified_count += 1

            if int(row["adminPayoutVerified"] or 0):
                payout_verified_count += 1

            if not int(row["adminReceiptVerified"] or 0):
                continue

            verified_receipts_count += 1
            total_verified_xanax += qty
            plan_totals[plan_name] = plan_totals.get(plan_name, 0) + qty

        faction_share = round(total_verified_xanax * 0.15, 2)
        insurance_pool = round(total_verified_xanax - faction_share, 2)

        return {
            "verified_xanax_in": total_verified_xanax,
            "faction_cut_percent": 15,
            "faction_cut_xanax": faction_share,
            "insurance_pool_xanax": insurance_pool,
            "verified_receipts_count": verified_receipts_count,
            "member_payment_verified_count": member_verified_count,
            "admin_payout_verified_count": payout_verified_count,
            "plan_totals": dict(sorted(plan_totals.items())),
        }

    def get_setting(self, key: str, default: str = "") -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT key, value, updatedAt, updatedBy, updatedById FROM app_settings WHERE key = ?",
                (str(key),),
            ).fetchone()
            if not row:
                return {
                    "key": str(key),
                    "value": default,
                    "updatedAt": "",
                    "updatedBy": "",
                    "updatedById": "",
                }
            return dict(row)

    def set_setting(self, key: str, value: str, updated_by: str = "", updated_by_id: str = "") -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO app_settings (key, value, updatedAt, updatedBy, updatedById)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value=excluded.value,
                    updatedAt=excluded.updatedAt,
                    updatedBy=excluded.updatedBy,
                    updatedById=excluded.updatedById
                """,
                (str(key), str(value), now_iso(), str(updated_by or ""), str(updated_by_id or "")),
            )
            conn.commit()

    def get_war_tab_state(self) -> dict[str, Any]:
        row = self.get_setting("war_tab_enabled", "")
        if not str(row.get("value", "")).strip():
            row = self.get_setting("war_tab_enabled", "0")
        value = str(row.get("value", "0")).strip().lower()
        enabled = 1 if value in {"1", "true", "yes", "on"} else 0
        return {
            "enabled": enabled,
            "updatedAt": str(row.get("updatedAt", "")),
            "updatedBy": str(row.get("updatedBy", "")),
            "updatedById": str(row.get("updatedById", "")),
        }

    def set_war_tab_state(self, enabled: int | bool, updated_by: str = "", updated_by_id: str = "") -> None:
        self.set_setting(
            "war_tab_enabled",
            "1" if int(enabled or 0) else "0",
            updated_by=updated_by,
            updated_by_id=updated_by_id,
        )


    def get_xanax_request_state(self) -> dict[str, Any]:
        total_row = self.get_setting("xanax_request_total_owed", "0")
        req_row = self.get_setting("xanax_request_requested", "0")
        req_at_row = self.get_setting("xanax_request_requested_at", "")
        req_by_row = self.get_setting("xanax_request_requested_by", "")
        req_by_id_row = self.get_setting("xanax_request_requested_by_id", "")
        sent_at_row = self.get_setting("xanax_request_sent_at", "")
        sent_by_row = self.get_setting("xanax_request_sent_by", "")
        sent_by_id_row = self.get_setting("xanax_request_sent_by_id", "")
        reset_at_row = self.get_setting("xanax_request_reset_at", "")
        reset_by_row = self.get_setting("xanax_request_reset_by", "")
        reset_by_id_row = self.get_setting("xanax_request_reset_by_id", "")
        status_row = self.get_setting("xanax_request_status", "idle")

        def _num(text: str) -> float:
            try:
                return float(str(text or "0").strip())
            except Exception:
                return 0.0

        return {
            "totalOwed": _num(total_row.get("value", "0")),
            "requested": str(req_row.get("value", "0")).strip().lower() in {"1", "true", "yes", "on"},
            "requestedAt": str(req_at_row.get("value", "")),
            "requestedBy": str(req_by_row.get("value", "")),
            "requestedById": str(req_by_id_row.get("value", "")),
            "sentAt": str(sent_at_row.get("value", "")),
            "sentBy": str(sent_by_row.get("value", "")),
            "sentById": str(sent_by_id_row.get("value", "")),
            "resetAt": str(reset_at_row.get("value", "")),
            "resetBy": str(reset_by_row.get("value", "")),
            "resetById": str(reset_by_id_row.get("value", "")),
            "status": str(status_row.get("value", "idle")) or "idle",
        }

    def request_xanax_cut(self, total_owed: float | int, requested_by: str = "", requested_by_id: str = "") -> None:
        self.set_setting("xanax_request_total_owed", str(float(total_owed or 0)), updated_by=requested_by, updated_by_id=requested_by_id)
        self.set_setting("xanax_request_requested", "1", updated_by=requested_by, updated_by_id=requested_by_id)
        self.set_setting("xanax_request_requested_at", now_iso(), updated_by=requested_by, updated_by_id=requested_by_id)
        self.set_setting("xanax_request_requested_by", str(requested_by or ""), updated_by=requested_by, updated_by_id=requested_by_id)
        self.set_setting("xanax_request_requested_by_id", str(requested_by_id or ""), updated_by=requested_by, updated_by_id=requested_by_id)
        self.set_setting("xanax_request_status", "requested", updated_by=requested_by, updated_by_id=requested_by_id)

    def mark_xanax_cut_sent(self, sent_by: str = "", sent_by_id: str = "") -> None:
        self.set_setting("xanax_request_status", "sent", updated_by=sent_by, updated_by_id=sent_by_id)
        self.set_setting("xanax_request_sent_at", now_iso(), updated_by=sent_by, updated_by_id=sent_by_id)
        self.set_setting("xanax_request_sent_by", str(sent_by or ""), updated_by=sent_by, updated_by_id=sent_by_id)
        self.set_setting("xanax_request_sent_by_id", str(sent_by_id or ""), updated_by=sent_by, updated_by_id=sent_by_id)

    def reset_xanax_cut(self, reset_by: str = "", reset_by_id: str = "") -> None:
        self.set_setting("xanax_request_total_owed", "0", updated_by=reset_by, updated_by_id=reset_by_id)
        self.set_setting("xanax_request_requested", "0", updated_by=reset_by, updated_by_id=reset_by_id)
        self.set_setting("xanax_request_status", "idle", updated_by=reset_by, updated_by_id=reset_by_id)
        self.set_setting("xanax_request_reset_at", now_iso(), updated_by=reset_by, updated_by_id=reset_by_id)
        self.set_setting("xanax_request_reset_by", str(reset_by or ""), updated_by=reset_by, updated_by_id=reset_by_id)
        self.set_setting("xanax_request_reset_by_id", str(reset_by_id or ""), updated_by=reset_by, updated_by_id=reset_by_id)




    def upsert_activation(self, activation: dict[str, Any]) -> None:
        payload = {
            "id": str(activation.get("id", "")),
            "member": str(activation.get("member", "")),
            "memberId": str(activation.get("memberId", "")),
            "plan": str(activation.get("plan", "")),
            "stage": str(activation.get("stage", "")),
            "status": str(activation.get("status", "")),
            "requiredPaymentItem": str(activation.get("requiredPaymentItem", "")),
            "requiredPaymentQty": str(activation.get("requiredPaymentQty", "")),
            "paymentNote": str(activation.get("paymentNote", "")),
            "memberPaymentVerified": int(activation.get("memberPaymentVerified", 0) or 0),
            "memberPaymentVerifiedAt": str(activation.get("memberPaymentVerifiedAt", "")),
            "adminReceiptVerified": int(activation.get("adminReceiptVerified", 0) or 0),
            "adminReceiptVerifiedAt": str(activation.get("adminReceiptVerifiedAt", "")),
            "reviewedBy": str(activation.get("reviewedBy", "")),
            "reviewNote": str(activation.get("reviewNote", "")),
            "createdAt": str(activation.get("createdAt", "")) or now_iso(),
            "updatedAt": str(activation.get("updatedAt", "")) or now_iso(),
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO activation_requests (
                    id, member, memberId, plan, stage, status,
                    requiredPaymentItem, requiredPaymentQty, paymentNote,
                    memberPaymentVerified, memberPaymentVerifiedAt,
                    adminReceiptVerified, adminReceiptVerifiedAt,
                    reviewedBy, reviewNote, createdAt, updatedAt
                )
                VALUES (
                    :id, :member, :memberId, :plan, :stage, :status,
                    :requiredPaymentItem, :requiredPaymentQty, :paymentNote,
                    :memberPaymentVerified, :memberPaymentVerifiedAt,
                    :adminReceiptVerified, :adminReceiptVerifiedAt,
                    :reviewedBy, :reviewNote, :createdAt, :updatedAt
                )
                ON CONFLICT(id) DO UPDATE SET
                    member=excluded.member,
                    memberId=excluded.memberId,
                    plan=excluded.plan,
                    stage=excluded.stage,
                    status=excluded.status,
                    requiredPaymentItem=excluded.requiredPaymentItem,
                    requiredPaymentQty=excluded.requiredPaymentQty,
                    paymentNote=excluded.paymentNote,
                    memberPaymentVerified=excluded.memberPaymentVerified,
                    memberPaymentVerifiedAt=excluded.memberPaymentVerifiedAt,
                    adminReceiptVerified=excluded.adminReceiptVerified,
                    adminReceiptVerifiedAt=excluded.adminReceiptVerifiedAt,
                    reviewedBy=excluded.reviewedBy,
                    reviewNote=excluded.reviewNote,
                    createdAt=COALESCE(NULLIF(activation_requests.createdAt, ''), excluded.createdAt),
                    updatedAt=excluded.updatedAt
                """,
                payload,
            )
            conn.commit()

    def get_activation(self, activation_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM activation_requests WHERE id = ?", (activation_id,)).fetchone()
            return dict(row) if row else None

    def list_activations(self, member_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM activation_requests WHERE 1=1"
        params: list[Any] = []
        if member_id:
            query += " AND memberId = ?"
            params.append(member_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY updatedAt DESC, rowid DESC"
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def get_alert_counts(self) -> dict[str, int]:
        with self._connect() as conn:
            unread_claims = conn.execute("SELECT COUNT(*) AS c FROM claims WHERE isRead = 0").fetchone()["c"]
            pending_activations = conn.execute("SELECT COUNT(*) AS c FROM activation_requests WHERE status IN ('Pending verification','Pending receipt','Awaiting review')").fetchone()["c"]
            return {
                "unreadClaims": int(unread_claims or 0),
                "pendingActivations": int(pending_activations or 0),
            }


    def touch_script_user(self, member_id: str, member: str = "", role: str = "", platform: str = "") -> None:
        member_id = str(member_id or "").strip()
        if not member_id:
            return
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO script_users (memberId, member, role, platform, lastSeenAt, createdAt)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(memberId) DO UPDATE SET
                    member=excluded.member,
                    role=excluded.role,
                    platform=excluded.platform,
                    lastSeenAt=excluded.lastSeenAt
                """,
                (member_id, str(member or ""), str(role or ""), str(platform or ""), now, now),
            )
            conn.commit()

    def count_script_users(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM script_users").fetchone()
            return int((row["n"] if row else 0) or 0)

class ClaimHistoryStore(BaseStore):
    def __init__(self, db_path: str) -> None:
        super().__init__(db_path)
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS claim_history (
                    historyId INTEGER PRIMARY KEY AUTOINCREMENT,
                    claimId TEXT NOT NULL DEFAULT '',
                    at TEXT NOT NULL DEFAULT '',
                    text TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_claim_id ON claim_history(claimId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_at ON claim_history(at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activation_member_id ON activation_requests(memberId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activation_status ON activation_requests(status)")
            conn.commit()

    def add_entry(self, claim_id: str, text: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO claim_history (claimId, at, text) VALUES (?, ?, ?)",
                (str(claim_id or ""), now_iso(), str(text or "")),
            )
            conn.commit()

    def list_history(self, claim_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT claimId, at, text
                FROM claim_history
                WHERE claimId = ?
                ORDER BY historyId DESC
                """,
                (str(claim_id or ""),),
            ).fetchall()
            return [dict(r) for r in rows]

    def list_recent(self, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 100), 500))
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT claimId, at, text
                FROM claim_history
                ORDER BY historyId DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]


    def get_warstack_state(self) -> dict[str, Any]:
        return self.get_war_tab_state()

    def set_warstack_state(self, enabled: int | bool, updated_by: str = "", updated_by_id: str = "") -> None:
        self.set_war_tab_state(enabled, updated_by=updated_by, updated_by_id=updated_by_id)
