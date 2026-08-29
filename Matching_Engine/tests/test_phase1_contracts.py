import sqlite3

import phase1_contracts


def _seed_contract_db(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE cisco_accounts (
                is_active INTEGER,
                source TEXT,
                sl2 TEXT,
                sl6 TEXT,
                savm_group_id TEXT
            )
            """
        )
        rows = [
            (1, "SAV+SFDC", "US PS Market Segment", "SL6-A", "G-1"),
            (1, "SAV+SFDC", "US PS Market Segment", "SL6-B", "G-2"),
            (1, "SAV+SFDC", "US COMMERCIAL", "SL6-C", "G-3"),
            (1, "SAV", "US PS Market Segment", "SL6-D", "G-4"),
            (0, "SAV+SFDC", "US PS Market Segment", "SL6-Z", "G-9"),
        ]
        conn.executemany(
            """
            INSERT INTO cisco_accounts (is_active, source, sl2, sl6, savm_group_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
    finally:
        conn.close()


def test_phase1_contracts_pass(monkeypatch, tmp_path):
    db_path = tmp_path / "phase1_contracts.db"
    _seed_contract_db(str(db_path))
    monkeypatch.setenv("OFFLOAD_DB_PATH", str(db_path))
    monkeypatch.delenv("OFFLOAD_EXPECT_DEFAULT_ROWS", raising=False)

    assert phase1_contracts.main() == 0


def test_phase1_contracts_fail_when_expected_counts_mismatch(monkeypatch, tmp_path):
    db_path = tmp_path / "phase1_contracts_mismatch.db"
    _seed_contract_db(str(db_path))
    monkeypatch.setenv("OFFLOAD_DB_PATH", str(db_path))
    monkeypatch.setenv("OFFLOAD_EXPECT_DEFAULT_ROWS", "99")

    assert phase1_contracts.main() == 1
