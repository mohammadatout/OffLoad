import pytest

from cisco_store import (
    AmbiguousAccountReference,
    UnknownAccountReference,
    ValidationFailedError,
    flag_orphan_matches,
    get_account,
    get_account_facets,
    get_group_accounts,
    get_group_summary,
    group_exists,
    import_accounts_csv,
    list_accounts,
    resolve_account_am,
    resolve_account_reference,
    resolve_group_am,
)
from db import transaction, utcnow

# The 35 columns of the real SQL export, in file order.
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
    account_name="ALPHA HOLDINGS",
    state="TX",
    am_cec="aeone",
    am_email="ae.one@example.com",
    am_name="AE One",
    priority="2",
    confidence="HIGH",
    sav_name="ALPHA GROUP",
    vertical="RETAIL",
    segment="ENTERPRISE",
    subsegment="ENT-FOCUS",
    sl2="GLOBAL ENTERPRISE SEGMENT",
    sl3="STR_GES WEST",
    sl4="STR_RED RIVER OPERATION",
    sl5="STR_NORTH_TX REGION",
    sl6="STM_REGION_A",
):
    return ",".join(
        [
            savm_id,
            account_name,
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
            am_cec,
            am_email,
            am_name,
            "Account Executive - Portfolio",
            "SAV+SFDC",
            sav_name,
            account_name,
            savm_id,
            "AE One | aeone",
            am_email,
            "YES",
            "YES",
            "abarrien ; andsilva",
            "200283765",
            "00:10.6",
            "7/25/2026",
            "1",
            "1",
            "0",
            priority,
            "GS + SFDC agreement",
            confidence,
            "1",
        ]
    )


def _csv(*rows: str) -> bytes:
    return ("\n".join([REAL_HEADER, *rows]) + "\n").encode("utf-8")


def test_real_header_maps_all_columns(db):
    summary = import_accounts_csv(db, _csv(_row()), "export.csv", actor="admin")
    assert summary["row_count"] == 1
    assert summary["inserted"] == 1
    assert summary["error_report"]["warnings"] == []

    account = list_accounts(db)["items"][0]
    assert account["savm_group_id"] == "700000001"
    assert account["savm_group_name"] == "ALPHA GROUP"
    assert account["sfdc_account_name"] == "ALPHA HOLDINGS"
    assert account["unified_account_name"] == "ALPHA HOLDINGS"
    assert account["state"] == "TX"
    assert account["sl1"] == "Americas"
    assert account["sl6"] == "STM_REGION_A"
    assert account["vertical"] == "RETAIL"
    assert account["segment"] == "ENTERPRISE"
    assert account["tier"] == "ENT-FOCUS"
    assert account["source"] == "SAV+SFDC"
    assert account["node_id"] == "200283765"
    assert account["am_cec"] == "aeone"
    assert account["am_name"] == "AE One"
    assert account["am_email"] == "ae.one@example.com"
    assert account["am_confidence"] == "HIGH"
    assert account["am_priority"] == 2
    assert account["am_candidate_rank"] == 1
    assert account["sav_people"] == "AE One | aeone"
    assert account["gs_max_end_date"] == "7/25/2026"


def test_header_only_file_is_valid(db):
    summary = import_accounts_csv(db, _csv(), "empty.csv", actor="admin")
    assert summary["row_count"] == 0
    assert summary["inserted"] == 0
    assert list_accounts(db)["total"] == 0


def test_blank_rows_are_skipped_not_failed(db):
    blank = "," * (REAL_HEADER.count(",") )
    payload = _csv(_row(), blank, blank)
    summary = import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert summary["row_count"] == 3
    assert summary["skipped_blank"] == 2
    assert summary["failed"] == 0
    assert summary["inserted"] == 1


def test_same_account_name_in_two_states_creates_two_rows(db):
    payload = _csv(
        _row(savm_id="700000008", account_name="GAMMA RESOURCES INC", state="OK"),
        _row(savm_id="700000008", account_name="GAMMA RESOURCES INC", state="TX"),
    )
    summary = import_accounts_csv(db, payload, "export.csv", actor="admin")
    assert summary["inserted"] == 2
    assert list_accounts(db)["total"] == 2


def test_exact_duplicate_key_collapses_to_one_row(db):
    payload = _csv(
        _row(am_email="first@example.com"),
        _row(am_email="second@example.com"),
    )
    summary = import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert summary["inserted"] == 1
    assert summary["skipped"] == 1
    items = list_accounts(db)["items"]
    assert len(items) == 1
    assert items[0]["am_email"] == "second@example.com"


def test_missing_group_id_fails_only_that_row(db):
    payload = _csv(_row(), _row(savm_id="", account_name="NO GROUP"))
    summary = import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert summary["failed"] == 1
    assert summary["inserted"] == 1
    reasons = [r["reason"] for r in summary["error_report"]["rows"]]
    assert "missing_savm_group_id" in reasons


def test_missing_required_column_fails_whole_import(db):
    payload = b"UNIFIED_ACCOUNT_NAME,UNIFIED_STATE\nACME,CA\n"
    with pytest.raises(ValidationFailedError) as exc:
        import_accounts_csv(db, payload, "bad.csv", actor="admin")
    assert "savm_group_id" in str(exc.value)


def test_unknown_column_warns_but_succeeds(db):
    header = REAL_HEADER + ",MYSTERY_COLUMN"
    payload = (header + "\n" + _row() + ",surprise\n").encode("utf-8")
    summary = import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert summary["inserted"] == 1
    assert "MYSTERY_COLUMN" in summary["error_report"]["warnings"][0]


def test_reimport_deactivates_absent_rows(db):
    import_accounts_csv(db, _csv(_row(account_name="KEEP"), _row(account_name="DROP")), "v1.csv", actor="admin")
    summary = import_accounts_csv(db, _csv(_row(account_name="KEEP")), "v2.csv", actor="admin")

    assert summary["updated"] == 1
    assert summary["deactivated"] == 1
    active = list_accounts(db)
    assert active["total"] == 1
    assert active["items"][0]["sfdc_account_name"] == "KEEP"
    assert list_accounts(db, include_inactive=True)["total"] == 2


def test_non_utf8_payload_rejected(db):
    with pytest.raises(ValidationFailedError):
        import_accounts_csv(db, b"\xff\xfe not utf8", "bad.csv", actor="admin")


# ---------------------------------------------------------------- AM resolution

def test_group_am_picks_lowest_priority(db):
    payload = _csv(
        _row(account_name="MEDIUM CHILD", am_email="medium@example.com", priority="4", confidence="MEDIUM"),
        _row(account_name="BEST CHILD", am_email="best@example.com", priority="2", confidence="HIGH"),
        _row(account_name="WORST CHILD", am_email="worst@example.com", priority="9", confidence="LOW"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    am = resolve_group_am(db, "700000001")
    assert am["am_email"] == "best@example.com"
    assert am["am_confidence"] == "HIGH"
    assert am["am_source_account_name"] == "BEST CHILD"


def test_group_am_tie_breaks_alphabetically(db):
    payload = _csv(
        _row(account_name="ZEBRA", am_email="zebra@example.com", priority="2"),
        _row(account_name="ALPHA", am_email="alpha@example.com", priority="2"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert resolve_group_am(db, "700000001")["am_email"] == "alpha@example.com"


def test_group_am_ranks_missing_priority_last(db):
    payload = _csv(
        _row(account_name="NO PRIORITY", am_email="nopri@example.com", priority=""),
        _row(account_name="HAS PRIORITY", am_email="haspri@example.com", priority="7"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert resolve_group_am(db, "700000001")["am_email"] == "haspri@example.com"


def test_group_am_returns_none_when_no_child_has_email(db):
    payload = _csv(
        _row(account_name="A", am_email="", am_name=""),
        _row(account_name="B", am_email="", am_name=""),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert resolve_group_am(db, "700000001") is None


def test_unparseable_priority_becomes_none(db):
    import_accounts_csv(db, _csv(_row(priority="not-a-number")), "export.csv", actor="admin")
    assert list_accounts(db)["items"][0]["am_priority"] is None


def test_sfdc_level_am_ignores_better_ranked_sibling(db):
    """An SFDC-level match uses its own row's AM even when a sibling ranks higher."""
    payload = _csv(
        _row(account_name="BEST CHILD", am_email="best@example.com", priority="2"),
        _row(account_name="THIS CHILD", am_email="mine@example.com", priority="4"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    account = resolve_account_reference(db, "700000001", "THIS CHILD", "TX")
    am = resolve_account_am(account)
    assert am["am_email"] == "mine@example.com"
    assert resolve_group_am(db, "700000001")["am_email"] == "best@example.com"


def test_account_am_none_without_email(db):
    assert resolve_account_am({"am_email": "", "am_name": "Ghost"}) is None


# ---------------------------------------------------------------- lookups

def test_resolve_reference_requires_group(db):
    with pytest.raises(UnknownAccountReference):
        resolve_account_reference(db, None)


def test_resolve_reference_unknown_group(db):
    with pytest.raises(UnknownAccountReference):
        resolve_account_reference(db, "does-not-exist")


def test_resolve_reference_ambiguous_without_account_name(db):
    payload = _csv(_row(account_name="ONE"), _row(account_name="TWO"))
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    with pytest.raises(AmbiguousAccountReference):
        resolve_account_reference(db, "700000001")


def test_group_helpers(db):
    payload = _csv(_row(account_name="ONE"), _row(account_name="TWO"))
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert group_exists(db, "700000001") is True
    assert group_exists(db, "nope") is False
    assert len(get_group_accounts(db, "700000001")) == 2

    summary = get_group_summary(db, "700000001")
    assert summary["savm_group_name"] == "ALPHA GROUP"
    assert summary["tier"] == "ENT-FOCUS"
    assert summary["account_count"] == 2
    assert summary["am"]["am_email"] == "ae.one@example.com"


def test_get_account_by_id(db):
    import_accounts_csv(db, _csv(_row()), "export.csv", actor="admin")
    account_id = list_accounts(db)["items"][0]["id"]
    assert get_account(db, account_id)["sfdc_account_name"] == "ALPHA HOLDINGS"
    assert get_account(db, 999999) is None


def test_search_and_filters(db):
    payload = _csv(
        _row(account_name="ZEPHYR CORP", state="CA", vertical="RETAIL"),
        _row(account_name="ORION CORP", state="TX", vertical="MFG"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert list_accounts(db, search="ZEPHYR")["total"] == 1
    assert list_accounts(db, state="TX")["total"] == 1
    assert list_accounts(db, vertical="MFG")["total"] == 1
    assert list_accounts(db, tier="ENT-FOCUS")["total"] == 2
    assert list_accounts(db, source="SAV+SFDC")["total"] == 2


def test_sales_hierarchy_filters(db):
    payload = _csv(
        _row(
            account_name="PS ALPHA",
            sl2="US PS Market Segment",
            sl3="PS-WEST",
            sl4="PS-REGION-A",
            sl5="PS-DIST-1",
            sl6="PHOENIX WEST",
        ),
        _row(
            account_name="PS BETA",
            sl2="US PS Market Segment",
            sl3="PS-WEST",
            sl4="PS-REGION-A",
            sl5="PS-DIST-2",
            sl6="PHOENIX EAST",
        ),
        _row(
            account_name="COMM ONE",
            sl2="US COMMERCIAL",
            sl3="COMM-NORTH",
            sl4="COMM-REGION",
            sl5="COMM-DIST",
            sl6="COMM CITY",
        ),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    assert list_accounts(db, sl2="US PS Market Segment")["total"] == 2
    assert list_accounts(db, sl2="US PS Market Segment", sl3="PS-WEST")["total"] == 2
    assert list_accounts(db, sl4="PS-REGION-A", sl5="PS-DIST-2")["total"] == 1
    assert list_accounts(db, sl6="COMM CITY")["total"] == 1


def test_facets_cascade_and_sl6_server_side_search(db):
    payload = _csv(
        _row(
            account_name="PS ALPHA",
            sl2="US PS Market Segment",
            sl3="PS-WEST",
            sl4="PS-REGION-A",
            sl5="PS-DIST-1",
            sl6="PHOENIX WEST",
        ),
        _row(
            account_name="PS BETA",
            sl2="US PS Market Segment",
            sl3="PS-WEST",
            sl4="PS-REGION-A",
            sl5="PS-DIST-1",
            sl6="PHOENIX EAST",
        ),
        _row(
            account_name="PS GAMMA",
            sl2="US PS Market Segment",
            sl3="PS-EAST",
            sl4="PS-REGION-B",
            sl5="PS-DIST-2",
            sl6="BOSTON CORE",
        ),
        _row(
            account_name="COMM ONE",
            sl2="US COMMERCIAL",
            sl3="COMM-NORTH",
            sl4="COMM-REGION",
            sl5="COMM-DIST",
            sl6="DALLAS CORE",
        ),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    narrowed = get_account_facets(
        db,
        sl2="US PS Market Segment",
        sl3="PS-WEST",
        sl4="PS-REGION-A",
        sl5="PS-DIST-1",
    )
    assert "sl1" not in narrowed
    assert sorted(narrowed["sl5"]) == ["PS-DIST-1"]
    assert sorted(narrowed["sl6"]) == ["PHOENIX EAST", "PHOENIX WEST"]

    searched = get_account_facets(
        db,
        sl2="US PS Market Segment",
        sl6_search="pho",
    )
    assert sorted(searched["sl6"]) == ["PHOENIX EAST", "PHOENIX WEST"]
    assert searched["sl6_server_side"] is True
    assert searched["sl6_min_search_chars"] == 3


def test_sub_segment_filter_uses_tier_column(db):
    payload = _csv(
        _row(account_name="HIGH TOUCH", subsegment="PS-HIGH TOUCH"),
        _row(account_name="VELOCITY", subsegment="PS-VELOCITY"),
    )
    import_accounts_csv(db, payload, "export.csv", actor="admin")

    high_touch = list_accounts(db, tier="PS-HIGH TOUCH")
    assert high_touch["total"] == 1
    assert high_touch["items"][0]["sfdc_account_name"] == "HIGH TOUCH"


def test_list_accounts_rejects_bad_pagination(db):
    with pytest.raises(ValidationFailedError):
        list_accounts(db, limit=0)
    with pytest.raises(ValidationFailedError):
        list_accounts(db, limit=201)
    with pytest.raises(ValidationFailedError):
        list_accounts(db, offset=-1)


# ---------------------------------------------------------------- orphans

def _insert_active_match(conn, group_id):
    now = utcnow()
    with transaction(conn):
        cur = conn.execute(
            """
            INSERT INTO matches (entity_name_original, entity_name_cleaned, entity_state,
                                 savm_group_id, status, source, created_by, created_at)
            VALUES ('Acme Co', 'ACME CO', 'TX', ?, 'active', 'manual', 'tester', ?)
            """,
            (group_id, now),
        )
        return cur.lastrowid


def test_missing_group_flags_match_unlinked(db):
    import_accounts_csv(db, _csv(_row()), "v1.csv", actor="admin")
    match_id = _insert_active_match(db, "700000001")

    summary = import_accounts_csv(db, _csv(_row(savm_id="999")), "v2.csv", actor="admin")

    assert summary["newly_unlinked"] == 1
    row = db.execute("SELECT status, link_status FROM matches WHERE id = ?", (match_id,)).fetchone()
    assert row["link_status"] == "unlinked"
    assert row["status"] == "active"

    events = db.execute(
        "SELECT event FROM match_history WHERE match_id = ?", (match_id,)
    ).fetchall()
    assert "unlinked" in [e["event"] for e in events]


def test_restored_group_relinks_match(db):
    import_accounts_csv(db, _csv(_row()), "v1.csv", actor="admin")
    match_id = _insert_active_match(db, "700000001")
    import_accounts_csv(db, _csv(_row(savm_id="999")), "v2.csv", actor="admin")
    import_accounts_csv(db, _csv(_row()), "v3.csv", actor="admin")

    row = db.execute("SELECT link_status FROM matches WHERE id = ?", (match_id,)).fetchone()
    assert row["link_status"] == "linked"


def test_flag_orphans_is_idempotent(db):
    import_accounts_csv(db, _csv(_row()), "v1.csv", actor="admin")
    match_id = _insert_active_match(db, "700000001")
    import_accounts_csv(db, _csv(_row(savm_id="999")), "v2.csv", actor="admin")

    assert flag_orphan_matches(db) == 0
    events = db.execute(
        "SELECT COUNT(*) AS c FROM match_history WHERE match_id = ? AND event = 'unlinked'",
        (match_id,),
    ).fetchone()["c"]
    assert events == 1
