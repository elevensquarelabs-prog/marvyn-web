# -*- coding: utf-8 -*-
"""
Persistent memory layer for Marvyn agents.

Stores per-user: recommendations made, diagnoses, metric snapshots, and open action items.
This is what makes agents actually intelligent across sessions — they remember what they
told you, what metrics looked like then, and whether their advice worked.
"""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent / "data" / "memory.db"


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS recommendations (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            domain      TEXT NOT NULL,
            text        TEXT NOT NULL,
            metric_name TEXT,
            metric_value REAL,
            target_value REAL,
            created_at  TEXT NOT NULL,
            check_after TEXT,
            evaluated_at TEXT,
            outcome     TEXT
        );

        CREATE TABLE IF NOT EXISTS diagnoses (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            domain      TEXT NOT NULL,
            summary     TEXT NOT NULL,
            detail      TEXT,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metric_snapshots (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            domain      TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            snapshot_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS open_actions (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            domain      TEXT NOT NULL,
            action      TEXT NOT NULL,
            priority    TEXT NOT NULL DEFAULT 'medium',
            created_at  TEXT NOT NULL,
            resolved_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_rec_user    ON recommendations(user_id, domain);
        CREATE INDEX IF NOT EXISTS idx_diag_user   ON diagnoses(user_id, domain);
        CREATE INDEX IF NOT EXISTS idx_snap_user   ON metric_snapshots(user_id, metric_name);
        CREATE INDEX IF NOT EXISTS idx_action_user ON open_actions(user_id, resolved_at);
    """)
    conn.commit()


@contextmanager
def _db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _init_db(conn)
    try:
        yield conn
    finally:
        conn.close()


def _now() -> str:
    return datetime.utcnow().isoformat()


# ── Recommendations ───────────────────────────────────────────────────────────

def save_recommendation(
    user_id: str,
    domain: str,
    text: str,
    metric_name: str | None = None,
    metric_value: float | None = None,
    check_in_days: int = 30,
) -> str:
    """Save a recommendation the agent made. Returns the recommendation ID."""
    rec_id = str(uuid.uuid4())
    check_after = (datetime.utcnow() + timedelta(days=check_in_days)).isoformat()
    with _db() as conn:
        conn.execute(
            """INSERT INTO recommendations
               (id, user_id, domain, text, metric_name, metric_value, created_at, check_after)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (rec_id, user_id, domain, text, metric_name, metric_value, _now(), check_after),
        )
        conn.commit()
    return rec_id


def get_open_recommendations(user_id: str, domain: str | None = None, limit: int = 10) -> list[dict]:
    """Get recommendations that haven't been evaluated yet."""
    with _db() as conn:
        if domain:
            rows = conn.execute(
                """SELECT * FROM recommendations
                   WHERE user_id = ? AND domain = ? AND evaluated_at IS NULL
                   ORDER BY created_at DESC LIMIT ?""",
                (user_id, domain, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM recommendations
                   WHERE user_id = ? AND evaluated_at IS NULL
                   ORDER BY created_at DESC LIMIT ?""",
                (user_id, limit),
            ).fetchall()
    return [dict(r) for r in rows]


def get_due_recommendations(user_id: str) -> list[dict]:
    """Get recommendations that are due for evaluation (check_after has passed)."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT * FROM recommendations
               WHERE user_id = ? AND evaluated_at IS NULL AND check_after <= ?
               ORDER BY check_after ASC""",
            (user_id, _now()),
        ).fetchall()
    return [dict(r) for r in rows]


def evaluate_recommendation(rec_id: str, outcome: str) -> None:
    """Mark a recommendation as evaluated with outcome."""
    with _db() as conn:
        conn.execute(
            "UPDATE recommendations SET evaluated_at = ?, outcome = ? WHERE id = ?",
            (_now(), outcome, rec_id),
        )
        conn.commit()


# ── Diagnoses ─────────────────────────────────────────────────────────────────

def save_diagnosis(
    user_id: str,
    domain: str,
    summary: str,
    detail: dict[str, Any] | None = None,
) -> str:
    """Save a diagnosis the agent made (what it found)."""
    diag_id = str(uuid.uuid4())
    with _db() as conn:
        conn.execute(
            """INSERT INTO diagnoses (id, user_id, domain, summary, detail, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (diag_id, user_id, domain, summary, json.dumps(detail) if detail else None, _now()),
        )
        conn.commit()
    return diag_id


def get_recent_diagnoses(user_id: str, domain: str | None = None, days_back: int = 90) -> list[dict]:
    """Get recent diagnoses for context in future sessions."""
    since = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    with _db() as conn:
        if domain:
            rows = conn.execute(
                """SELECT * FROM diagnoses
                   WHERE user_id = ? AND domain = ? AND created_at >= ?
                   ORDER BY created_at DESC LIMIT 20""",
                (user_id, domain, since),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM diagnoses
                   WHERE user_id = ? AND created_at >= ?
                   ORDER BY created_at DESC LIMIT 20""",
                (user_id, since),
            ).fetchall()
    return [dict(r) for r in rows]


# ── Metric Snapshots ──────────────────────────────────────────────────────────

def save_metric_snapshot(
    user_id: str,
    domain: str,
    metric_name: str,
    metric_value: float,
) -> None:
    """Snapshot a key metric at a point in time (e.g. meta_roas=1.4 on 2026-03-28)."""
    with _db() as conn:
        conn.execute(
            """INSERT INTO metric_snapshots (id, user_id, domain, metric_name, metric_value, snapshot_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), user_id, domain, metric_name, metric_value, _now()),
        )
        conn.commit()


def get_metric_history(user_id: str, metric_name: str, days_back: int = 90) -> list[dict]:
    """Get historical values for a metric to show trend over time."""
    since = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    with _db() as conn:
        rows = conn.execute(
            """SELECT metric_value, snapshot_at FROM metric_snapshots
               WHERE user_id = ? AND metric_name = ? AND snapshot_at >= ?
               ORDER BY snapshot_at ASC""",
            (user_id, metric_name, since),
        ).fetchall()
    return [dict(r) for r in rows]


# ── Open Actions ──────────────────────────────────────────────────────────────

def save_action(
    user_id: str,
    domain: str,
    action: str,
    priority: str = "medium",
) -> str:
    action_id = str(uuid.uuid4())
    with _db() as conn:
        conn.execute(
            """INSERT INTO open_actions (id, user_id, domain, action, priority, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (action_id, user_id, domain, action, priority, _now()),
        )
        conn.commit()
    return action_id


def get_open_actions(user_id: str) -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            """SELECT * FROM open_actions
               WHERE user_id = ? AND resolved_at IS NULL
               ORDER BY priority DESC, created_at DESC LIMIT 20""",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def resolve_action(action_id: str) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE open_actions SET resolved_at = ? WHERE id = ?",
            (_now(), action_id),
        )
        conn.commit()


# ── Session Context (loads memory context for a new session) ──────────────────

def load_session_context(user_id: str) -> str:
    """
    Build a memory context string to inject at the start of every agent session.
    This is what makes the agent remember past conversations.
    """
    open_recs = get_open_recommendations(user_id, limit=5)
    open_acts = get_open_actions(user_id)
    recent_diags = get_recent_diagnoses(user_id, days_back=30)
    due_recs = get_due_recommendations(user_id)

    parts: list[str] = []

    if due_recs:
        parts.append("RECOMMENDATIONS DUE FOR EVALUATION:")
        for r in due_recs[:3]:
            parts.append(f"  - [{r['domain']}] {r['text']} (made {r['created_at'][:10]}, metric: {r['metric_name']}={r['metric_value']})")

    if open_recs:
        parts.append("OPEN RECOMMENDATIONS (not yet evaluated):")
        for r in open_recs[:5]:
            parts.append(f"  - [{r['domain']}] {r['text']} (made {r['created_at'][:10]})")

    if open_acts:
        parts.append("OPEN ACTION ITEMS:")
        for a in open_acts[:5]:
            parts.append(f"  - [{a['priority'].upper()}] {a['action']}")

    if recent_diags:
        parts.append("RECENT DIAGNOSES (last 30 days):")
        for d in recent_diags[:5]:
            parts.append(f"  - [{d['domain']}] {d['summary']} ({d['created_at'][:10]})")

    if not parts:
        return ""

    return "MEMORY CONTEXT FROM PREVIOUS SESSIONS:\n" + "\n".join(parts)
