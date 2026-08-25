import sqlite3

import pytest

from db import SCHEMA_VERSION, get_schema_version, init_db, transaction, utcnow

EXPECTED_TABLES = {
    "schema_version",
    "users",
    "sessions",
    "import_batches",
    "cisco_accounts",
    "matches",
    "match_history",
}


def _table_names(conn):
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return {r["name"] for r in rows}


def test_all_tables_created(db):
    assert EXPECTED_TABLES.issubset(_table_names(db))


def test_schema_version_recorded(db):
    assert get_schema_version(db) == SCHEMA_VERSION


def test_init_db_is_idempotent(db):
    init_db(db)
    init_db(db)
    assert get_schema_version(db) == SCHEMA_VERSION
    count = db.execute("SELECT COUNT(*) AS c FROM schema_version").fetchone()["c"]
    assert count == 1


def test_foreign_keys_enabled(db):
    assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def _insert_match(conn, cleaned, state, status, **overrides):
    payload = {
        "entity_name_original": overrides.get("original", cleaned),
        "entity_name_cleaned": cleaned,
        "entity_state": state,
        "status": status,
        "source": "manual",
        "created_by": "tester",
        "created_at": utcnow(),
        "savm_group_id": overrides.get("savm_group_id", "G1"),
    }
    return conn.execute(
        """
        INSERT INTO matches (entity_name_original, entity_name_cleaned, entity_state,
                             status, source, created_by, created_at, savm_group_id)
        VALUES (:entity_name_original, :entity_name_cleaned, :entity_state,
                :status, :source, :created_by, :created_at, :savm_group_id)
        """,
        payload,
    )


def test_only_one_active_match_per_entity(db):
    with transaction(db):
        _insert_match(db, "ACME CORP", "CA", "active")

    with pytest.raises(sqlite3.IntegrityError):
        with transaction(db):
            _insert_match(db, "ACME CORP", "CA", "active")


def test_same_entity_allowed_in_different_states(db):
    with transaction(db):
        _insert_match(db, "ACME CORP", "CA", "active")
        _insert_match(db, "ACME CORP", "TX", "active")

    count = db.execute(
        "SELECT COUNT(*) AS c FROM matches WHERE status='active'"
    ).fetchone()["c"]
    assert count == 2


def test_multiple_rejected_rows_allowed_for_one_entity(db):
    with transaction(db):
        _insert_match(db, "ACME CORP", "CA", "rejected")
        _insert_match(db, "ACME CORP", "CA", "rejected")
        _insert_match(db, "ACME CORP", "CA", "active")

    rejected = db.execute(
        "SELECT COUNT(*) AS c FROM matches WHERE status='rejected'"
    ).fetchone()["c"]
    assert rejected == 2


def test_invalid_status_rejected(db):
    with pytest.raises(sqlite3.IntegrityError):
        with transaction(db):
            _insert_match(db, "ACME CORP", "CA", "not_a_status")


def _insert_account(conn, group_id, account_name, state):
    now = utcnow()
    return conn.execute(
        """
        INSERT INTO cisco_accounts (savm_group_id, sfdc_account_name, state,
                                    created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (group_id, account_name, state, now, now),
    )


def test_account_triple_key_blocks_exact_duplicates(db):
    with transaction(db):
        _insert_account(db, "700000008", "GAMMA RESOURCES INC", "OK")

    with pytest.raises(sqlite3.IntegrityError):
        with transaction(db):
            _insert_account(db, "700000008", "GAMMA RESOURCES INC", "OK")


def test_account_same_name_two_states_allowed(db):
    """The real export has GAMMA RESOURCES INC under one group in OK and TX."""
    with transaction(db):
        _insert_account(db, "700000008", "GAMMA RESOURCES INC", "OK")
        _insert_account(db, "700000008", "GAMMA RESOURCES INC", "TX")

    count = db.execute("SELECT COUNT(*) AS c FROM cisco_accounts").fetchone()["c"]
    assert count == 2


def test_transaction_rolls_back_on_error(db):
    with pytest.raises(ValueError):
        with transaction(db):
            _insert_match(db, "ROLLBACK CO", "NV", "active")
            raise ValueError("boom")

    count = db.execute(
        "SELECT COUNT(*) AS c FROM matches WHERE entity_name_cleaned='ROLLBACK CO'"
    ).fetchone()["c"]
    assert count == 0


def test_history_cascades_on_match_delete(db):
    with transaction(db):
        cur = _insert_match(db, "CASCADE CO", "AZ", "active")
        match_id = cur.lastrowid
        db.execute(
            """
            INSERT INTO match_history (match_id, event, actor, created_at)
            VALUES (?, 'created', 'tester', ?)
            """,
            (match_id, utcnow()),
        )

    with transaction(db):
        db.execute("DELETE FROM matches WHERE id = ?", (match_id,))

    count = db.execute("SELECT COUNT(*) AS c FROM match_history").fetchone()["c"]
    assert count == 0
