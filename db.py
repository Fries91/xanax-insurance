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
        enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP
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
        ("xanax_only", "Xanax Only", "Coverage for a single Xanax use", 100000, 400000, 1, 1),
    ]

    for plan in plans:
        cur.execute("""
        INSERT OR IGNORE INTO insurance_plans
        (plan_key, title, description, premium_amount, payout_amount, min_count, max_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, plan)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_plans()
    print("Database initialized.")
