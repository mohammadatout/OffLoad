"""
Match library persistence and workflow.

The match library is the memory: once an entity is matched and approved it is
returned instantly on later runs instead of being re-scored. Rows link to the
Cisco reference table by SAVM group id, plus account name and state when the
match was made at SFDC level.

Account details are always read live from the reference table. The snap_*
columns are a point-in-time copy taken at approval so history stays truthful
after a reference re-import; a difference between the two is reported as drift.
"""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from typing import Any

from cisco_store import (
    AmbiguousAccountReference,
    UnknownAccountReference,
    resolve_account_am,
    resolve_account_reference,
    resolve_group_am,
    group_exists,
)
from db import transaction, utcnow

STATUS_PENDING_ADMIN = "pending_admin_approval"
STATUS_PENDING_REVIEW = "pending_review"
STATUS_ACTIVE = "active"
STATUS_REJECTED = "rejected"
STATUS_DELETED = "deleted"

VALID_STATUSES = {
    STATUS_PENDING_ADMIN,
    STATUS_PENDING_REVIEW,
    STATUS_ACTIVE,
    STATUS_REJECTED,
    STATUS_DELETED,
}

VALID_SOURCES = {"match_run", "bulk_upload", "manual"}
VALID_MATCH_LEVELS = {"SAVM", "SFDC"}
VALID_LINK_STATUSES = {"linked", "unlinked"}

ADMIN_APPROVAL_THRESHOLD = 0.95

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    STATUS_PENDING_ADMIN: {STATUS_ACTIVE, STATUS_REJECTED, STATUS_DELETED},
    STATUS_PENDING_REVIEW: {STATUS_ACTIVE, STATUS_REJECTED, STATUS_DELETED},
    STATUS_ACTIVE: {STATUS_REJECTED, STATUS_DELETED},
    STATUS_REJECTED: {STATUS_PENDING_REVIEW, STATUS_DELETED},
    STATUS_DELETED: {
        STATUS_PENDING_ADMIN,
        STATUS_PENDING_REVIEW,
        STATUS_ACTIVE,
        STATUS_REJECTED,
    },
}


class MatchStoreError(Exception):
    """Base match store error."""


class ValidationFailedError(MatchStoreError):
    """Raised when input data is invalid."""


class InvalidTransition(MatchStoreError):
    """Raised when a status transition is not allowed."""


class DuplicateActiveMatch(MatchStoreError):
    """Raised when active-match uniqueness would be violated."""


class MatchNotFoundError(MatchStoreError):
    """Raised when a match id does not exist."""


class PermissionDeniedError(MatchStoreError):
    """Raised when a role is not allowed to perform an action."""


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _require_text(value: Any, field_name: str) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        raise ValidationFailedError(f"{field_name} is required.")
    return cleaned


def _as_optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationFailedError("confidence_score must be a number.") from exc


def _status_from_score(confidence_score: float | None) -> str:
    if confidence_score is not None and confidence_score >= ADMIN_APPROVAL_THRESHOLD:
        return STATUS_PENDING_ADMIN
    return STATUS_PENDING_REVIEW


def _serialize_field_changes(field_changes: dict[str, Any] | None) -> str | None:
    return None if field_changes is None else json.dumps(field_changes)


def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    if "id" in item:
        item["match_id"] = item["id"]
    return item


def _normalize_header(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _parse_csv_rows(file_bytes: bytes) -> tuple[list[str], list[dict[str, str | None]]]:
    try:
        content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationFailedError("CSV must be valid UTF-8.") from exc

    reader = csv.DictReader(io.StringIO(content))
    if reader.fieldnames is None:
        raise ValidationFailedError("CSV must include a header row.")

    normalized_headers = [_normalize_header(h) for h in reader.fieldnames]
    rows: list[dict[str, str | None]] = []
    for row in reader:
        if all(_clean_text(v) is None for v in row.values()):
            continue
        normalized_row: dict[str, str | None] = {}
        for header, normalized in zip(reader.fieldnames, normalized_headers):
            normalized_row[normalized] = _clean_text(row.get(header))
        rows.append(normalized_row)
    return normalized_headers, rows


def _create_import_batch(
    conn: sqlite3.Connection, kind: str, filename: str, actor: str
) -> int:
    result = conn.execute(
        """
        INSERT INTO import_batches (kind, filename, actor, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (kind, filename, actor, utcnow()),
    )
    return int(result.lastrowid)


def _finalize_import_batch(
    conn: sqlite3.Connection,
    batch_id: int,
    row_count: int,
    inserted: int,
    updated: int,
    skipped: int,
    failed: int,
    row_issues: list[dict[str, Any]],
) -> None:
    conn.execute(
        """
        UPDATE import_batches
        SET row_count = ?, inserted = ?, updated = ?, skipped = ?, failed = ?, error_report = ?
        WHERE id = ?
        """,
        (
            row_count,
            inserted,
            updated,
            skipped,
            failed,
            json.dumps({"rows": row_issues, "warnings": []}) if row_issues else None,
            batch_id,
        ),
    )


def get_import_batch(conn: sqlite3.Connection, batch_id: int) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM import_batches WHERE id = ?", (batch_id,)
    ).fetchone()
    if row is None:
        raise MatchStoreError("Import batch not found.")
    summary = dict(row)
    if summary.get("error_report"):
        summary["error_report"] = json.loads(summary["error_report"])
    else:
        summary["error_report"] = {"warnings": [], "rows": []}
    return summary


def _fetch_match_row(conn: sqlite3.Connection, match_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if row is None:
        raise MatchNotFoundError("Match not found.")
    return row


def _assert_transition(from_status: str, to_status: str) -> None:
    if to_status not in ALLOWED_TRANSITIONS.get(from_status, set()):
        raise InvalidTransition(
            f"Transition from '{from_status}' to '{to_status}' is not allowed."
        )


def _insert_history(
    conn: sqlite3.Connection,
    match_id: int,
    event: str,
    actor: str,
    from_status: str | None = None,
    to_status: str | None = None,
    field_changes: dict[str, Any] | None = None,
    notes: str | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO match_history (
            match_id, event, from_status, to_status, field_changes, notes, actor, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            match_id,
            event,
            from_status,
            to_status,
            _serialize_field_changes(field_changes),
            notes,
            actor,
            utcnow(),
        ),
    )


def _build_snapshot(
    conn: sqlite3.Connection,
    savm_group_id: str,
    match_level: str,
    sfdc_account_name: str | None,
    account_state: str | None,
) -> dict[str, Any]:
    """Capture the account and AM as they look right now."""
    if match_level == "SFDC":
        account = resolve_account_reference(
            conn, savm_group_id, sfdc_account_name, account_state
        )
        am = resolve_account_am(account)
        return {
            "snap_savm_group_name": account.get("savm_group_name"),
            "snap_account_name": account.get("sfdc_account_name"),
            "snap_am_name": (am or {}).get("am_name"),
            "snap_am_email": (am or {}).get("am_email"),
            "snap_am_confidence": (am or {}).get("am_confidence"),
        }

    group_row = conn.execute(
        """
        SELECT savm_group_name FROM cisco_accounts
        WHERE savm_group_id = ? AND is_active = 1 LIMIT 1
        """,
        (savm_group_id,),
    ).fetchone()
    am = resolve_group_am(conn, savm_group_id)
    return {
        "snap_savm_group_name": group_row["savm_group_name"] if group_row else None,
        "snap_account_name": None,
        "snap_am_name": (am or {}).get("am_name"),
        "snap_am_email": (am or {}).get("am_email"),
        "snap_am_confidence": (am or {}).get("am_confidence"),
    }


# --------------------------------------------------------------------------
# create / decide
# --------------------------------------------------------------------------

def create_match(
    conn: sqlite3.Connection, payload: dict[str, Any], actor: str
) -> dict[str, Any]:
    """Create a match and stage it according to its confidence score."""
    entity_name_original = _require_text(
        payload.get("entity_name_original"), "entity_name_original"
    )
    entity_name_cleaned = _require_text(
        payload.get("entity_name_cleaned"), "entity_name_cleaned"
    )
    entity_state = _clean_text(payload.get("entity_state")) or ""
    confidence_score = _as_optional_float(payload.get("confidence_score"))
    status = payload.get("status") or _status_from_score(confidence_score)
    if status not in VALID_STATUSES:
        raise ValidationFailedError("Unknown status.")

    source = _clean_text(payload.get("source")) or "manual"
    if source not in VALID_SOURCES:
        raise ValidationFailedError(
            "source must be one of: match_run, bulk_upload, manual."
        )

    savm_group_id = _clean_text(payload.get("savm_group_id"))
    sfdc_account_name = _clean_text(payload.get("sfdc_account_name"))
    account_state = _clean_text(payload.get("account_state"))

    match_level = _clean_text(payload.get("match_level"))
    if match_level is None and savm_group_id:
        match_level = "SFDC" if sfdc_account_name else "SAVM"
    if match_level is not None and match_level not in VALID_MATCH_LEVELS:
        raise ValidationFailedError("match_level must be 'SAVM' or 'SFDC'.")

    snapshot = {
        "snap_savm_group_name": None,
        "snap_account_name": None,
        "snap_am_name": None,
        "snap_am_email": None,
        "snap_am_confidence": None,
    }
    if savm_group_id and match_level:
        snapshot = _build_snapshot(
            conn, savm_group_id, match_level, sfdc_account_name, account_state
        )

    link_status = "linked"
    if savm_group_id and not group_exists(conn, savm_group_id):
        link_status = "unlinked"

    notes = _clean_text(payload.get("notes"))
    now_iso = utcnow()

    with transaction(conn):
        try:
            result = conn.execute(
                """
                INSERT INTO matches (
                    entity_name_original, entity_name_cleaned, entity_state,
                    savm_group_id, sfdc_account_name, account_state, match_level,
                    snap_savm_group_name, snap_account_name, snap_am_name,
                    snap_am_email, snap_am_confidence,
                    confidence_score, match_stage, status, notes,
                    source, source_detail, created_by, created_at, link_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entity_name_original,
                    entity_name_cleaned,
                    entity_state,
                    savm_group_id,
                    sfdc_account_name,
                    account_state,
                    match_level,
                    snapshot["snap_savm_group_name"],
                    snapshot["snap_account_name"],
                    snapshot["snap_am_name"],
                    snapshot["snap_am_email"],
                    snapshot["snap_am_confidence"],
                    confidence_score,
                    _clean_text(payload.get("match_stage")),
                    status,
                    notes,
                    source,
                    _clean_text(payload.get("source_detail")),
                    actor,
                    now_iso,
                    link_status,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise DuplicateActiveMatch(
                "An active match already exists for this entity and state."
            ) from exc

        match_id = int(result.lastrowid)
        _insert_history(
            conn=conn,
            match_id=match_id,
            event="created",
            actor=actor,
            to_status=status,
            notes=notes,
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def approve_match(
    conn: sqlite3.Connection,
    match_id: int,
    actor: str,
    role: str,
    notes: str | None = None,
) -> dict[str, Any]:
    """Approve a staged match and activate it, refreshing its snapshot."""
    with transaction(conn):
        row = _fetch_match_row(conn, match_id)
        from_status = row["status"]

        if from_status == STATUS_PENDING_ADMIN and role != "admin":
            raise PermissionDeniedError(
                "Only an admin can approve matches awaiting admin approval."
            )

        _assert_transition(from_status, STATUS_ACTIVE)

        now_iso = utcnow()
        next_notes = _clean_text(notes) if notes is not None else row["notes"]

        snapshot = {
            "snap_savm_group_name": row["snap_savm_group_name"],
            "snap_account_name": row["snap_account_name"],
            "snap_am_name": row["snap_am_name"],
            "snap_am_email": row["snap_am_email"],
            "snap_am_confidence": row["snap_am_confidence"],
        }
        if row["savm_group_id"] and row["match_level"]:
            try:
                snapshot = _build_snapshot(
                    conn,
                    row["savm_group_id"],
                    row["match_level"],
                    row["sfdc_account_name"],
                    row["account_state"],
                )
            except (UnknownAccountReference, AmbiguousAccountReference):
                pass

        try:
            conn.execute(
                """
                UPDATE matches
                SET status = ?, notes = ?, updated_by = ?, updated_at = ?,
                    decided_by = ?, decided_at = ?,
                    snap_savm_group_name = ?, snap_account_name = ?,
                    snap_am_name = ?, snap_am_email = ?, snap_am_confidence = ?
                WHERE id = ?
                """,
                (
                    STATUS_ACTIVE,
                    next_notes,
                    actor,
                    now_iso,
                    actor,
                    now_iso,
                    snapshot["snap_savm_group_name"],
                    snapshot["snap_account_name"],
                    snapshot["snap_am_name"],
                    snapshot["snap_am_email"],
                    snapshot["snap_am_confidence"],
                    match_id,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise DuplicateActiveMatch(
                "Another active match already exists for this entity and state."
            ) from exc

        _insert_history(
            conn=conn,
            match_id=match_id,
            event="approved",
            actor=actor,
            from_status=from_status,
            to_status=STATUS_ACTIVE,
            notes=next_notes,
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def reject_match(
    conn: sqlite3.Connection, match_id: int, actor: str, notes: str
) -> dict[str, Any]:
    """Reject a match. Notes are mandatory so the reason is always recorded."""
    rejection_notes = _require_text(notes, "notes")

    with transaction(conn):
        row = _fetch_match_row(conn, match_id)
        from_status = row["status"]
        _assert_transition(from_status, STATUS_REJECTED)

        now_iso = utcnow()
        conn.execute(
            """
            UPDATE matches
            SET status = ?, notes = ?, updated_by = ?, updated_at = ?,
                decided_by = ?, decided_at = ?
            WHERE id = ?
            """,
            (STATUS_REJECTED, rejection_notes, actor, now_iso, actor, now_iso, match_id),
        )
        _insert_history(
            conn=conn,
            match_id=match_id,
            event="rejected",
            actor=actor,
            from_status=from_status,
            to_status=STATUS_REJECTED,
            notes=rejection_notes,
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def update_notes(
    conn: sqlite3.Connection, match_id: int, actor: str, notes: str | None
) -> dict[str, Any]:
    next_notes = _clean_text(notes)

    with transaction(conn):
        row = _fetch_match_row(conn, match_id)
        previous_notes = row["notes"]
        now_iso = utcnow()
        conn.execute(
            "UPDATE matches SET notes = ?, updated_by = ?, updated_at = ? WHERE id = ?",
            (next_notes, actor, now_iso, match_id),
        )
        _insert_history(
            conn=conn,
            match_id=match_id,
            event="edited",
            actor=actor,
            from_status=row["status"],
            to_status=row["status"],
            field_changes={"notes": {"from": previous_notes, "to": next_notes}},
            notes=next_notes,
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def soft_delete_match(
    conn: sqlite3.Connection,
    match_id: int,
    actor: str,
    role: str,
    notes: str | None = None,
) -> dict[str, Any]:
    if role != "admin":
        raise PermissionDeniedError("Only an admin can delete matches.")

    with transaction(conn):
        row = _fetch_match_row(conn, match_id)
        from_status = row["status"]
        _assert_transition(from_status, STATUS_DELETED)

        now_iso = utcnow()
        next_notes = _clean_text(notes) if notes is not None else row["notes"]
        conn.execute(
            """
            UPDATE matches
            SET status = ?, prev_status = ?, notes = ?, updated_by = ?, updated_at = ?,
                decided_by = ?, decided_at = ?
            WHERE id = ?
            """,
            (
                STATUS_DELETED,
                from_status,
                next_notes,
                actor,
                now_iso,
                actor,
                now_iso,
                match_id,
            ),
        )
        _insert_history(
            conn=conn,
            match_id=match_id,
            event="deleted",
            actor=actor,
            from_status=from_status,
            to_status=STATUS_DELETED,
            notes=next_notes,
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def restore_match(
    conn: sqlite3.Connection, match_id: int, actor: str, role: str
) -> dict[str, Any]:
    if role != "admin":
        raise PermissionDeniedError("Only an admin can restore matches.")

    with transaction(conn):
        row = _fetch_match_row(conn, match_id)
        if row["status"] != STATUS_DELETED:
            raise InvalidTransition("Only deleted matches can be restored.")

        restore_to = row["prev_status"]
        if not restore_to:
            raise ValidationFailedError("Cannot determine the status to restore to.")

        _assert_transition(STATUS_DELETED, restore_to)

        now_iso = utcnow()
        try:
            conn.execute(
                """
                UPDATE matches
                SET status = ?, prev_status = NULL, updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (restore_to, actor, now_iso, match_id),
            )
        except sqlite3.IntegrityError as exc:
            raise DuplicateActiveMatch(
                "Restoring would violate active-match uniqueness."
            ) from exc

        _insert_history(
            conn=conn,
            match_id=match_id,
            event="restored",
            actor=actor,
            from_status=STATUS_DELETED,
            to_status=restore_to,
            notes=row["notes"],
        )

    return _row_to_item(_fetch_match_row(conn, match_id))


def bulk_approve(
    conn: sqlite3.Connection,
    ids: list[int],
    actor: str,
    role: str,
    notes: str | None = None,
) -> dict[str, Any]:
    """Approve many matches, continuing past per-row failures."""
    approved = 0
    failed: list[dict[str, Any]] = []

    for match_id in ids:
        try:
            approve_match(conn, int(match_id), actor=actor, role=role, notes=notes)
            approved += 1
        except (MatchStoreError, ValueError, TypeError) as exc:
            failed.append({"id": match_id, "reason": str(exc)})

    return {"approved": approved, "failed": failed}


# --------------------------------------------------------------------------
# reads
# --------------------------------------------------------------------------

def _enrich_match(conn: sqlite3.Connection, item: dict[str, Any]) -> dict[str, Any]:
    """Attach live account data and flag snapshot drift."""
    group_id = item.get("savm_group_id")
    item["account"] = None
    item["am"] = None
    item["drifted"] = False

    if not group_id:
        return item

    group_row = conn.execute(
        """
        SELECT savm_group_name, vertical, segment, tier, source,
               sl1, sl2, sl3, sl4, sl5, sl6
        FROM cisco_accounts
        WHERE savm_group_id = ? AND is_active = 1
        LIMIT 1
        """,
        (group_id,),
    ).fetchone()

    if group_row is None:
        item["drifted"] = True
        return item

    live: dict[str, Any] = dict(group_row)

    if item.get("match_level") == "SFDC":
        try:
            account = resolve_account_reference(
                conn, group_id, item.get("sfdc_account_name"), item.get("account_state")
            )
        except (UnknownAccountReference, AmbiguousAccountReference):
            account = None
        if account is None:
            item["drifted"] = True
            item["account"] = live
            return item
        live.update(
            {
                "sfdc_account_name": account.get("sfdc_account_name"),
                "unified_account_name": account.get("unified_account_name"),
                "state": account.get("state"),
            }
        )
        am = resolve_account_am(account)
    else:
        am = resolve_group_am(conn, group_id)

    item["account"] = live
    item["am"] = am

    snapshot_group = item.get("snap_savm_group_name")
    snapshot_am_email = item.get("snap_am_email")
    live_am_email = (am or {}).get("am_email")

    if snapshot_group and snapshot_group != live.get("savm_group_name"):
        item["drifted"] = True
    if snapshot_am_email and snapshot_am_email != live_am_email:
        item["drifted"] = True

    return item


def list_matches(
    conn: sqlite3.Connection, filters: dict[str, Any] | None = None
) -> dict[str, Any]:
    filters = filters or {}
    status = _clean_text(filters.get("status"))
    search = _clean_text(filters.get("search"))
    state = _clean_text(filters.get("state"))
    vertical = _clean_text(filters.get("vertical"))
    tier = _clean_text(filters.get("tier"))
    link_status = _clean_text(filters.get("link_status"))
    match_level = _clean_text(filters.get("match_level"))
    # Explicit None checks: `or` would silently turn limit=0 into the default.
    raw_limit = filters.get("limit")
    raw_offset = filters.get("offset")
    limit = 50 if raw_limit is None else int(raw_limit)
    offset = 0 if raw_offset is None else int(raw_offset)

    if limit < 1 or limit > 200:
        raise ValidationFailedError("limit must be between 1 and 200.")
    if offset < 0:
        raise ValidationFailedError("offset must be 0 or greater.")
    if status and status not in VALID_STATUSES:
        raise ValidationFailedError("Unknown status filter.")
    if link_status and link_status not in VALID_LINK_STATUSES:
        raise ValidationFailedError("Unknown link_status filter.")
    if match_level and match_level not in VALID_MATCH_LEVELS:
        raise ValidationFailedError("Unknown match_level filter.")

    clauses: list[str] = []
    params: list[Any] = []

    if status:
        clauses.append("m.status = ?")
        params.append(status)

    if link_status:
        clauses.append("m.link_status = ?")
        params.append(link_status)

    if match_level:
        clauses.append("m.match_level = ?")
        params.append(match_level)

    if search:
        like = f"%{search}%"
        clauses.append(
            "(m.entity_name_original LIKE ? OR m.entity_name_cleaned LIKE ? "
            "OR m.snap_savm_group_name LIKE ? OR m.sfdc_account_name LIKE ? "
            "OR m.savm_group_id LIKE ?)"
        )
        params.extend([like] * 5)

    if state:
        clauses.append("(m.entity_state = ? OR m.account_state = ?)")
        params.extend([state, state])

    for column, value in (("vertical", vertical), ("tier", tier)):
        if value:
            clauses.append(
                f"""EXISTS (
                    SELECT 1 FROM cisco_accounts c
                    WHERE c.savm_group_id = m.savm_group_id
                      AND c.is_active = 1
                      AND c.{column} = ?
                )"""
            )
            params.append(value)

    where_sql = "WHERE " + " AND ".join(clauses) if clauses else ""

    count_row = conn.execute(
        f"SELECT COUNT(*) AS count FROM matches m {where_sql}", params
    ).fetchone()
    total = int(count_row["count"]) if count_row is not None else 0

    rows = conn.execute(
        f"""
        SELECT m.* FROM matches m
        {where_sql}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()

    items = [_enrich_match(conn, _row_to_item(row)) for row in rows]
    return {"items": items, "total": total}


def get_match(conn: sqlite3.Connection, match_id: int) -> dict[str, Any]:
    return _enrich_match(conn, _row_to_item(_fetch_match_row(conn, match_id)))


def get_match_history(conn: sqlite3.Connection, match_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM match_history
        WHERE match_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (match_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_active_library(
    conn: sqlite3.Connection,
) -> dict[tuple[str, str], dict[str, Any]]:
    """Active matches keyed by cleaned entity name and state.

    This is the Stage 1 memory: a hit here skips fuzzy scoring entirely.
    """
    rows = conn.execute(
        """
        SELECT id, entity_name_cleaned, entity_state, savm_group_id,
               sfdc_account_name, account_state, match_level,
               snap_savm_group_name, snap_account_name, snap_am_name, snap_am_email
        FROM matches
        WHERE status = 'active'
        """
    ).fetchall()

    library: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row["entity_name_cleaned"], row["entity_state"] or "")
        library[key] = {
            "match_id": row["id"],
            "savm_group_id": row["savm_group_id"],
            "sfdc_account_name": row["sfdc_account_name"],
            "account_state": row["account_state"],
            "match_level": row["match_level"],
            "savm_group_name": row["snap_savm_group_name"],
            "account_name": row["snap_account_name"],
            "am_name": row["snap_am_name"],
            "am_email": row["snap_am_email"],
        }
    return library


def get_rejected_keys(
    conn: sqlite3.Connection,
) -> set[tuple[str, str, str, str]]:
    """Rejected pairs, so a run never re-suggests something already refused.

    Keyed on the full account reference rather than the group alone, so
    rejecting one account does not suppress its siblings.
    """
    rows = conn.execute(
        """
        SELECT entity_name_cleaned, savm_group_id, sfdc_account_name, account_state
        FROM matches
        WHERE status = 'rejected' AND savm_group_id IS NOT NULL
        """
    ).fetchall()
    return {
        (
            row["entity_name_cleaned"],
            row["savm_group_id"],
            row["sfdc_account_name"] or "",
            row["account_state"] or "",
        )
        for row in rows
    }


# --------------------------------------------------------------------------
# bulk import
# --------------------------------------------------------------------------

def _resolve_import_reference(
    conn: sqlite3.Connection, row: dict[str, str | None]
) -> tuple[str, str | None, str | None, str]:
    """Resolve a CSV row's SAVM reference to (group_id, account_name, state, level)."""
    group_id = _clean_text(row.get("savm_group_id")) or _clean_text(row.get("savm_id"))
    if not group_id:
        raise ValidationFailedError("missing_reference")

    if not group_exists(conn, group_id):
        raise UnknownAccountReference("unknown_group")

    account_name = _clean_text(row.get("sfdc_account_name")) or _clean_text(
        row.get("sfdc_acc_name")
    )
    account_state = _clean_text(row.get("account_state"))

    if not account_name:
        return group_id, None, None, "SAVM"

    try:
        account = resolve_account_reference(conn, group_id, account_name, account_state)
    except (UnknownAccountReference, AmbiguousAccountReference) as exc:
        # Re-raise with a stable reason code; the prose message is not an API contract.
        raise UnknownAccountReference("unknown_account") from exc

    return (
        group_id,
        account["sfdc_account_name"],
        account["state"],
        "SFDC",
    )


def import_matches_csv(
    conn: sqlite3.Connection, file_bytes: bytes, filename: str, actor: str
) -> dict[str, Any]:
    """Import pre-approved historical matches directly as active rows."""
    headers, rows = _parse_csv_rows(file_bytes)

    required = {"entity_name_original", "entity_name_cleaned"}
    missing_required = sorted(required.difference(set(headers)))
    if missing_required:
        raise ValidationFailedError(
            f"Missing required columns: {', '.join(missing_required)}"
        )

    row_count = len(rows)
    inserted = 0
    skipped = 0
    failed = 0
    row_issues: list[dict[str, Any]] = []

    with transaction(conn):
        batch_id = _create_import_batch(conn, "matches", filename, actor)

    for row_index, row in enumerate(rows, start=2):
        entity_name_original = _clean_text(row.get("entity_name_original"))
        entity_name_cleaned = _clean_text(row.get("entity_name_cleaned"))
        entity_state = _clean_text(row.get("entity_state"))
        notes = _clean_text(row.get("notes"))

        if not entity_name_original or not entity_name_cleaned:
            failed += 1
            row_issues.append({"row": row_index, "reason": "validation_failed"})
            continue

        try:
            group_id, account_name, account_state, level = _resolve_import_reference(
                conn, row
            )
        except (UnknownAccountReference, AmbiguousAccountReference) as exc:
            failed += 1
            row_issues.append({"row": row_index, "reason": str(exc)})
            continue
        except ValidationFailedError:
            failed += 1
            row_issues.append({"row": row_index, "reason": "missing_reference"})
            continue

        try:
            create_match(
                conn,
                {
                    "entity_name_original": entity_name_original,
                    "entity_name_cleaned": entity_name_cleaned,
                    "entity_state": entity_state,
                    "savm_group_id": group_id,
                    "sfdc_account_name": account_name,
                    "account_state": account_state,
                    "match_level": level,
                    "status": STATUS_ACTIVE,
                    "match_stage": "bulk_import",
                    "notes": notes,
                    "source": "bulk_upload",
                    "source_detail": filename,
                },
                actor=actor,
            )
            inserted += 1
        except DuplicateActiveMatch:
            skipped += 1
            row_issues.append({"row": row_index, "reason": "duplicate_active_match"})
        except MatchStoreError as exc:
            failed += 1
            row_issues.append({"row": row_index, "reason": str(exc)})

    with transaction(conn):
        _finalize_import_batch(
            conn=conn,
            batch_id=batch_id,
            row_count=row_count,
            inserted=inserted,
            updated=0,
            skipped=skipped,
            failed=failed,
            row_issues=row_issues,
        )

    return get_import_batch(conn, batch_id)


def import_match_deletions_csv(
    conn: sqlite3.Connection, file_bytes: bytes, filename: str, actor: str
) -> dict[str, Any]:
    """Soft-delete the matches listed in a CSV."""
    _, rows = _parse_csv_rows(file_bytes)

    row_count = len(rows)
    updated = 0
    failed = 0
    row_issues: list[dict[str, Any]] = []

    with transaction(conn):
        batch_id = _create_import_batch(conn, "deletions", filename, actor)

    for row_index, row in enumerate(rows, start=2):
        notes = _clean_text(row.get("notes"))
        target_match_id: int | None = None

        raw_match_id = _clean_text(row.get("match_id"))
        if raw_match_id:
            try:
                target_match_id = int(raw_match_id)
            except ValueError:
                failed += 1
                row_issues.append({"row": row_index, "reason": "validation_failed"})
                continue
        else:
            cleaned_name = _clean_text(row.get("entity_name_cleaned"))
            group_id = _clean_text(row.get("savm_group_id")) or _clean_text(
                row.get("savm_id")
            )
            if not cleaned_name or not group_id:
                failed += 1
                row_issues.append({"row": row_index, "reason": "missing_reference"})
                continue

            clauses = [
                "entity_name_cleaned = ?",
                "savm_group_id = ?",
                "status != 'deleted'",
            ]
            params: list[Any] = [cleaned_name, group_id]

            account_name = _clean_text(row.get("sfdc_account_name"))
            if account_name:
                clauses.append("sfdc_account_name = ?")
                params.append(account_name)

            candidates = conn.execute(
                f"SELECT id FROM matches WHERE {' AND '.join(clauses)} ORDER BY id ASC",
                params,
            ).fetchall()

            if not candidates:
                failed += 1
                row_issues.append({"row": row_index, "reason": "not_found"})
                continue
            if len(candidates) > 1:
                failed += 1
                row_issues.append({"row": row_index, "reason": "ambiguous_reference"})
                continue
            target_match_id = int(candidates[0]["id"])

        try:
            soft_delete_match(
                conn, match_id=target_match_id, actor=actor, role="admin", notes=notes
            )
            updated += 1
        except MatchStoreError as exc:
            failed += 1
            row_issues.append({"row": row_index, "reason": str(exc)})

    with transaction(conn):
        _finalize_import_batch(
            conn=conn,
            batch_id=batch_id,
            row_count=row_count,
            inserted=0,
            updated=updated,
            skipped=0,
            failed=failed,
            row_issues=row_issues,
        )

    return get_import_batch(conn, batch_id)
