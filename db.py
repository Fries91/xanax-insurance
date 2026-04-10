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

            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_member_id ON claims(memberId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_is_read ON claims(isRead)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_updated_at ON claims(updatedAt)")
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
        text = str(value or '').strip()
        if not text:
            return 0
        match = re.search(r'-?\d+', text.replace(',', ''))
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
            item = str(row['requiredPaymentItem'] or '').strip().lower()
            qty = self._qty_to_int(row['requiredPaymentQty'])
            if item != 'xanax' or qty <= 0:
                continue

            plan_name = str(row['plan'] or 'Unknown').strip() or 'Unknown'

            if int(row['memberPaymentVerified'] or 0):
                member_verified_count += 1

            if int(row['adminPayoutVerified'] or 0):
                payout_verified_count += 1

            if not int(row['adminReceiptVerified'] or 0):
                continue

            verified_receipts_count += 1
            total_verified_xanax += qty
            plan_totals[plan_name] = plan_totals.get(plan_name, 0) + qty

        faction_share = round(total_verified_xanax * 0.15, 2)
        insurance_pool = round(total_verified_xanax - faction_share, 2)

        return {
            'verified_xanax_in': total_verified_xanax,
            'faction_cut_percent': 15,
            'faction_cut_xanax': faction_share,
            'insurance_pool_xanax': insurance_pool,
            'verified_receipts_count': verified_receipts_count,
            'member_payment_verified_count': member_verified_count,
            'admin_payout_verified_count': payout_verified_count,
            'plan_totals': dict(sorted(plan_totals.items())),
        }


class ClaimHistoryStore(BaseStore):
    def __init__(self, db_path: str) -> None:
        super().__init__(db_path)
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS claim_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    claim_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_claim_id ON claim_history(claim_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claim_history_created ON claim_history(createdAt)")
            conn.commit()

    def add_entry(self, claim_id: str, text: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO claim_history (claim_id, text, createdAt) VALUES (?, ?, ?)",
                (claim_id, text, now_iso()),
            )
            conn.commit()

    def list_history(self, claim_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT claim_id, text, createdAt
                FROM claim_history
                WHERE claim_id = ?
                ORDER BY id DESC
                """,
                (claim_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def list_recent(self, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 100), 500))
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT claim_id, text, text, createdAt
                FROM claim_history
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [{"claim_id": r["claim_id"], "text": r["text"], "createdAt": r["createdAt"]} for r in rows]
