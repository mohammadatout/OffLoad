"""
SQLite foundation for the OffLoad match library.

Owns connection setup, schema creation, and the transaction helper. Every other
store module builds on this and never opens its own connection.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator, Optional

SCHEMA_VERSION = 1

DEFAULT_DB_FILENAME = "offload.db"


def utcnow() -> str:
    """UTC ISO-8601 timestamp. The only time format stored in the database."""
    return datetime.now(timezone.utc).isoformat()


def resolve_db_path(db_path: Optional[str] = None) -> str:
    if db_path:
        return db_path
    env_path = os.environ.get("OFFLOAD_DB_PATH")
    if env_path:
        return env_path
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DEFAULT_DB_FILENAME)


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = resolve_db_path(db_path)
    if path != ":memory:":
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)

    # check_same_thread=False is required because FastAPI runs sync dependencies
    # on a worker thread while async endpoints execute on the event loop thread.
    # Safe here: every request gets its own connection and never shares it.
    conn = sqlite3.connect(path, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Commit on success, roll back on any exception."""
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    else:
        conn.commit()


# Ordered so that referenced tables exist before the tables that point at them.
_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER NOT NULL,
      applied_at  TEXT    NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash  TEXT    NOT NULL,
      role           TEXT    NOT NULL CHECK (role IN ('admin','reviewer')),
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL,
      created_by     TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash    TEXT    PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    TEXT    NOT NULL,
      expires_at    TEXT    NOT NULL,
      last_seen_at  TEXT    NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
    """
    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT NOT NULL PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_by  TEXT,
      updated_at  TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS import_batches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      kind            TEXT    NOT NULL CHECK (kind IN ('cisco_accounts','matches','deletions')),
      filename        TEXT    NOT NULL,
      row_count       INTEGER NOT NULL DEFAULT 0,
      inserted        INTEGER NOT NULL DEFAULT 0,
      updated         INTEGER NOT NULL DEFAULT 0,
      deactivated     INTEGER NOT NULL DEFAULT 0,
      skipped         INTEGER NOT NULL DEFAULT 0,
      skipped_blank   INTEGER NOT NULL DEFAULT 0,
      failed          INTEGER NOT NULL DEFAULT 0,
      newly_unlinked  INTEGER NOT NULL DEFAULT 0,
      error_report    TEXT,
      actor           TEXT    NOT NULL,
      created_at      TEXT    NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cisco_accounts (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,

      savm_group_id         TEXT    NOT NULL,
      savm_group_name       TEXT,
      sl1                   TEXT,
      sl2                   TEXT,
      sl3                   TEXT,
      sl4                   TEXT,
      sl5                   TEXT,
      sl6                   TEXT,
      vertical              TEXT,
      segment               TEXT,
      tier                  TEXT,
      source                TEXT,
      node_id               TEXT,

      unified_account_name  TEXT,
      sfdc_account_name     TEXT    NOT NULL DEFAULT '',
      state                 TEXT    NOT NULL DEFAULT '',
      sfdc_savm_id          TEXT,
      sfdc_acc_owner_email  TEXT,
      exists_in_sav         TEXT,
      exists_in_sfdc        TEXT,

      am_cec                TEXT,
      am_name               TEXT,
      am_email              TEXT,
      am_job_title          TEXT,
      am_confidence         TEXT,
      am_priority           INTEGER,
      am_reason             TEXT,
      am_candidate_rank     INTEGER,
      am_in_gs              TEXT,
      am_in_sfdc            TEXT,
      am_in_sav             TEXT,

      sav_people            TEXT,
      gs_all_emails         TEXT,
      gs_max_end_date       TEXT,
      edwsf_update_dtm      TEXT,

      is_active             INTEGER NOT NULL DEFAULT 1,
      import_batch_id       INTEGER REFERENCES import_batches(id),
      created_at            TEXT    NOT NULL,
      updated_at            TEXT    NOT NULL
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cisco_key
      ON cisco_accounts(savm_group_id, sfdc_account_name, state)
    """,
    "CREATE INDEX IF NOT EXISTS idx_cisco_group    ON cisco_accounts(savm_group_id)",
    "CREATE INDEX IF NOT EXISTS idx_cisco_group_nm ON cisco_accounts(savm_group_name)",
    "CREATE INDEX IF NOT EXISTS idx_cisco_acct_nm  ON cisco_accounts(sfdc_account_name)",
    "CREATE INDEX IF NOT EXISTS idx_cisco_state    ON cisco_accounts(state)",
    "CREATE INDEX IF NOT EXISTS idx_cisco_vertical ON cisco_accounts(vertical)",
    "CREATE INDEX IF NOT EXISTS idx_cisco_active   ON cisco_accounts(is_active)",
    """
    CREATE TABLE IF NOT EXISTS matches (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,

      entity_name_original  TEXT    NOT NULL,
      entity_name_cleaned   TEXT    NOT NULL,
      entity_state          TEXT    NOT NULL DEFAULT '',

      savm_group_id         TEXT,
      sfdc_account_name     TEXT,
      account_state         TEXT,
      match_level           TEXT    CHECK (match_level IN ('SAVM','SFDC')),

      snap_savm_group_name  TEXT,
      snap_account_name     TEXT,
      snap_am_name          TEXT,
      snap_am_email         TEXT,
      snap_am_confidence    TEXT,

      confidence_score      REAL,
      match_stage           TEXT,

      status                TEXT    NOT NULL CHECK (status IN
                              ('pending_admin_approval','pending_review','active','rejected','deleted')),
      notes                 TEXT,

      source                TEXT    NOT NULL CHECK (source IN ('match_run','bulk_upload','manual')),
      source_detail         TEXT,

      created_by            TEXT    NOT NULL,
      created_at            TEXT    NOT NULL,
      updated_by            TEXT,
      updated_at            TEXT,
      decided_by            TEXT,
      decided_at            TEXT,

      link_status           TEXT    NOT NULL DEFAULT 'linked'
                              CHECK (link_status IN ('linked','unlinked')),
      prev_status           TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status)",
    "CREATE INDEX IF NOT EXISTS idx_matches_cleaned ON matches(entity_name_cleaned)",
    "CREATE INDEX IF NOT EXISTS idx_matches_group   ON matches(savm_group_id)",
    "CREATE INDEX IF NOT EXISTS idx_matches_link    ON matches(link_status)",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_active_unique
      ON matches(entity_name_cleaned, entity_state)
      WHERE status = 'active'
    """,
    """
    CREATE TABLE IF NOT EXISTS match_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id      INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      event         TEXT    NOT NULL CHECK (event IN
                      ('created','approved','rejected','edited','deleted','restored','imported','unlinked')),
      from_status   TEXT,
      to_status     TEXT,
      field_changes TEXT,
      notes         TEXT,
      actor         TEXT    NOT NULL,
      created_at    TEXT    NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_history_match ON match_history(match_id)",
]


class IncompatibleSchema(Exception):
    """Raised when an existing database predates the current schema."""


# Tables whose shape changed incompatibly, mapped to a column that must exist.
# CREATE TABLE IF NOT EXISTS silently skips an out-of-date table, so without
# this check the failure surfaces later as a confusing "no such column" error.
_REQUIRED_COLUMNS = {
    "matches": "savm_group_id",
    "cisco_accounts": "savm_group_id",
}


def _assert_compatible(conn: sqlite3.Connection) -> None:
    existing = {
        row["name"]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }

    for table, column in _REQUIRED_COLUMNS.items():
        if table not in existing:
            continue
        columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            raise IncompatibleSchema(
                f"The database at this path has an outdated '{table}' table "
                f"(missing '{column}'). It predates the current schema. Delete "
                f"the offload.db* files to start fresh, or point OFFLOAD_DB_PATH "
                f"at a new file."
            )

    # A leftover table from the superseded model; its presence means stale data.
    if "savm_accounts" in existing and "cisco_accounts" not in existing:
        raise IncompatibleSchema(
            "The database contains the superseded 'savm_accounts' table. Delete "
            "the offload.db* files to start fresh."
        )


def init_db(conn: sqlite3.Connection) -> None:
    """Create the full schema. Safe to call repeatedly."""
    _assert_compatible(conn)

    with transaction(conn):
        for statement in _SCHEMA_STATEMENTS:
            conn.execute(statement)

        row = conn.execute("SELECT MAX(version) AS v FROM schema_version").fetchone()
        current = row["v"] if row and row["v"] is not None else 0
        if current < SCHEMA_VERSION:
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                (SCHEMA_VERSION, utcnow()),
            )


def get_schema_version(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT MAX(version) AS v FROM schema_version").fetchone()
    return row["v"] if row and row["v"] is not None else 0
