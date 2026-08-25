"""
Cisco account reference storage, import, and AM resolution.

The reference table is the SQL export at SFDC-account grain: one SAVM group
spans many rows. Group-level attributes repeat across a group's rows, which is
harmless because the whole table is replaced on every import.

Natural key is the triple (savm_group_id, sfdc_account_name, state). State is
part of the key because the same account name appears under one group in more
than one state.
"""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from typing import Any, Iterator, TextIO

from db import transaction, utcnow

# Source header (normalized: lowercased, whitespace collapsed) -> column name.
COLUMN_ALIASES = {
    # group level
    "savm_id": "savm_group_id",
    "sav_name": "savm_group_name",
    "sales level 1": "sl1",
    "sales level 2": "sl2",
    "sales level 3": "sl3",
    "sales level 4": "sl4",
    "sales level 5": "sl5",
    "sales level 6": "sl6",
    "sav_vertical_top": "vertical",
    "node_segment": "segment",
    "node_subsegment": "tier",
    "source": "source",
    "node_id": "node_id",
    # account level
    "unified_account_name": "unified_account_name",
    "sfdc_acc_name": "sfdc_account_name",
    "unified_state": "state",
    "sfdc_savm_id": "sfdc_savm_id",
    "sfdc_acc_owner_email": "sfdc_acc_owner_email",
    "exists_in_sav": "exists_in_sav",
    "exists_in_sfdc": "exists_in_sfdc",
    # AM nomination
    "nominated_owner_cec": "am_cec",
    "nominated_owner_name": "am_name",
    "nominated_owner_email": "am_email",
    "nominated_owner_job_title": "am_job_title",
    "confidence_level": "am_confidence",
    "nomination_priority": "am_priority",
    "nomination_reason": "am_reason",
    "candidate_rank": "am_candidate_rank",
    "nominated_owner_in_gs": "am_in_gs",
    "nominated_owner_in_sfdc": "am_in_sfdc",
    "nominated_owner_in_sav": "am_in_sav",
    # carried through, unused by the app
    "sav_people": "sav_people",
    "gs_all_emails": "gs_all_emails",
    "gs_max_end_date": "gs_max_end_date",
    "edwsf_update_dtm": "edwsf_update_dtm",
    # tolerated alternates
    "savm group id": "savm_group_id",
    "savm_group_id": "savm_group_id",
    "savm name": "savm_group_name",
    "savm_group_name": "savm_group_name",
    "sfdc name": "sfdc_account_name",
    "sfdc_account_name": "sfdc_account_name",
    "state": "state",
    "vertical": "vertical",
    "tier": "tier",
}

ACCOUNT_FIELDS = (
    "savm_group_id",
    "savm_group_name",
    "sl1",
    "sl2",
    "sl3",
    "sl4",
    "sl5",
    "sl6",
    "vertical",
    "segment",
    "tier",
    "source",
    "node_id",
    "unified_account_name",
    "sfdc_account_name",
    "state",
    "sfdc_savm_id",
    "sfdc_acc_owner_email",
    "exists_in_sav",
    "exists_in_sfdc",
    "am_cec",
    "am_name",
    "am_email",
    "am_job_title",
    "am_confidence",
    "am_priority",
    "am_reason",
    "am_candidate_rank",
    "am_in_gs",
    "am_in_sfdc",
    "am_in_sav",
    "sav_people",
    "gs_all_emails",
    "gs_max_end_date",
    "edwsf_update_dtm",
)

INTEGER_FIELDS = ("am_priority", "am_candidate_rank")
REQUIRED_COLUMNS = {"savm_group_id"}
CHUNK_SIZE = 1000


class CiscoStoreError(Exception):
    """Base exception for Cisco account store operations."""


class ValidationFailedError(CiscoStoreError):
    """Raised for invalid import input."""


class UnknownAccountReference(CiscoStoreError):
    """Raised when no account matches a reference."""


class AmbiguousAccountReference(CiscoStoreError):
    """Raised when a reference resolves to more than one account."""


def _normalize_header(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _clean_cell(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _as_optional_int(value: Any) -> int | None:
    cleaned = _clean_cell(value)
    if cleaned is None:
        return None
    try:
        return int(float(cleaned))
    except (TypeError, ValueError):
        return None


def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["account_id"] = item.get("id")
    return item


def _to_error_report(warnings: list[str], row_issues: list[dict[str, Any]]) -> str | None:
    if not warnings and not row_issues:
        return None
    return json.dumps({"warnings": warnings, "rows": row_issues})


def _parse_error_report(raw_report: str | None) -> dict[str, Any]:
    if not raw_report:
        return {"warnings": [], "rows": []}
    return json.loads(raw_report)


def _decode_csv(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationFailedError("CSV must be valid UTF-8 text.") from exc


def _resolve_headers(fieldnames: list[str]) -> tuple[dict[str, list[str]], list[str]]:
    mapped: dict[str, list[str]] = {}
    unrecognized: list[str] = []

    for header in fieldnames:
        if header is None:
            continue
        canonical = COLUMN_ALIASES.get(_normalize_header(header))
        if canonical is None:
            unrecognized.append(header)
            continue
        mapped.setdefault(canonical, []).append(header)

    return mapped, unrecognized


def _extract_row(
    raw_row: dict[str, Any], mapped_headers: dict[str, list[str]]
) -> dict[str, Any]:
    record: dict[str, Any] = {}
    for field in ACCOUNT_FIELDS:
        value: str | None = None
        for original_header in mapped_headers.get(field, []):
            candidate = _clean_cell(raw_row.get(original_header))
            if candidate is not None:
                value = candidate
                break
        record[field] = value

    for field in INTEGER_FIELDS:
        record[field] = _as_optional_int(record[field])

    # Part of the unique key, so never NULL.
    record["sfdc_account_name"] = record["sfdc_account_name"] or ""
    record["state"] = record["state"] or ""
    return record


def _is_blank_row(raw_row: dict[str, Any]) -> bool:
    return all(_clean_cell(value) is None for value in raw_row.values())


_INSERT_SQL = f"""
INSERT INTO cisco_accounts (
    {", ".join(ACCOUNT_FIELDS)}, is_active, import_batch_id, created_at, updated_at
) VALUES ({", ".join("?" for _ in ACCOUNT_FIELDS)}, 1, ?, ?, ?)
ON CONFLICT(savm_group_id, sfdc_account_name, state) DO UPDATE SET
    {", ".join(
        f"{field} = excluded.{field}"
        for field in ACCOUNT_FIELDS
        if field not in ("savm_group_id", "sfdc_account_name", "state")
    )},
    is_active = 1,
    import_batch_id = excluded.import_batch_id,
    updated_at = excluded.updated_at
"""


def _existing_keys(conn: sqlite3.Connection) -> set[tuple[str, str, str]]:
    rows = conn.execute(
        "SELECT savm_group_id, sfdc_account_name, state FROM cisco_accounts"
    )
    return {
        (row["savm_group_id"], row["sfdc_account_name"], row["state"]) for row in rows
    }


def _chunks(iterable: Iterator[Any], size: int) -> Iterator[list[Any]]:
    batch: list[Any] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def import_accounts_csv(
    conn: sqlite3.Connection,
    file_bytes: bytes,
    filename: str,
    actor: str = "system",
) -> dict[str, Any]:
    """Replace the reference table from CSV bytes.

    Convenience wrapper for callers that already hold the whole file. Prefer
    `import_accounts_stream` for uploads: real exports run to hundreds of
    megabytes and there is no reason to hold one in memory.
    """
    return import_accounts_stream(
        conn, io.StringIO(_decode_csv(file_bytes)), filename, actor
    )


def import_accounts_stream(
    conn: sqlite3.Connection,
    text_stream: TextIO,
    filename: str,
    actor: str = "system",
) -> dict[str, Any]:
    """Replace the Cisco account reference table from a CSV text stream.

    Rows are consumed lazily and inserted in chunks, so peak memory stays flat
    regardless of file size.
    """
    reader = csv.DictReader(text_stream)
    if reader.fieldnames is None:
        raise ValidationFailedError("CSV must include a header row.")

    mapped_headers, unrecognized_headers = _resolve_headers(reader.fieldnames)
    missing_required = REQUIRED_COLUMNS.difference(mapped_headers.keys())
    if missing_required:
        missing = ", ".join(sorted(missing_required))
        raise ValidationFailedError(f"Missing required columns: {missing}")

    warnings: list[str] = []
    if unrecognized_headers:
        warnings.append(
            "Ignored unrecognized columns: " + ", ".join(unrecognized_headers)
        )

    row_issues: list[dict[str, Any]] = []
    row_count = 0
    inserted = 0
    updated = 0
    skipped_blank = 0
    failed = 0
    duplicate_in_file = 0

    now = utcnow()

    with transaction(conn):
        batch_result = conn.execute(
            """
            INSERT INTO import_batches (kind, filename, actor, created_at)
            VALUES ('cisco_accounts', ?, ?, ?)
            """,
            (filename, actor, now),
        )
        batch_id = int(batch_result.lastrowid)

        known_keys = _existing_keys(conn)
        seen_keys: set[tuple[str, str, str]] = set()

        deactivate_cur = conn.execute(
            "UPDATE cisco_accounts SET is_active = 0, updated_at = ? WHERE is_active = 1",
            (now,),
        )
        previously_active = deactivate_cur.rowcount or 0

        def _pending_rows() -> Iterator[tuple]:
            nonlocal row_count, inserted, updated, skipped_blank, failed
            nonlocal duplicate_in_file

            for row_number, raw_row in enumerate(reader, start=2):
                row_count += 1

                if _is_blank_row(raw_row):
                    skipped_blank += 1
                    continue

                record = _extract_row(raw_row, mapped_headers)
                if not record["savm_group_id"]:
                    failed += 1
                    if len(row_issues) < 500:
                        row_issues.append(
                            {
                                "row": row_number,
                                "reason": "missing_savm_group_id",
                                "status": "failed",
                            }
                        )
                    continue

                key = (
                    record["savm_group_id"],
                    record["sfdc_account_name"],
                    record["state"],
                )
                if key in seen_keys:
                    duplicate_in_file += 1
                    if len(row_issues) < 500:
                        row_issues.append(
                            {
                                "row": row_number,
                                "reason": "duplicate_in_file",
                                "status": "overwritten",
                            }
                        )
                else:
                    seen_keys.add(key)
                    if key in known_keys:
                        updated += 1
                    else:
                        inserted += 1

                yield tuple(
                    [record[field] for field in ACCOUNT_FIELDS] + [batch_id, now, now]
                )

        for chunk in _chunks(_pending_rows(), CHUNK_SIZE):
            conn.executemany(_INSERT_SQL, chunk)

        deactivated = max(previously_active - updated, 0)

        conn.execute(
            """
            UPDATE import_batches
            SET row_count = ?, inserted = ?, updated = ?, deactivated = ?,
                skipped = ?, skipped_blank = ?, failed = ?, error_report = ?
            WHERE id = ?
            """,
            (
                row_count,
                inserted,
                updated,
                deactivated,
                duplicate_in_file,
                skipped_blank,
                failed,
                _to_error_report(warnings, row_issues),
                batch_id,
            ),
        )

    newly_unlinked = flag_orphan_matches(conn, actor=actor)
    with transaction(conn):
        conn.execute(
            "UPDATE import_batches SET newly_unlinked = ? WHERE id = ?",
            (newly_unlinked, batch_id),
        )

    return get_import_batch(conn, batch_id)


def get_import_batch(conn: sqlite3.Connection, batch_id: int) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM import_batches WHERE id = ?", (batch_id,)
    ).fetchone()
    if row is None:
        raise CiscoStoreError("Import batch not found.")
    summary = dict(row)
    summary["error_report"] = _parse_error_report(summary.get("error_report"))
    return summary


def flag_orphan_matches(conn: sqlite3.Connection, actor: str = "system") -> int:
    """Mark matches whose SAVM group is no longer active as unlinked.

    Matches are never deleted or auto-rejected when a group disappears from the
    reference export; they are flagged so a human can decide. A later import
    that restores the group automatically re-links them.
    """
    orphans = conn.execute(
        """
        SELECT m.id
        FROM matches m
        WHERE m.savm_group_id IS NOT NULL
          AND m.link_status = 'linked'
          AND m.status != 'deleted'
          AND NOT EXISTS (
            SELECT 1 FROM cisco_accounts c
            WHERE c.savm_group_id = m.savm_group_id AND c.is_active = 1
          )
        """
    ).fetchall()

    relinked = conn.execute(
        """
        SELECT m.id
        FROM matches m
        WHERE m.link_status = 'unlinked'
          AND EXISTS (
            SELECT 1 FROM cisco_accounts c
            WHERE c.savm_group_id = m.savm_group_id AND c.is_active = 1
          )
        """
    ).fetchall()

    now = utcnow()
    with transaction(conn):
        for row in orphans:
            conn.execute(
                "UPDATE matches SET link_status = 'unlinked', updated_at = ? WHERE id = ?",
                (now, row["id"]),
            )
            conn.execute(
                """
                INSERT INTO match_history (match_id, event, notes, actor, created_at)
                VALUES (?, 'unlinked', ?, ?, ?)
                """,
                (
                    row["id"],
                    "SAVM group missing from the latest account import.",
                    actor,
                    now,
                ),
            )

        for row in relinked:
            conn.execute(
                "UPDATE matches SET link_status = 'linked', updated_at = ? WHERE id = ?",
                (now, row["id"]),
            )

    return len(orphans)


def list_accounts(
    conn: sqlite3.Connection,
    search: str | None = None,
    state: str | None = None,
    vertical: str | None = None,
    tier: str | None = None,
    segment: str | None = None,
    source: str | None = None,
    limit: int = 50,
    offset: int = 0,
    include_inactive: bool = False,
) -> dict[str, Any]:
    if limit < 1 or limit > 200:
        raise ValidationFailedError("limit must be between 1 and 200.")
    if offset < 0:
        raise ValidationFailedError("offset must be 0 or greater.")

    clauses: list[str] = []
    params: list[Any] = []

    if not include_inactive:
        clauses.append("is_active = 1")

    if search:
        like_value = f"%{search.strip()}%"
        clauses.append(
            "(savm_group_name LIKE ? OR sfdc_account_name LIKE ? "
            "OR unified_account_name LIKE ? OR savm_group_id LIKE ?)"
        )
        params.extend([like_value] * 4)

    for column, value in (
        ("state", state),
        ("vertical", vertical),
        ("tier", tier),
        ("segment", segment),
        ("source", source),
    ):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value.strip())

    where_sql = "WHERE " + " AND ".join(clauses) if clauses else ""

    total_row = conn.execute(
        f"SELECT COUNT(*) AS count FROM cisco_accounts {where_sql}", params
    ).fetchone()
    total = int(total_row["count"]) if total_row is not None else 0

    rows = conn.execute(
        f"""
        SELECT * FROM cisco_accounts
        {where_sql}
        ORDER BY savm_group_name COLLATE NOCASE ASC, sfdc_account_name COLLATE NOCASE ASC, id ASC
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()

    return {"items": [_row_to_item(row) for row in rows], "total": total}


FACET_COLUMNS = ("state", "vertical", "tier", "segment", "source")


def get_account_facets(conn: sqlite3.Connection) -> dict[str, Any]:
    """Distinct values for the filterable columns, so the UI can offer dropdowns."""
    facets: dict[str, Any] = {}
    for column in FACET_COLUMNS:
        rows = conn.execute(
            f"""
            SELECT DISTINCT {column} AS value
            FROM cisco_accounts
            WHERE is_active = 1 AND {column} IS NOT NULL AND TRIM({column}) != ''
            ORDER BY {column} COLLATE NOCASE ASC
            """
        ).fetchall()
        facets[column] = [row["value"] for row in rows]

    totals = conn.execute(
        """
        SELECT COUNT(*) AS accounts, COUNT(DISTINCT savm_group_id) AS groups
        FROM cisco_accounts WHERE is_active = 1
        """
    ).fetchone()
    facets["total_accounts"] = int(totals["accounts"])
    facets["total_groups"] = int(totals["groups"])
    return facets


def get_account(conn: sqlite3.Connection, account_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM cisco_accounts WHERE id = ?", (account_id,)
    ).fetchone()
    return None if row is None else _row_to_item(row)


def get_group_accounts(
    conn: sqlite3.Connection, savm_group_id: str
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM cisco_accounts
        WHERE savm_group_id = ? AND is_active = 1
        ORDER BY sfdc_account_name COLLATE NOCASE ASC, id ASC
        """,
        (savm_group_id,),
    ).fetchall()
    return [_row_to_item(row) for row in rows]


def resolve_group_am(
    conn: sqlite3.Connection, savm_group_id: str
) -> dict[str, Any] | None:
    """Pick the AM for a SAVM-level match.

    Lowest am_priority wins; rows without a priority rank last; ties break
    alphabetically on account name so the result is deterministic. Returns None
    when no child row carries an AM email rather than guessing.
    """
    row = conn.execute(
        """
        SELECT * FROM cisco_accounts
        WHERE savm_group_id = ?
          AND is_active = 1
          AND am_email IS NOT NULL
          AND TRIM(am_email) != ''
        ORDER BY
          CASE WHEN am_priority IS NULL THEN 1 ELSE 0 END ASC,
          am_priority ASC,
          sfdc_account_name COLLATE NOCASE ASC,
          id ASC
        LIMIT 1
        """,
        (savm_group_id,),
    ).fetchone()

    if row is None:
        return None

    return {
        "am_name": row["am_name"],
        "am_email": row["am_email"],
        "am_cec": row["am_cec"],
        "am_confidence": row["am_confidence"],
        "am_priority": row["am_priority"],
        "am_reason": row["am_reason"],
        "am_source_account_name": row["sfdc_account_name"],
    }


def resolve_account_am(account: dict[str, Any]) -> dict[str, Any] | None:
    """AM for an SFDC-level match: that row's own AM, with no ranking."""
    if not _clean_cell(account.get("am_email")):
        return None
    return {
        "am_name": account.get("am_name"),
        "am_email": account.get("am_email"),
        "am_cec": account.get("am_cec"),
        "am_confidence": account.get("am_confidence"),
        "am_priority": account.get("am_priority"),
        "am_reason": account.get("am_reason"),
        "am_source_account_name": account.get("sfdc_account_name"),
    }


def resolve_account_reference(
    conn: sqlite3.Connection,
    savm_group_id: str | None,
    sfdc_account_name: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    """Resolve a reference to exactly one active account row."""
    group_id = _clean_cell(savm_group_id)
    if not group_id:
        raise UnknownAccountReference("savm_group_id is required.")

    clauses = ["savm_group_id = ?", "is_active = 1"]
    params: list[Any] = [group_id]

    account_name = _clean_cell(sfdc_account_name)
    if account_name:
        clauses.append("sfdc_account_name = ?")
        params.append(account_name)

    account_state = _clean_cell(state)
    if account_state:
        clauses.append("state = ?")
        params.append(account_state)

    rows = conn.execute(
        f"SELECT * FROM cisco_accounts WHERE {' AND '.join(clauses)}", params
    ).fetchall()

    if not rows:
        raise UnknownAccountReference("No active account matches the reference.")
    if len(rows) > 1:
        raise AmbiguousAccountReference(
            "Reference matches multiple accounts; include sfdc_account_name and state."
        )
    return _row_to_item(rows[0])


def group_exists(conn: sqlite3.Connection, savm_group_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM cisco_accounts WHERE savm_group_id = ? AND is_active = 1 LIMIT 1",
        (savm_group_id,),
    ).fetchone()
    return row is not None


def get_group_summary(
    conn: sqlite3.Connection, savm_group_id: str
) -> dict[str, Any] | None:
    """Group-level attributes plus the resolved AM."""
    row = conn.execute(
        """
        SELECT savm_group_id, savm_group_name, sl1, sl2, sl3, sl4, sl5, sl6,
               vertical, segment, tier, source, node_id
        FROM cisco_accounts
        WHERE savm_group_id = ? AND is_active = 1
        LIMIT 1
        """,
        (savm_group_id,),
    ).fetchone()
    if row is None:
        return None

    summary = dict(row)
    summary["am"] = resolve_group_am(conn, savm_group_id)
    summary["account_count"] = conn.execute(
        "SELECT COUNT(*) AS c FROM cisco_accounts WHERE savm_group_id = ? AND is_active = 1",
        (savm_group_id,),
    ).fetchone()["c"]
    return summary
