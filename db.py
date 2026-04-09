from __future__ import annotations

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
                    armedEnergy TEXT NOT NULL DEFAULT '',
                    armedBoosterCd TEXT NOT NULL DEFAULT '',
                    expiresAt TEXT NOT NULL DEFAULT '',
                    odDetectedAt TEXT NOT NULL DEFAULT '',
                    ruleCheck TEXT NOT NULL DEFAULT '',
                    detectStatus TEXT NOT NULL DEFAULT '',

                    isRead INTEGER NOT NULL DEFAULT 0,
                    isNotified INTEGER NOT NULL DEFAULT 0,
                    notifiedAt TEXT NOT NULL DEFAULT '',

                    reviewedBy TEXT NOT NULL DEFAULT '',
                    paidAt TEXT NOT NULL DEFAULT ''
                )
                """
            )

            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_member_id ON claims(memberId)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_is_read ON claims(isRead)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_claims_updated_at ON claims(updatedAt)")
            conn.commit()

            self._ensure_column(conn, "claims", "member", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "memberId", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "plan", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "status", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "note", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "loss", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "proof", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "stack", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "payout", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "decision", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "updatedAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "createdAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "armedAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "armedPlan", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "armedEnergy", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "armedBoosterCd", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "expiresAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "odDetectedAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "ruleCheck", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "detectStatus", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "isRead", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column(conn, "claims", "isNotified", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column(conn, "claims", "notifiedAt", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "reviewedBy", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(conn, "claims", "paidAt", "TEXT NOT NULL DEFAULT ''")
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
            "armedEnergy": str(claim.get("armedEnergy", "")),
            "armedBoosterCd": str(claim.get("armedBoosterCd", "")),
            "expiresAt": str(claim.get("expiresAt", "")),
            "odDetectedAt": str(claim.get("odDetectedAt", "")),
            "ruleCheck": str(claim.get("ruleCheck", "")),
            "detectStatus": str(claim.get("detectStatus", "")),

            "isRead": 1 if str(claim.get("isRead", 0)).lower() in {"1", "true", "yes"} else int(claim.get("isRead", 0) or 0),
            "isNotified": 1 if str(claim.get("isNotified", 0)).lower() in {"1", "true", "yes"} else int(claim.get("isNotified", 0) or 0),
            "notifiedAt": str(claim.get("notifiedAt", "")),

            "reviewedBy": str(claim.get("reviewedBy", "")),
            "paidAt": str(claim.get("paidAt", "")),
        }

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO claims (
                    id, member, memberId, plan, status, note, loss, proof, stack, payout,
                    decision, updatedAt, createdAt, armedAt, armedPlan, armedEnergy,
                    armedBoosterCd, expiresAt, odDetectedAt, ruleCheck, detectStatus,
                    isRead, isNotified, notifiedAt, reviewedBy, paidAt
                )
                VALUES (
                    :id, :member, :memberId, :plan, :status, :note, :loss, :proof, :stack, :payout,
                    :decision, :updatedAt, :createdAt, :armedAt, :armedPlan, :armedEnergy,
                    :armedBoosterCd, :expiresAt, :odDetectedAt, :ruleCheck, :detectStatus,
                    :isRead, :isNotified, :notifiedAt, :reviewedBy, :paidAt
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
                    armedEnergy=excluded.armedEnergy,
                    armedBoosterCd=excluded.armedBoosterCd,
                    expiresAt=excluded.expiresAt,
                    odDetectedAt=excluded.odDetectedAt,
                    ruleCheck=excluded.ruleCheck,
                    detectStatus=excluded.detectStatus,
                    isRead=excluded.isRead,
                    isNotified=excluded.isNotified,
                    notifiedAt=excluded.notifiedAt,
                    reviewedBy=excluded.reviewedBy,
                    paidAt=excluded.paidAt
                """,
                payload,
            )
            conn.commit()

    def get_claim(self, claim_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM claims WHERE id = ?",
                (claim_id,),
            ).fetchone()
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
                SELECT claim_id, text, createdAt
                FROM claim_history
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]
