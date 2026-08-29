"""Global application settings, currently the AE Allocation column selection.

Settings are global rather than per-user: an admin picks the AE Allocation
columns once and every reviewer sees the same table. Values are stored as JSON
text in `app_settings` under a single key.

The column allow-list lives here rather than in the frontend because the
selection reaches SQL and a display layer; keeping one server-side registry
means a client can never introduce a column name of its own.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from db import transaction, utcnow

ALLOCATION_COLUMNS_KEY = "allocation_columns"

# key -> (label, group). Order here is the order offered in the Admin picker.
# Labels follow the reference export's business names, not the column names.
ALLOCATION_COLUMNS: tuple[dict[str, str], ...] = (
    {"key": "savm_group_id", "label": "SAV ID", "group": "Identity"},
    {"key": "unified_account_name", "label": "Unified Acc. Name", "group": "Identity"},
    {"key": "savm_group_name", "label": "SAV Name", "group": "Identity"},
    {"key": "sfdc_account_name", "label": "SFDC Name", "group": "Identity"},
    {"key": "sfdc_savm_id", "label": "SFDC SAVM ID", "group": "Identity"},
    {"key": "node_id", "label": "Node ID", "group": "Identity"},
    {"key": "state", "label": "State", "group": "Attributes"},
    {"key": "source", "label": "Source", "group": "Attributes"},
    {"key": "vertical", "label": "SAV Vertical", "group": "Attributes"},
    {"key": "tier", "label": "Tier", "group": "Attributes"},
    {"key": "segment", "label": "Segment", "group": "Attributes"},
    {"key": "sales_hierarchy", "label": "Sales hierarchy", "group": "Hierarchy"},
    {"key": "sl1", "label": "Geo - SL1", "group": "Hierarchy"},
    {"key": "sl2", "label": "Theater - SL2", "group": "Hierarchy"},
    {"key": "sl3", "label": "Area - SL3", "group": "Hierarchy"},
    {"key": "sl4", "label": "Operation - SL4", "group": "Hierarchy"},
    {"key": "sl5", "label": "Region - SL5", "group": "Hierarchy"},
    {"key": "sl6", "label": "Account - SL6", "group": "Hierarchy"},
    {"key": "am_name", "label": "Nominated AE", "group": "Account executive"},
    {"key": "am_email", "label": "AE email", "group": "Account executive"},
    {"key": "am_cec", "label": "AE CEC", "group": "Account executive"},
    {"key": "am_job_title", "label": "AE job title", "group": "Account executive"},
    {"key": "am_confidence", "label": "Confidence", "group": "Account executive"},
    {"key": "am_priority", "label": "Nomination priority", "group": "Account executive"},
    {"key": "am_reason", "label": "Nomination reason", "group": "Account executive"},
    {"key": "am_candidate_rank", "label": "Candidate rank", "group": "Account executive"},
    {"key": "am_in_gs", "label": "AE in GS", "group": "Provenance"},
    {"key": "am_in_sfdc", "label": "AE in SFDC", "group": "Provenance"},
    {"key": "am_in_sav", "label": "AE in SAV", "group": "Provenance"},
    {"key": "exists_in_sav", "label": "Exists in SAV", "group": "Provenance"},
    {"key": "exists_in_sfdc", "label": "Exists in SFDC", "group": "Provenance"},
    {"key": "sfdc_acc_owner_email", "label": "SFDC owner email", "group": "Provenance"},
    {"key": "sav_people", "label": "SAV people", "group": "Provenance"},
    {"key": "gs_all_emails", "label": "GS all emails", "group": "Provenance"},
    {"key": "gs_max_end_date", "label": "GS max end date", "group": "Provenance"},
    {"key": "edwsf_update_dtm", "label": "EDWSF update", "group": "Provenance"},
)

ALLOCATION_COLUMN_KEYS = tuple(column["key"] for column in ALLOCATION_COLUMNS)
ALLOCATION_COLUMN_BY_KEY = {column["key"]: column for column in ALLOCATION_COLUMNS}

# `sales_hierarchy` is rendered from sl1-sl6 rather than selected from a column.
SALES_HIERARCHY_KEY = "sales_hierarchy"
COMPOSITE_ALLOCATION_COLUMNS = (SALES_HIERARCHY_KEY,)

# The shipped table: the previous nine columns with Unified Acc. Name standing
# in for the separate SAV Name and SFDC Name columns.
DEFAULT_ALLOCATION_COLUMN_KEYS: tuple[str, ...] = (
    "savm_group_id",
    "unified_account_name",
    "state",
    "vertical",
    "tier",
    "source",
    "am_name",
    "am_confidence",
    "sales_hierarchy",
)


class SettingsError(Exception):
    """Raised for an invalid settings payload."""


def _read_setting(conn: sqlite3.Connection, key: str) -> Any | None:
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    if row is None:
        return None
    try:
        return json.loads(row["value"])
    except (TypeError, ValueError):
        return None


def _write_setting(
    conn: sqlite3.Connection, key: str, value: Any, actor: str | None
) -> None:
    with transaction(conn):
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_by, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at
            """,
            (key, json.dumps(value), actor, utcnow()),
        )


def validate_allocation_columns(keys: Any) -> list[str]:
    """Coerce a requested selection to a clean, ordered, de-duplicated list."""
    if not isinstance(keys, list) or not all(isinstance(key, str) for key in keys):
        raise SettingsError("columns must be an array of column keys.")

    cleaned = list(dict.fromkeys(key.strip() for key in keys if key.strip()))
    if not cleaned:
        raise SettingsError("At least one column must stay visible.")

    unknown = sorted({key for key in cleaned if key not in ALLOCATION_COLUMN_BY_KEY})
    if unknown:
        raise SettingsError("Unknown column keys: " + ", ".join(unknown))
    return cleaned


def get_allocation_columns(conn: sqlite3.Connection) -> dict[str, Any]:
    """The current selection plus the full catalogue the picker renders from."""
    stored = _read_setting(conn, ALLOCATION_COLUMNS_KEY)
    selected: list[str]
    try:
        selected = validate_allocation_columns(stored) if stored else []
    except SettingsError:
        # A selection saved before a column was retired should not break the page.
        selected = []
    if not selected:
        selected = list(DEFAULT_ALLOCATION_COLUMN_KEYS)

    return {
        "available": [dict(column) for column in ALLOCATION_COLUMNS],
        "selected": selected,
        "defaults": list(DEFAULT_ALLOCATION_COLUMN_KEYS),
        "is_default": selected == list(DEFAULT_ALLOCATION_COLUMN_KEYS),
    }


def set_allocation_columns(
    conn: sqlite3.Connection, keys: Any, actor: str | None = None
) -> dict[str, Any]:
    cleaned = validate_allocation_columns(keys)
    _write_setting(conn, ALLOCATION_COLUMNS_KEY, cleaned, actor)
    return get_allocation_columns(conn)


def reset_allocation_columns(
    conn: sqlite3.Connection, actor: str | None = None
) -> dict[str, Any]:
    _write_setting(
        conn, ALLOCATION_COLUMNS_KEY, list(DEFAULT_ALLOCATION_COLUMN_KEYS), actor
    )
    return get_allocation_columns(conn)
