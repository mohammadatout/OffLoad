"""Phase 1 production contract checks.

Run this against a populated OffLoad database before releasing Phase 1.
Optional expected counts can be passed via environment variables:

- OFFLOAD_EXPECT_SOURCE_ROWS
- OFFLOAD_EXPECT_DEFAULT_ROWS
- OFFLOAD_EXPECT_DEFAULT_GROUPS
- OFFLOAD_EXPECT_US_COMMERCIAL_ROWS
- OFFLOAD_EXPECT_DEFAULT_SL6_DISTINCT
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from typing import Any

from db import resolve_db_path

DEFAULT_SOURCE = "SAV+SFDC"
DEFAULT_SL2 = "US PS Market Segment"
US_COMMERCIAL_SL2 = "US COMMERCIAL"


def _expected_int(name: str) -> int | None:
    raw = os.getenv(name)
    if not raw:
        return None
    return int(raw)


def _query_count(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> int:
    row = conn.execute(sql, params).fetchone()
    return int(row[0]) if row is not None else 0


def main() -> int:
    db_path = resolve_db_path()
    if not os.path.exists(db_path):
        print(json.dumps({"ok": False, "error": f"Database not found at {db_path}"}))
        return 1

    conn = sqlite3.connect(db_path)
    try:
        active_total = _query_count(
            conn, "SELECT COUNT(*) FROM cisco_accounts WHERE is_active = 1"
        )
        source_rows = _query_count(
            conn,
            """
            SELECT COUNT(*) FROM cisco_accounts
            WHERE is_active = 1 AND source = ?
            """,
            (DEFAULT_SOURCE,),
        )
        default_rows = _query_count(
            conn,
            """
            SELECT COUNT(*) FROM cisco_accounts
            WHERE is_active = 1 AND source = ? AND sl2 = ?
            """,
            (DEFAULT_SOURCE, DEFAULT_SL2),
        )
        default_groups = _query_count(
            conn,
            """
            SELECT COUNT(DISTINCT savm_group_id) FROM cisco_accounts
            WHERE is_active = 1 AND source = ? AND sl2 = ?
            """,
            (DEFAULT_SOURCE, DEFAULT_SL2),
        )
        us_commercial_rows = _query_count(
            conn,
            """
            SELECT COUNT(*) FROM cisco_accounts
            WHERE is_active = 1 AND source = ? AND sl2 = ?
            """,
            (DEFAULT_SOURCE, US_COMMERCIAL_SL2),
        )
        default_sl6_distinct = _query_count(
            conn,
            """
            SELECT COUNT(DISTINCT sl6) FROM cisco_accounts
            WHERE is_active = 1
              AND source = ?
              AND sl2 = ?
              AND sl6 IS NOT NULL
              AND TRIM(sl6) != ''
            """,
            (DEFAULT_SOURCE, DEFAULT_SL2),
        )

        checks: list[tuple[str, bool, str]] = []
        checks.append(
            (
                "default_slice_not_empty",
                default_rows > 0 and default_groups > 0,
                "Default slice must produce at least one row and one group.",
            )
        )
        checks.append(
            (
                "source_subset_consistency",
                default_rows <= source_rows <= active_total,
                "Default rows <= source rows <= active total must hold.",
            )
        )
        checks.append(
            (
                "sl6_not_empty",
                default_sl6_distinct > 0,
                "Default slice must expose at least one sl6 value.",
            )
        )

        expected_pairs = [
            ("OFFLOAD_EXPECT_SOURCE_ROWS", source_rows, "source rows"),
            ("OFFLOAD_EXPECT_DEFAULT_ROWS", default_rows, "default rows"),
            ("OFFLOAD_EXPECT_DEFAULT_GROUPS", default_groups, "default groups"),
            ("OFFLOAD_EXPECT_US_COMMERCIAL_ROWS", us_commercial_rows, "US COMMERCIAL rows"),
            (
                "OFFLOAD_EXPECT_DEFAULT_SL6_DISTINCT",
                default_sl6_distinct,
                "default distinct sl6 count",
            ),
        ]
        for env_name, actual, label in expected_pairs:
            expected = _expected_int(env_name)
            if expected is None:
                continue
            checks.append(
                (
                    env_name,
                    actual == expected,
                    f"Expected {label}={expected}, got {actual}.",
                )
            )

        failed = [name for name, ok, _ in checks if not ok]
        payload = {
            "ok": len(failed) == 0,
            "db_path": db_path,
            "metrics": {
                "active_total": active_total,
                "source_rows": source_rows,
                "default_rows": default_rows,
                "default_groups": default_groups,
                "us_commercial_rows": us_commercial_rows,
                "default_sl6_distinct": default_sl6_distinct,
            },
            "checks": [
                {"name": name, "ok": ok, "message": message}
                for name, ok, message in checks
            ],
        }
        print(json.dumps(payload, indent=2))
        return 0 if payload["ok"] else 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
