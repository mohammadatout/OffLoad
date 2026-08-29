"""Streaming Excel export for the AE Allocation reference.

Built server-side rather than in the browser. The reference runs to a few
hundred thousand rows, and shipping that as JSON for the client to assemble
costs hundreds of megabytes and minutes of wall time. XlsxWriter's
`constant_memory` mode writes each row straight out and keeps only the current
row in memory, so peak usage stays flat regardless of row count.
"""

from __future__ import annotations

import os
import sqlite3
import tempfile
from typing import Any, Iterator

import xlsxwriter

from cisco_store import ACCOUNT_FIELDS, account_cursor
from settings_store import (
    ALLOCATION_COLUMN_BY_KEY,
    DEFAULT_ALLOCATION_COLUMN_KEYS,
    SALES_HIERARCHY_KEY,
)

PRIMARY_SHEET = "Allocation"
DETAIL_SHEET = "Detail"

HIERARCHY_FIELDS = ("sl1", "sl2", "sl3", "sl4", "sl5", "sl6")
FIELD_INDEX = {field: position for position, field in enumerate(ACCOUNT_FIELDS)}
HIERARCHY_INDEXES = tuple(FIELD_INDEX[field] for field in HIERARCHY_FIELDS)


ALL_COLUMNS_TOKEN = "*"


def resolve_columns(selected: list[str] | None) -> list[str]:
    """Keep the requested columns that exist, falling back to the defaults.

    `"*"` asks for every field, which the backup before a purge uses so the
    front sheet alone is a complete copy.
    """
    if not selected:
        return list(DEFAULT_ALLOCATION_COLUMN_KEYS)
    if ALL_COLUMNS_TOKEN in selected:
        return list(ACCOUNT_FIELDS)
    cleaned = [
        key
        for key in dict.fromkeys(key.strip() for key in selected if key.strip())
        if key in ALLOCATION_COLUMN_BY_KEY
    ]
    return cleaned or list(DEFAULT_ALLOCATION_COLUMN_KEYS)


def parse_columns_param(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    return [part for part in (piece.strip() for piece in raw.split(",")) if part]


def _write_sheet(
    worksheet,
    header: list[str],
    header_format,
    cursor,
    positions: list[int | None],
) -> int:
    """Write one sheet from a raw cursor. Returns the row count.

    Every value is written with `write_string`: the caller has already decided
    these are text, and skipping XlsxWriter's per-cell type detection is worth
    a lot across millions of cells.
    """
    worksheet.write_row(0, 0, header, header_format)
    worksheet.freeze_panes(1, 0)

    write_string = worksheet.write_string
    row_number = 0
    for record in cursor:
        row_number += 1
        for column, position in enumerate(positions):
            if position is None:
                value = " › ".join(
                    str(record[index])
                    for index in HIERARCHY_INDEXES
                    if record[index]
                )
            else:
                raw = record[position]
                value = "" if raw is None else str(raw)
            if value:
                write_string(row_number, column, value)
    return row_number


def write_accounts_workbook(
    conn: sqlite3.Connection,
    path: str,
    selected: list[str] | None = None,
    search: str | None = None,
    include_inactive: bool = False,
    **filter_values: str | None,
) -> dict[str, Any]:
    """Write a two-sheet workbook and report what landed in it.

    The front sheet carries exactly the visible columns under their business
    labels; the detail sheet keeps every field regardless of the selection, so
    narrowing the table never removes data from the file.

    The detail sheet is skipped when the selection already covers every field,
    because it would otherwise be a second copy of the same data.
    """
    columns = resolve_columns(selected)
    labels = [ALLOCATION_COLUMN_BY_KEY[key]["label"] for key in columns]
    # None marks the composite hierarchy column, which has no source field.
    positions: list[int | None] = [FIELD_INDEX.get(key) for key in columns]

    selected_fields = {key for key in columns if key in FIELD_INDEX}
    needs_detail = selected_fields != set(ACCOUNT_FIELDS)

    workbook = xlsxwriter.Workbook(path, {"constant_memory": True})
    header_format = workbook.add_format({"bold": True})

    try:
        rows_written = _write_sheet(
            workbook.add_worksheet(PRIMARY_SHEET),
            labels,
            header_format,
            account_cursor(
                conn,
                search=search,
                include_inactive=include_inactive,
                **filter_values,
            ),
            positions,
        )

        if needs_detail:
            # Sheets must be written one at a time in constant_memory mode, so
            # this is a second pass rather than an interleaved write.
            _write_sheet(
                workbook.add_worksheet(DETAIL_SHEET),
                list(ACCOUNT_FIELDS),
                header_format,
                account_cursor(
                    conn,
                    search=search,
                    include_inactive=include_inactive,
                    **filter_values,
                ),
                list(range(len(ACCOUNT_FIELDS))),
            )
    finally:
        workbook.close()

    return {
        "rows": rows_written,
        "columns": columns,
        "labels": labels,
        "has_detail_sheet": needs_detail,
    }


def stream_accounts_workbook(
    conn: sqlite3.Connection,
    selected: list[str] | None = None,
    search: str | None = None,
    include_inactive: bool = False,
    chunk_size: int = 262_144,
    **filter_values: str | None,
) -> Iterator[bytes]:
    """Build the workbook to a temp file, stream it, then remove it.

    A temp file rather than an in-memory buffer because `constant_memory` mode
    is the whole point: holding the finished archive in RAM would undo it.
    """
    handle, path = tempfile.mkstemp(prefix="offload_allocation_", suffix=".xlsx")
    os.close(handle)
    try:
        write_accounts_workbook(
            conn,
            path,
            selected=selected,
            search=search,
            include_inactive=include_inactive,
            **filter_values,
        )
        with open(path, "rb") as source:
            while True:
                chunk = source.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
