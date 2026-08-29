"""Store-level tests for the AE Allocation admin surface.

Covers the searchable dropdown options, the full-set export iterator, the
irreversible reference purge, and the global column selection.
"""

import pytest

from cisco_store import (
    ValidationFailedError,
    count_accounts,
    get_account_facets,
    import_accounts_csv,
    iter_accounts,
    list_accounts,
    purge_accounts,
    search_account_options,
)
from db import transaction, utcnow
from settings_store import (
    DEFAULT_ALLOCATION_COLUMN_KEYS,
    SettingsError,
    get_allocation_columns,
    reset_allocation_columns,
    set_allocation_columns,
)

REAL_HEADER = (
    "SAVM_ID,UNIFIED_ACCOUNT_NAME,UNIFIED_STATE,SALES LEVEL 1,SALES LEVEL 2,"
    "SALES LEVEL 3,SALES LEVEL 4,SALES LEVEL 5,SALES LEVEL 6,SAV_VERTICAL_TOP,"
    "NODE_SEGMENT,NODE_SUBSEGMENT,NOMINATED_OWNER_CEC,NOMINATED_OWNER_EMAIL,"
    "NOMINATED_OWNER_NAME,NOMINATED_OWNER_JOB_TITLE,SOURCE,SAV_NAME,SFDC_ACC_NAME,"
    "SFDC_SAVM_ID,SAV_PEOPLE,SFDC_ACC_OWNER_EMAIL,EXISTS_IN_SAV,EXISTS_IN_SFDC,"
    "GS_ALL_EMAILS,NODE_ID,EDWSF_UPDATE_DTM,GS_MAX_END_DATE,NOMINATED_OWNER_IN_GS,"
    "NOMINATED_OWNER_IN_SFDC,NOMINATED_OWNER_IN_SAV,NOMINATION_PRIORITY,"
    "NOMINATION_REASON,CONFIDENCE_LEVEL,CANDIDATE_RANK"
)


def _row(
    savm_id="700000001",
    unified_name="ALPHA HOLDINGS",
    state="TX",
    sav_name="ALPHA GROUP",
    account_name="ALPHA HOLDINGS INC",
    vertical="RETAIL",
    segment="COMMERCIAL",
    subsegment="COM-FOCUS",
    source="SAV+SFDC",
    sl2="US COMMERCIAL",
    sl3="COMMERCIAL EAST AREA",
    sl4="TRI-STATE COMMERCIAL OPERATION",
    sl5="PHILADELPHIA REGION",
    sl6="CEA_PHILADELPHIA 1",
):
    return ",".join(
        [
            savm_id,
            unified_name,
            state,
            "Americas",
            sl2,
            sl3,
            sl4,
            sl5,
            sl6,
            vertical,
            segment,
            subsegment,
            "aeone",
            "ae.one@example.com",
            "AE One",
            "Account Executive - Portfolio",
            source,
            sav_name,
            account_name,
            savm_id,
            "AE One | aeone",
            "ae.one@example.com",
            "YES",
            "YES",
            "abarrien ; andsilva",
            "200283765",
            "00:10.6",
            "7/25/2026",
            "1",
            "1",
            "0",
            "2",
            "GS + SFDC agreement",
            "HIGH",
            "1",
        ]
    )


def _csv(*rows: str) -> bytes:
    return ("\n".join([REAL_HEADER, *rows]) + "\n").encode("utf-8")


@pytest.fixture
def seeded(db):
    import_accounts_csv(
        db,
        _csv(
            _row(),
            _row(
                savm_id="700000002",
                unified_name="BETA MANUFACTURING",
                account_name="BETA MANUFACTURING CO",
                sav_name="BETA GROUP",
                state="OK",
                vertical="MFG",
                sl2="GLOBAL ENTERPRISE SEGMENT",
                sl3="STR_GES WEST",
                sl4="STR_RED RIVER OPERATION",
                sl5="STR_NORTH_TX REGION",
                sl6="STM_EXCHANGE",
            ),
            _row(
                savm_id="700000003",
                unified_name="BETA UTILITIES",
                account_name="BETA UTILITIES LLC",
                sav_name="BETA GROUP",
                state="AR",
                vertical="ENG/UTL",
            ),
        ),
        "export.csv",
        actor="admin",
    )
    return db


# --------------------------------------------------------------------------
# new filters
# --------------------------------------------------------------------------

def test_filters_by_savm_group_id_and_unified_name(seeded):
    assert list_accounts(seeded, savm_group_id="700000002")["total"] == 1
    assert list_accounts(seeded, unified_account_name="BETA UTILITIES")["total"] == 1
    # Exact match, so a substring must not resolve.
    assert list_accounts(seeded, unified_account_name="BETA")["total"] == 0


def test_new_filters_compose_with_hierarchy(seeded):
    scoped = list_accounts(
        seeded, sl2="US COMMERCIAL", unified_account_name="ALPHA HOLDINGS"
    )
    assert scoped["total"] == 1
    assert scoped["items"][0]["savm_group_id"] == "700000001"

    assert (
        list_accounts(
            seeded, sl2="GLOBAL ENTERPRISE SEGMENT", unified_account_name="ALPHA HOLDINGS"
        )["total"]
        == 0
    )


def test_facets_drop_segment_and_keep_attribute_lists(seeded):
    facets = get_account_facets(seeded)
    assert "segment" not in facets
    assert facets["source"] == ["SAV+SFDC"]
    assert sorted(facets["state"]) == ["AR", "OK", "TX"]
    assert sorted(facets["sl2"]) == ["GLOBAL ENTERPRISE SEGMENT", "US COMMERCIAL"]


# --------------------------------------------------------------------------
# searchable options
# --------------------------------------------------------------------------

def test_option_search_matches_substring(seeded):
    result = search_account_options(seeded, column="unified_account_name", query="BETA")
    assert result["options"] == ["BETA MANUFACTURING", "BETA UTILITIES"]
    assert result["truncated"] is False
    assert result["column"] == "unified_account_name"


def test_option_search_without_query_lists_everything(seeded):
    result = search_account_options(seeded, column="savm_group_id")
    assert result["options"] == ["700000001", "700000002", "700000003"]


def test_option_search_is_scoped_by_other_filters(seeded):
    result = search_account_options(
        seeded, column="unified_account_name", sl2="GLOBAL ENTERPRISE SEGMENT"
    )
    assert result["options"] == ["BETA MANUFACTURING"]


def test_option_search_ignores_its_own_column_filter(seeded):
    # A dropdown must still offer its siblings once a value is chosen, or the
    # user can never change their selection.
    result = search_account_options(
        seeded, column="unified_account_name", unified_account_name="ALPHA HOLDINGS"
    )
    assert len(result["options"]) == 3


def test_option_search_rejects_columns_off_the_allow_list(seeded):
    with pytest.raises(ValidationFailedError):
        search_account_options(seeded, column="am_email")
    with pytest.raises(ValidationFailedError):
        search_account_options(seeded, column="1=1; DROP TABLE cisco_accounts")


def test_option_search_reports_truncation(seeded):
    result = search_account_options(seeded, column="savm_group_id", limit=2)
    assert len(result["options"]) == 2
    assert result["truncated"] is True


def test_option_search_validates_limit(seeded):
    with pytest.raises(ValidationFailedError):
        search_account_options(seeded, column="savm_group_id", limit=0)
    with pytest.raises(ValidationFailedError):
        search_account_options(seeded, column="savm_group_id", limit=201)


# --------------------------------------------------------------------------
# export iterator
# --------------------------------------------------------------------------

def test_iter_accounts_returns_every_row_not_just_a_page(seeded):
    rows = list(iter_accounts(seeded))
    assert len(rows) == 3
    # list_accounts caps at 200 per call; the export must not inherit that.
    assert len(rows) == count_accounts(seeded)


def test_iter_accounts_respects_filters(seeded):
    rows = list(iter_accounts(seeded, sl2="US COMMERCIAL"))
    assert {row["unified_account_name"] for row in rows} == {
        "ALPHA HOLDINGS",
        "BETA UTILITIES",
    }
    assert count_accounts(seeded, sl2="US COMMERCIAL") == 2


def test_iter_accounts_respects_search(seeded):
    rows = list(iter_accounts(seeded, search="BETA"))
    assert len(rows) == 2


def test_iter_accounts_excludes_inactive_by_default(seeded):
    with transaction(seeded):
        seeded.execute(
            "UPDATE cisco_accounts SET is_active = 0 WHERE savm_group_id = ?",
            ("700000003",),
        )
    assert len(list(iter_accounts(seeded))) == 2
    assert len(list(iter_accounts(seeded, include_inactive=True))) == 3


def test_iter_accounts_batches_without_dropping_rows(seeded):
    rows = list(iter_accounts(seeded, batch_size=1))
    assert len(rows) == 3


# --------------------------------------------------------------------------
# purge
# --------------------------------------------------------------------------

def _seed_match(conn, savm_group_id="700000001"):
    now = utcnow()
    with transaction(conn):
        conn.execute(
            """
            INSERT INTO matches (
                entity_name_original, entity_name_cleaned, entity_state,
                savm_group_id, match_level, status, source, created_by, created_at
            ) VALUES (?, ?, '', ?, 'SAVM', 'active', 'manual', 'admin', ?)
            """,
            ("Alpha Holdings", "ALPHA HOLDINGS", savm_group_id, now),
        )


def test_purge_deletes_every_reference_row(seeded):
    result = purge_accounts(seeded, actor="admin")
    assert result["deleted"] == 3
    assert count_accounts(seeded, include_inactive=True) == 0
    assert list_accounts(seeded)["total"] == 0


def test_purge_flags_matches_unlinked_and_never_deletes_them(seeded):
    _seed_match(seeded)
    result = purge_accounts(seeded, actor="admin")

    assert result["newly_unlinked"] == 1
    row = seeded.execute("SELECT status, link_status FROM matches").fetchone()
    # The approved decision survives an emptied reference.
    assert row["status"] == "active"
    assert row["link_status"] == "unlinked"


def test_purge_records_an_import_batch(seeded):
    purge_accounts(seeded, actor="admin")
    batch = seeded.execute(
        "SELECT filename, actor, row_count FROM import_batches ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert "purge" in batch["filename"]
    assert batch["actor"] == "admin"
    assert batch["row_count"] == 3


def test_purge_on_an_empty_table_is_harmless(db):
    assert purge_accounts(db, actor="admin") == {"deleted": 0, "newly_unlinked": 0}


def test_reimport_after_purge_relinks_matches(seeded):
    _seed_match(seeded)
    purge_accounts(seeded, actor="admin")
    import_accounts_csv(seeded, _csv(_row()), "export.csv", actor="admin")

    row = seeded.execute("SELECT link_status FROM matches").fetchone()
    assert row["link_status"] == "linked"


# --------------------------------------------------------------------------
# global column selection
# --------------------------------------------------------------------------

def test_allocation_columns_default_to_the_shipped_table(db):
    settings = get_allocation_columns(db)
    assert settings["selected"] == list(DEFAULT_ALLOCATION_COLUMN_KEYS)
    assert settings["is_default"] is True
    assert {column["key"] for column in settings["available"]} >= set(
        DEFAULT_ALLOCATION_COLUMN_KEYS
    )


def test_default_table_uses_unified_name_instead_of_sav_and_sfdc_names():
    assert "unified_account_name" in DEFAULT_ALLOCATION_COLUMN_KEYS
    assert "savm_group_name" not in DEFAULT_ALLOCATION_COLUMN_KEYS
    assert "sfdc_account_name" not in DEFAULT_ALLOCATION_COLUMN_KEYS


def test_allocation_columns_persist_and_report_non_default(db):
    saved = set_allocation_columns(db, ["savm_group_id", "state"], actor="admin")
    assert saved["selected"] == ["savm_group_id", "state"]
    assert saved["is_default"] is False
    assert get_allocation_columns(db)["selected"] == ["savm_group_id", "state"]


def test_allocation_columns_preserve_requested_order(db):
    saved = set_allocation_columns(db, ["state", "savm_group_id", "source"])
    assert saved["selected"] == ["state", "savm_group_id", "source"]


def test_allocation_columns_deduplicate(db):
    saved = set_allocation_columns(db, ["state", "state", "source"])
    assert saved["selected"] == ["state", "source"]


def test_allocation_columns_reject_unknown_keys(db):
    with pytest.raises(SettingsError):
        set_allocation_columns(db, ["state", "not_a_column"])


def test_allocation_columns_reject_an_empty_selection(db):
    with pytest.raises(SettingsError):
        set_allocation_columns(db, [])
    with pytest.raises(SettingsError):
        set_allocation_columns(db, ["   "])


def test_allocation_columns_reject_a_non_list(db):
    with pytest.raises(SettingsError):
        set_allocation_columns(db, "state")


def test_allocation_columns_reset_restores_defaults(db):
    set_allocation_columns(db, ["state"])
    restored = reset_allocation_columns(db, actor="admin")
    assert restored["selected"] == list(DEFAULT_ALLOCATION_COLUMN_KEYS)
    assert restored["is_default"] is True


def test_allocation_columns_survive_a_retired_column(db):
    # A selection saved before a column was removed must not break the page.
    with transaction(db):
        db.execute(
            """
            INSERT INTO app_settings (key, value, updated_by, updated_at)
            VALUES ('allocation_columns', '["gone_away"]', 'admin', ?)
            """,
            (utcnow(),),
        )
    assert get_allocation_columns(db)["selected"] == list(
        DEFAULT_ALLOCATION_COLUMN_KEYS
    )
