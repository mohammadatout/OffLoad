import pytest

from cisco_store import import_accounts_csv
from match_store import (
    STATUS_ACTIVE,
    STATUS_PENDING_ADMIN,
    STATUS_PENDING_REVIEW,
    STATUS_REJECTED,
    DuplicateActiveMatch,
    InvalidTransition,
    MatchNotFoundError,
    PermissionDeniedError,
    ValidationFailedError,
    approve_match,
    bulk_approve,
    create_match,
    get_active_library,
    get_match,
    get_match_history,
    get_rejected_keys,
    list_matches,
    reject_match,
    restore_match,
    soft_delete_match,
    update_notes,
)
from tests.test_cisco_store import _csv, _row


@pytest.fixture
def accounts(db):
    payload = _csv(
        _row(account_name="ALPHA HOLDINGS", state="TX", am_email="ae.one@example.com", priority="2"),
        _row(account_name="ALPHA HOLDINGS IT", state="VA", am_email="second@example.com", priority="4"),
        _row(savm_id="700000002", account_name="BETA PACKAGING", state="PA",
             sav_name="BETA GROUP", am_email="ae.two@example.com", priority="2"),
    )
    import_accounts_csv(db, payload, "accounts.csv", actor="admin")
    return db


def _payload(**overrides):
    base = {
        "entity_name_original": "TX-ALPHA HOLDINGS",
        "entity_name_cleaned": "ALPHA HOLDINGS",
        "entity_state": "TX",
        "savm_group_id": "700000001",
        "confidence_score": 0.80,
        "match_stage": "stage_2_confident",
        "source": "match_run",
        "source_detail": "internal.csv",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------- creation

def test_high_score_goes_to_admin_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.97), actor="alice")
    assert match["status"] == STATUS_PENDING_ADMIN


def test_low_score_goes_to_review_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.72), actor="alice")
    assert match["status"] == STATUS_PENDING_REVIEW


def test_exactly_threshold_goes_to_admin_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.95), actor="alice")
    assert match["status"] == STATUS_PENDING_ADMIN


def test_missing_score_goes_to_review(accounts):
    match = create_match(accounts, _payload(confidence_score=None), actor="alice")
    assert match["status"] == STATUS_PENDING_REVIEW


def test_match_level_defaults_to_savm_without_account(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    assert match["match_level"] == "SAVM"


def test_match_level_defaults_to_sfdc_with_account(accounts):
    match = create_match(
        accounts,
        _payload(sfdc_account_name="ALPHA HOLDINGS", account_state="TX"),
        actor="alice",
    )
    assert match["match_level"] == "SFDC"


def test_savm_level_snapshot_uses_best_ranked_am(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    assert match["snap_savm_group_name"] == "ALPHA GROUP"
    assert match["snap_am_email"] == "ae.one@example.com"
    assert match["snap_am_confidence"] == "HIGH"


def test_sfdc_level_snapshot_uses_its_own_am(accounts):
    match = create_match(
        accounts,
        _payload(sfdc_account_name="ALPHA HOLDINGS IT", account_state="VA"),
        actor="alice",
    )
    assert match["snap_account_name"] == "ALPHA HOLDINGS IT"
    assert match["snap_am_email"] == "second@example.com"


def test_unknown_group_marks_match_unlinked(accounts):
    match = create_match(accounts, _payload(savm_group_id="no-such-group"), actor="alice")
    assert match["link_status"] == "unlinked"


def test_required_fields_enforced(accounts):
    with pytest.raises(ValidationFailedError):
        create_match(accounts, _payload(entity_name_original=""), actor="alice")
    with pytest.raises(ValidationFailedError):
        create_match(accounts, _payload(entity_name_cleaned="  "), actor="alice")


def test_bad_score_rejected(accounts):
    with pytest.raises(ValidationFailedError):
        create_match(accounts, _payload(confidence_score="banana"), actor="alice")


def test_bad_source_rejected(accounts):
    with pytest.raises(ValidationFailedError):
        create_match(accounts, _payload(source="somewhere"), actor="alice")


def test_bad_match_level_rejected(accounts):
    with pytest.raises(ValidationFailedError):
        create_match(accounts, _payload(match_level="GROUP"), actor="alice")


def test_creation_writes_exactly_one_history_row(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    history = get_match_history(accounts, match["id"])
    assert len(history) == 1
    assert history[0]["event"] == "created"
    assert history[0]["actor"] == "alice"


# ---------------------------------------------------------------- approval

def test_reviewer_cannot_approve_admin_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.99), actor="alice")
    with pytest.raises(PermissionDeniedError):
        approve_match(accounts, match["id"], actor="bob", role="reviewer")


def test_admin_can_approve_admin_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.99), actor="alice")
    approved = approve_match(accounts, match["id"], actor="carol", role="admin")
    assert approved["status"] == STATUS_ACTIVE
    assert approved["decided_by"] == "carol"
    assert approved["decided_at"] is not None


def test_reviewer_can_approve_review_queue(accounts):
    match = create_match(accounts, _payload(confidence_score=0.71), actor="alice")
    approved = approve_match(accounts, match["id"], actor="bob", role="reviewer")
    assert approved["status"] == STATUS_ACTIVE


def test_two_active_matches_for_one_entity_blocked(accounts):
    first = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, first["id"], actor="bob", role="reviewer")

    second = create_match(
        accounts, _payload(savm_group_id="700000002"), actor="alice"
    )
    with pytest.raises(DuplicateActiveMatch):
        approve_match(accounts, second["id"], actor="bob", role="reviewer")


def test_same_entity_different_state_can_both_be_active(accounts):
    first = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, first["id"], actor="bob", role="reviewer")
    second = create_match(accounts, _payload(entity_state="VA"), actor="alice")
    approve_match(accounts, second["id"], actor="bob", role="reviewer")
    assert list_matches(accounts, {"status": STATUS_ACTIVE})["total"] == 2


def test_approve_records_history(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer", notes="looks right")
    events = [h["event"] for h in get_match_history(accounts, match["id"])]
    assert events == ["approved", "created"]


# ---------------------------------------------------------------- rejection

def test_reject_requires_notes(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    for empty in (None, "", "   "):
        with pytest.raises(ValidationFailedError):
            reject_match(accounts, match["id"], actor="bob", notes=empty)


def test_reject_sets_status_and_notes(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    rejected = reject_match(accounts, match["id"], actor="bob", notes="wrong entity")
    assert rejected["status"] == STATUS_REJECTED
    assert rejected["notes"] == "wrong entity"


def test_active_match_can_be_rejected(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer")
    rejected = reject_match(accounts, match["id"], actor="bob", notes="changed my mind")
    assert rejected["status"] == STATUS_REJECTED


def test_illegal_transition_raises(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    reject_match(accounts, match["id"], actor="bob", notes="no")
    with pytest.raises(InvalidTransition):
        approve_match(accounts, match["id"], actor="bob", role="admin")


# ---------------------------------------------------------------- notes / delete

def test_update_notes_records_field_change(accounts):
    match = create_match(accounts, _payload(notes="first"), actor="alice")
    update_notes(accounts, match["id"], actor="bob", notes="second")
    history = get_match_history(accounts, match["id"])
    assert history[0]["event"] == "edited"
    assert '"from": "first"' in history[0]["field_changes"]


def test_only_admin_can_delete(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    with pytest.raises(PermissionDeniedError):
        soft_delete_match(accounts, match["id"], actor="bob", role="reviewer")


def test_delete_is_soft_and_restorable(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer")

    deleted = soft_delete_match(accounts, match["id"], actor="carol", role="admin", notes="dupe")
    assert deleted["status"] == "deleted"
    assert deleted["prev_status"] == STATUS_ACTIVE

    restored = restore_match(accounts, match["id"], actor="carol", role="admin")
    assert restored["status"] == STATUS_ACTIVE
    assert restored["prev_status"] is None

    row = accounts.execute("SELECT COUNT(*) AS c FROM matches").fetchone()
    assert row["c"] == 1


def test_restore_requires_deleted_status(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    with pytest.raises(InvalidTransition):
        restore_match(accounts, match["id"], actor="carol", role="admin")


def test_missing_match_raises(accounts):
    with pytest.raises(MatchNotFoundError):
        approve_match(accounts, 999999, actor="bob", role="admin")


# ---------------------------------------------------------------- bulk

def test_bulk_approve_reports_per_row_failures(accounts):
    good = create_match(accounts, _payload(confidence_score=0.99), actor="alice")
    other = create_match(
        accounts, _payload(entity_name_cleaned="BETA PACKAGING", savm_group_id="700000002"), actor="alice"
    )
    reject_match(accounts, other["id"], actor="bob", notes="no")

    result = bulk_approve(accounts, [good["id"], other["id"], 999999], actor="carol", role="admin")
    assert result["approved"] == 1
    assert len(result["failed"]) == 2


# ---------------------------------------------------------------- reads

def test_active_library_shape(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer")

    library = get_active_library(accounts)
    assert ("ALPHA HOLDINGS", "TX") in library
    entry = library[("ALPHA HOLDINGS", "TX")]
    assert entry["savm_group_id"] == "700000001"
    assert entry["savm_group_name"] == "ALPHA GROUP"
    assert entry["am_email"] == "ae.one@example.com"


def test_pending_matches_are_not_in_library(accounts):
    create_match(accounts, _payload(), actor="alice")
    assert get_active_library(accounts) == {}


def test_rejected_keys_include_account_detail(accounts):
    match = create_match(
        accounts, _payload(sfdc_account_name="ALPHA HOLDINGS", account_state="TX"), actor="alice"
    )
    reject_match(accounts, match["id"], actor="bob", notes="nope")

    keys = get_rejected_keys(accounts)
    assert ("ALPHA HOLDINGS", "700000001", "ALPHA HOLDINGS", "TX") in keys


def test_rejecting_one_account_does_not_suppress_siblings(accounts):
    match = create_match(
        accounts, _payload(sfdc_account_name="ALPHA HOLDINGS", account_state="TX"), actor="alice"
    )
    reject_match(accounts, match["id"], actor="bob", notes="nope")

    keys = get_rejected_keys(accounts)
    assert ("ALPHA HOLDINGS", "700000001", "ALPHA HOLDINGS IT", "VA") not in keys


def test_list_matches_enriches_with_live_account(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    item = get_match(accounts, match["id"])
    assert item["account"]["savm_group_name"] == "ALPHA GROUP"
    assert item["account"]["tier"] == "ENT-FOCUS"
    assert item["am"]["am_email"] == "ae.one@example.com"
    assert item["drifted"] is False


def test_drift_detected_when_reference_changes(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer")
    assert get_match(accounts, match["id"])["drifted"] is False

    import_accounts_csv(
        accounts,
        _csv(_row(account_name="ALPHA HOLDINGS", state="TX", sav_name="ALPHA GROUP RENAMED")),
        "v2.csv",
        actor="admin",
    )
    assert get_match(accounts, match["id"])["drifted"] is True


def test_drift_detected_when_am_changes(accounts):
    match = create_match(accounts, _payload(), actor="alice")
    approve_match(accounts, match["id"], actor="bob", role="reviewer")

    import_accounts_csv(
        accounts,
        _csv(_row(account_name="ALPHA HOLDINGS", state="TX", am_email="newam@example.com")),
        "v2.csv",
        actor="admin",
    )
    assert get_match(accounts, match["id"])["drifted"] is True


def test_filters(accounts):
    create_match(accounts, _payload(confidence_score=0.99), actor="alice")
    create_match(
        accounts,
        _payload(entity_name_cleaned="BETA PACKAGING", entity_state="PA",
                 savm_group_id="700000002", confidence_score=0.5),
        actor="alice",
    )

    assert list_matches(accounts, {"status": STATUS_PENDING_ADMIN})["total"] == 1
    assert list_matches(accounts, {"status": STATUS_PENDING_REVIEW})["total"] == 1
    assert list_matches(accounts, {"search": "PACKAGING"})["total"] == 1
    assert list_matches(accounts, {"state": "PA"})["total"] == 1
    assert list_matches(accounts, {"vertical": "RETAIL"})["total"] == 2
    assert list_matches(accounts, {"tier": "ENT-FOCUS"})["total"] == 2
    assert list_matches(accounts, {"match_level": "SAVM"})["total"] == 2
    assert list_matches(accounts, {"link_status": "linked"})["total"] == 2


def test_list_matches_validates_filters(accounts):
    with pytest.raises(ValidationFailedError):
        list_matches(accounts, {"limit": 0})
    with pytest.raises(ValidationFailedError):
        list_matches(accounts, {"limit": 500})
    with pytest.raises(ValidationFailedError):
        list_matches(accounts, {"offset": -1})
    with pytest.raises(ValidationFailedError):
        list_matches(accounts, {"status": "nonsense"})
    with pytest.raises(ValidationFailedError):
        list_matches(accounts, {"link_status": "nonsense"})
