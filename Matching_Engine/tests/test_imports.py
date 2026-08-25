import csv
import io

import pytest

from cisco_store import import_accounts_csv
from match_store import (
    ValidationFailedError,
    get_match_history,
    import_match_deletions_csv,
    import_matches_csv,
    list_matches,
)
from tests.test_cisco_store import _csv, _row


def _csv_bytes(headers: list[str], rows: list[list[str]]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


@pytest.fixture
def accounts(db):
    payload = _csv(
        _row(savm_id="GROUP-1", account_name="ACCOUNT ONE", state="CA", sav_name="GROUP ONE"),
        _row(savm_id="GROUP-2", account_name="ACCOUNT TWO", state="CA", sav_name="GROUP TWO"),
        # Two accounts under one group: a group-only reference is ambiguous.
        _row(savm_id="GROUP-MULTI", account_name="CHILD A", state="CA", sav_name="GROUP MULTI"),
        _row(savm_id="GROUP-MULTI", account_name="CHILD B", state="TX", sav_name="GROUP MULTI"),
    )
    import_accounts_csv(db, payload, "accounts.csv", actor="admin")
    return db


MATCH_HEADERS = [
    "entity_name_original",
    "entity_name_cleaned",
    "savm_group_id",
    "sfdc_account_name",
    "account_state",
    "entity_state",
    "notes",
]


# ---------------------------------------------------------------- match import

def test_group_level_import_succeeds(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [["Alpha Original", "ALPHA", "GROUP-1", "", "", "CA", "historical"]],
    )
    summary = import_matches_csv(accounts, payload, "matches.csv", "admin")

    assert summary["row_count"] == 1
    assert summary["inserted"] == 1
    assert summary["failed"] == 0

    item = list_matches(accounts, {"status": "active"})["items"][0]
    assert item["match_level"] == "SAVM"
    assert item["savm_group_id"] == "GROUP-1"
    assert item["notes"] == "historical"
    assert item["source"] == "bulk_upload"
    assert item["source_detail"] == "matches.csv"


def test_account_level_import_records_full_reference(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [["Beta Original", "BETA", "GROUP-MULTI", "CHILD B", "TX", "CA", ""]],
    )
    summary = import_matches_csv(accounts, payload, "matches.csv", "admin")
    assert summary["inserted"] == 1

    item = list_matches(accounts, {"status": "active"})["items"][0]
    assert item["match_level"] == "SFDC"
    assert item["sfdc_account_name"] == "CHILD B"
    assert item["account_state"] == "TX"


def test_import_partial_failures_are_isolated(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [
            ["Good Row", "GOOD", "GROUP-1", "", "", "CA", "ok"],
            ["No Reference", "NOREF", "", "", "", "CA", "missing"],
            ["Unknown Group", "UNKNOWN", "NOT-A-GROUP", "", "", "CA", "unknown"],
            ["Bad Account", "BADACCT", "GROUP-MULTI", "NO SUCH CHILD", "", "CA", "bad"],
            ["Blank Names", "", "GROUP-1", "", "", "CA", "blank"],
        ],
    )
    summary = import_matches_csv(accounts, payload, "matches.csv", "admin")

    assert summary["row_count"] == 5
    assert summary["inserted"] == 1
    assert summary["failed"] == 4

    reasons = {row["reason"] for row in summary["error_report"]["rows"]}
    assert "missing_reference" in reasons
    assert "unknown_group" in reasons
    assert "unknown_account" in reasons
    assert "validation_failed" in reasons


def test_duplicate_active_match_is_skipped_not_failed(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [["Gamma Original", "GAMMA", "GROUP-1", "", "", "CA", ""]],
    )
    first = import_matches_csv(accounts, payload, "first.csv", "admin")
    second = import_matches_csv(accounts, payload, "second.csv", "admin")

    assert first["inserted"] == 1
    assert second["inserted"] == 0
    assert second["skipped"] == 1
    assert any(
        row["reason"] == "duplicate_active_match" for row in second["error_report"]["rows"]
    )


def test_import_requires_entity_columns(accounts):
    payload = _csv_bytes(["savm_group_id"], [["GROUP-1"]])
    with pytest.raises(ValidationFailedError) as exc:
        import_matches_csv(accounts, payload, "bad.csv", "admin")
    assert "entity_name_original" in str(exc.value)


def test_legacy_savm_id_header_is_accepted(accounts):
    payload = _csv_bytes(
        ["entity_name_original", "entity_name_cleaned", "savm_id", "entity_state"],
        [["Delta Original", "DELTA", "GROUP-2", "CA"]],
    )
    summary = import_matches_csv(accounts, payload, "legacy.csv", "admin")
    assert summary["inserted"] == 1


def test_blank_rows_are_ignored(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [
            ["Epsilon", "EPSILON", "GROUP-1", "", "", "CA", ""],
            ["", "", "", "", "", "", ""],
        ],
    )
    summary = import_matches_csv(accounts, payload, "matches.csv", "admin")
    assert summary["row_count"] == 1
    assert summary["inserted"] == 1


def test_imported_rows_are_active_with_history(accounts):
    payload = _csv_bytes(
        MATCH_HEADERS, [["Zeta", "ZETA", "GROUP-1", "", "", "CA", ""]]
    )
    import_matches_csv(accounts, payload, "matches.csv", "admin")

    match_id = list_matches(accounts, {"status": "active"})["items"][0]["id"]
    events = [h["event"] for h in get_match_history(accounts, match_id)]
    assert events == ["created"]


# ---------------------------------------------------------------- deletions

def _seed_two_matches(conn):
    payload = _csv_bytes(
        MATCH_HEADERS,
        [
            ["Gamma Original", "GAMMA", "GROUP-1", "", "", "CA", ""],
            ["Delta Original", "DELTA", "GROUP-2", "", "", "CA", ""],
        ],
    )
    summary = import_matches_csv(conn, payload, "seed.csv", "admin")
    assert summary["inserted"] == 2
    rows = conn.execute(
        "SELECT id, entity_name_cleaned, savm_group_id FROM matches ORDER BY id ASC"
    ).fetchall()
    return rows


def test_deletion_by_match_id_and_by_name_plus_group(accounts):
    rows = _seed_two_matches(accounts)

    payload = _csv_bytes(
        ["match_id", "entity_name_cleaned", "savm_group_id", "notes"],
        [
            [str(rows[0]["id"]), "", "", "delete by id"],
            ["", rows[1]["entity_name_cleaned"], rows[1]["savm_group_id"], "delete by name"],
        ],
    )
    summary = import_match_deletions_csv(accounts, payload, "deletions.csv", "admin")

    assert summary["updated"] == 2
    assert summary["failed"] == 0

    statuses = accounts.execute("SELECT status FROM matches ORDER BY id ASC").fetchall()
    assert [s["status"] for s in statuses] == ["deleted", "deleted"]

    events = [h["event"] for h in get_match_history(accounts, rows[0]["id"])]
    assert "deleted" in events


def test_deletion_records_notes(accounts):
    rows = _seed_two_matches(accounts)
    payload = _csv_bytes(
        ["match_id", "notes"], [[str(rows[0]["id"]), "superseded by manual review"]]
    )
    import_match_deletions_csv(accounts, payload, "deletions.csv", "admin")

    history = get_match_history(accounts, rows[0]["id"])
    deleted_event = next(h for h in history if h["event"] == "deleted")
    assert deleted_event["notes"] == "superseded by manual review"


def test_deletion_failures_are_reported(accounts):
    _seed_two_matches(accounts)
    payload = _csv_bytes(
        ["match_id", "entity_name_cleaned", "savm_group_id", "notes"],
        [
            ["not-an-int", "", "", ""],
            ["", "", "", "no reference at all"],
            ["", "GHOST ENTITY", "GROUP-1", "not in library"],
        ],
    )
    summary = import_match_deletions_csv(accounts, payload, "deletions.csv", "admin")

    assert summary["updated"] == 0
    assert summary["failed"] == 3
    reasons = {row["reason"] for row in summary["error_report"]["rows"]}
    assert "validation_failed" in reasons
    assert "missing_reference" in reasons
    assert "not_found" in reasons


def test_deletion_is_soft(accounts):
    rows = _seed_two_matches(accounts)
    payload = _csv_bytes(["match_id"], [[str(rows[0]["id"])]])
    import_match_deletions_csv(accounts, payload, "deletions.csv", "admin")

    remaining = accounts.execute("SELECT COUNT(*) AS c FROM matches").fetchone()["c"]
    assert remaining == 2
