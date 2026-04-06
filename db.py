import sqlite3
from pathlib import Path

DB_PATH = Path("insurance.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        premium_amount INTEGER NOT NULL DEFAULT 0,
        payout_amount INTEGER NOT NULL DEFAULT 0,
        min_count INTEGER NOT NULL DEFAULT 1,
        max_count INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        torn_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        faction_id INTEGER NOT NULL,
        plan_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(torn_id, plan_key)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        torn_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        faction_id INTEGER NOT NULL,
        plan_key TEXT NOT NULL,
        jump_count INTEGER NOT NULL DEFAULT 1,
        proof_text TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        requested_amount INTEGER NOT NULL DEFAULT 0,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


def seed_plans():
    conn = get_conn()
    cur = conn.cursor()

    plans = [
        ("xanax_stack", "Xanax Stack", "Coverage for a full 4-stack of Xanax", 1000000, 4000000, 4, 4),
        ("jump_1_4", "1–4 Jumps", "Coverage for 1 to 4 jump sizes", 250000, 1000000, 1, 4),
        ("xanax_only", "Single Xanax", "Coverage for a single Xanax use", 100000, 400000, 1, 1),
    ]

    for plan in plans:
        cur.execute("""
        INSERT OR IGNORE INTO insurance_plans
        (plan_key, title, description, premium_amount, payout_amount, min_count, max_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, plan)

    conn.commit()
    conn.close()


def get_plans():
    conn = get_conn()
    rows = conn.execute("""
        SELECT *
        FROM insurance_plans
        WHERE is_active = 1
        ORDER BY id ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_plan(plan_key):
    conn = get_conn()
    row = conn.execute("""
        SELECT *
        FROM insurance_plans
        WHERE plan_key = ? AND is_active = 1
        LIMIT 1
    """, (plan_key,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_member_plan(torn_id, plan_key=None):
    conn = get_conn()

    if plan_key:
        row = conn.execute("""
            SELECT *
            FROM insurance_members
            WHERE torn_id = ? AND plan_key = ?
            LIMIT 1
        """, (torn_id, plan_key)).fetchone()
        conn.close()
        return dict(row) if row else None

    rows = conn.execute("""
        SELECT *
        FROM insurance_members
        WHERE torn_id = ?
        ORDER BY enrolled_at DESC
    """, (torn_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def enroll_member(torn_id, name, faction_id, plan_key):
    conn = get_conn()
    cur = conn.cursor()

    existing = cur.execute("""
        SELECT id, status
        FROM insurance_members
        WHERE torn_id = ? AND plan_key = ?
        LIMIT 1
    """, (torn_id, plan_key)).fetchone()

    if existing:
        cur.execute("""
            UPDATE insurance_members
            SET name = ?, faction_id = ?, status = 'active'
            WHERE id = ?
        """, (name, faction_id, existing["id"]))
    else:
        cur.execute("""
            INSERT INTO insurance_members (torn_id, name, faction_id, plan_key, status)
            VALUES (?, ?, ?, ?, 'active')
        """, (torn_id, name, faction_id, plan_key))

    conn.commit()
    conn.close()


def create_claim(torn_id, name, faction_id, plan_key, jump_count, proof_text, requested_amount):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO insurance_claims
        (torn_id, name, faction_id, plan_key, jump_count, proof_text, requested_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (torn_id, name, faction_id, plan_key, jump_count, proof_text, requested_amount))

    claim_id = cur.lastrowid
    conn.commit()
    conn.close()
    return claim_id


def get_member_claims(torn_id, plan_key=None):
    conn = get_conn()

    if plan_key:
        rows = conn.execute("""
            SELECT *
            FROM insurance_claims
            WHERE torn_id = ? AND plan_key = ?
            ORDER BY created_at DESC
        """, (torn_id, plan_key)).fetchall()
    else:
        rows = conn.execute("""
            SELECT *
            FROM insurance_claims
            WHERE torn_id = ?
            ORDER BY created_at DESC
        """, (torn_id,)).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_all_claims():
    conn = get_conn()
    rows = conn.execute("""
        SELECT *
        FROM insurance_claims
        ORDER BY created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_claim_status(claim_id, status, reviewed_by):
    conn = get_conn()
    conn.execute("""
        UPDATE insurance_claims
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (status, reviewed_by, claim_id))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    seed_plans()
    print("Database initialized.")
