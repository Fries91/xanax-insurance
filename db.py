from __future__ import annotations

import sqlite3
from pathlib import Path
from datetime import datetime

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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS claims (
                    id TEXT PRIMARY KEY,
                    plan TEXT NOT NULL,
                    status TEXT NOT NULL,
                    note TEXT NOT NULL,
                    loss TEXT NOT NULL,
                    proof TEXT NOT NULL,
                    stack TEXT NOT NULL,
                    payout TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    member TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                )
            """)
            conn.commit()
    def upsert_claim(self, claim: dict) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO claims (id, plan, status, note, loss, proof, stack, payout, decision, member, updatedAt)
                VALUES (:id, :plan, :status, :note, :loss, :proof, :stack, :payout, :decision, :member, :updatedAt)
                ON CONFLICT(id) DO UPDATE SET
                    plan=excluded.plan, status=excluded.status, note=excluded.note, loss=excluded.loss,
                    proof=excluded.proof, stack=excluded.stack, payout=excluded.payout, decision=excluded.decision,
                    member=excluded.member, updatedAt=excluded.updatedAt
                """,
                claim,
            )
            conn.commit()
    def list_claims(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM claims ORDER BY rowid DESC").fetchall()
            return [dict(r) for r in rows]
    def get_claim(self, claim_id: str):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM claims WHERE id=?", (claim_id,)).fetchone()
            return dict(row) if row else None

class ClaimHistoryStore(BaseStore):
    def __init__(self, db_path: str) -> None:
        super().__init__(db_path)
        self._init_db()
    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS claim_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    claim_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                )
            """)
            conn.commit()
    def add_entry(self, claim_id: str, text: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO claim_history (claim_id, text, createdAt) VALUES (?, ?, ?)",
                (claim_id, text, datetime.utcnow().isoformat(timespec="seconds") + "Z"),
            )
            conn.commit()
    def list_history(self, claim_id: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT claim_id, text, createdAt FROM claim_history WHERE claim_id=? ORDER BY id DESC",
                (claim_id,),
            ).fetchall()
            return [dict(r) for r in rows]

class UsersStore(BaseStore):
    def __init__(self, db_path: str) -> None:
        super().__init__(db_path)
        self._init_db()
    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    passcode TEXT NOT NULL,
                    role TEXT NOT NULL,
                    name TEXT NOT NULL
                )
            """)
            conn.commit()
    def ensure_user(self, username: str, passcode: str, role: str, name: str) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (username, passcode, role, name)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    passcode=excluded.passcode,
                    role=excluded.role,
                    name=excluded.name
                """,
                (username, passcode, role, name),
            )
            conn.commit()
    def get_user(self, username: str, passcode: str):
        with self._connect() as conn:
            row = conn.execute(
                "SELECT username, role, name FROM users WHERE username=? AND passcode=?",
                (username, passcode),
            ).fetchone()
            return dict(row) if row else None
