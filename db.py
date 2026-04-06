import sqlite3
from pathlib import Path

DB_PATH = Path("/var/data/insurance.db")


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
        cooldown_hours INTEGER NOT NULL DEFAULT 0,
        max_pending_claims INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        torn_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        faction_id INTEGER NOT NULL,
        position TEXT DEFAULT '',
        is_admin INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        session_token TEXT,
        api_key TEXT,
        verified_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_auth_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        torn_id INTEGER NOT NULL,
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
        paid_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS insurance_payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER NOT NULL,
        torn_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        plan_key TEXT NOT NULL,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        paid_by INTEGER NOT NULL,
        paid_by_name TEXT DEFAULT '',
        payment_note TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(claim_id)
    )
    """)

    conn.commit()
    conn.close()


def seed_plans():
    conn = get_conn()
    cur = conn.cursor()

    plans = [
        (
            "xanax_stack",
            "Xanax Stack",
            "Coverage for a full 4-stack of Xanax",
            1000000,
            4000000,
            4,
            4,
            72,
            1,
        ),
        (
            "jump_1_4",
            "1–4 Jumps",
            "Coverage for 1 to 4 jump sizes",
            250000,
            1000000,
            1,
            4,
            48,
            1,
        ),
        (
            "xanax_only",
            "Single Xanax",
            "Coverage for a single Xanax use",
            100000,
            400000,
            1,
            1,
            24,
            1,
        ),
    ]

    for plan in plans:
        cur.execute("""
        INSERT OR IGNORE INTO insurance_plans
        (plan_key, title, description, premium_amount, payout_amount, min_count, max_count, cooldown_hours, max_pending_claims)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def upsert_member_auth(torn_id, name, faction_id, position, is_admin, session_token, api_key):
    conn = get_conn()
    cur = conn.cursor()

    existing = cur.execute("""
        SELECT id
        FROM insurance_members
        WHERE torn_id = ?
        LIMIT 1
    """, (torn_id,)).fetchone()

    if existing:
        cur.execute("""
            UPDATE insurance_members
            SET name = ?,
                faction_id = ?,
                position = ?,
                is_admin = ?,
                status = 'active',
                session_token = ?,
                api_key = ?,
                verified_at = CURRENT_TIMESTAMP,
                last_auth_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (name, faction_id, position, is_admin, session_token, api_key, existing["id"]))
    else:
        cur.execute("""
            INSERT INTO insurance_members
            (torn_id, name, faction_id, position, is_admin, status, session_token, api_key)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        """, (torn_id, name, faction_id, position, is_admin, session_token, api_key))

    conn.commit()
    conn.close()


def get_member_by_session(session_token):
    conn = get_conn()
    row = conn.execute("""
        SELECT *
        FROM insurance_members
        WHERE session_token = ?
        LIMIT 1
    """, (session_token,)).fetchone()
    conn.close()
    return dict(row) if row else None


def clear_member_session(session_token):
    conn = get_conn()
    conn.execute("""
        UPDATE insurance_members
        SET session_token = NULL
        WHERE session_token = ?
    """, (session_token,))
    conn.commit()
    conn.close()


def get_member_enrollment(torn_id, plan_key=None):
    conn = get_conn()

    if plan_key:
        row = conn.execute("""
            SELECT *
            FROM insurance_enrollments
            WHERE torn_id = ? AND plan_key = ?
            LIMIT 1
        """, (torn_id, plan_key)).fetchone()
        conn.close()
        return dict(row) if row else None

    rows = conn.execute("""
        SELECT *
        FROM insurance_enrollments
        WHERE torn_id = ?
        ORDER BY enrolled_at DESC
    """, (torn_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def enroll_member_plan(torn_id, plan_key):
    conn = get_conn()
    cur = conn.cursor()

    existing = cur.execute("""
        SELECT id
        FROM insurance_enrollments
        WHERE torn_id = ? AND plan_key = ?
        LIMIT 1
    """, (torn_id, plan_key)).fetchone()

    if existing:
        cur.execute("""
            UPDATE insurance_enrollments
            SET status = 'active'
            WHERE id = ?
        """, (existing["id"],))
    else:
        cur.execute("""
            INSERT INTO insurance_enrollments (torn_id, plan_key, status)
            VALUES (?, ?, 'active')
        """, (torn_id, plan_key))

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
            ORDER BY datetime(created_at) DESC, id DESC
        """, (torn_id, plan_key)).fetchall()
    else:
        rows = conn.execute("""
            SELECT *
            FROM insurance_claims
            WHERE torn_id = ?
            ORDER BY datetime(created_at) DESC, id DESC
        """, (torn_id,)).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_all_claims():
    conn = get_conn()
    rows = conn.execute("""
        SELECT *
        FROM insurance_claims
        ORDER BY datetime(created_at) DESC, id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_claim_by_id(claim_id):
    conn = get_conn()
    row = conn.execute("""
        SELECT *
        FROM insurance_claims
        WHERE id = ?
        LIMIT 1
    """, (claim_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_pending_claim_count(torn_id, plan_key):
    conn = get_conn()
    row = conn.execute("""
        SELECT COUNT(*) AS total
        FROM insurance_claims
        WHERE torn_id = ? AND plan_key = ? AND status = 'pending'
    """, (torn_id, plan_key)).fetchone()
    conn.close()
    return int(row["total"] if row else 0)


def get_latest_claim_for_plan(torn_id, plan_key):
    conn = get_conn()
    row = conn.execute("""
        SELECT *
        FROM insurance_claims
        WHERE torn_id = ? AND plan_key = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
    """, (torn_id, plan_key)).fetchone()
    conn.close()
    return dict(row) if row else None


def set_claim_status(claim_id, status, reviewed_by):
    conn = get_conn()
    conn.execute("""
        UPDATE insurance_claims
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (status, reviewed_by, claim_id))
    conn.commit()
    conn.close()


def mark_claim_paid(claim_id, paid_by, paid_by_name, payment_note=''):
    conn = get_conn()
    cur = conn.cursor()

    claim = cur.execute("""
        SELECT *
        FROM insurance_claims
        WHERE id = ?
        LIMIT 1
    """, (claim_id,)).fetchone()

    if not claim:
        conn.close()
        return None

    claim = dict(claim)

    existing_payout = cur.execute("""
        SELECT *
        FROM insurance_payouts
        WHERE claim_id = ?
        LIMIT 1
    """, (claim_id,)).fetchone()

    if existing_payout:
        conn.close()
        return "already_paid"

    cur.execute("""
        UPDATE insurance_claims
        SET status = 'paid',
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (paid_by, claim_id))

    cur.execute("""
        INSERT INTO insurance_payouts
        (claim_id, torn_id, member_name, plan_key, amount_paid, paid_by, paid_by_name, payment_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        claim_id,
        claim["torn_id"],
        claim["name"],
        claim["plan_key"],
        claim["requested_amount"],
        paid_by,
        paid_by_name,
        payment_note,
    ))

    payout_id = cur.lastrowid
    conn.commit()
    conn.close()
    return payout_id


def get_payouts_for_member(torn_id, plan_key=None):
    conn = get_conn()

    if plan_key:
        rows = conn.execute("""
            SELECT *
            FROM insurance_payouts
            WHERE torn_id = ? AND plan_key = ?
            ORDER BY datetime(created_at) DESC, id DESC
        """, (torn_id, plan_key)).fetchall()
    else:
        rows = conn.execute("""
            SELECT *
            FROM insurance_payouts
            WHERE torn_id = ?
            ORDER BY datetime(created_at) DESC, id DESC
        """, (torn_id,)).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_all_payouts():
    conn = get_conn()
    rows = conn.execute("""
        SELECT *
        FROM insurance_payouts
        ORDER BY datetime(created_at) DESC, id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    init_db()
    seed_plans()
    print("Database initialized.")
