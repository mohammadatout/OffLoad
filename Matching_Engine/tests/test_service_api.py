import csv
import io
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

MATCHING_ENGINE_DIR = Path(__file__).resolve().parents[1]
if str(MATCHING_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(MATCHING_ENGINE_DIR))

from auth import create_user
from cisco_store import import_accounts_csv
from db import get_connection, init_db
from matcher_service import app

ADMIN_PASSWORD = "AdminPassword123!"
REVIEWER_PASSWORD = "ReviewerPassword123!"

# Minimal slice of the real export: group id, group name, account name, state, AM.
ACCOUNT_HEADERS = [
    "SAVM_ID",
    "SAV_NAME",
    "SFDC_ACC_NAME",
    "UNIFIED_STATE",
    "SAV_VERTICAL_TOP",
    "NODE_SUBSEGMENT",
    "NOMINATED_OWNER_NAME",
    "NOMINATED_OWNER_EMAIL",
    "CONFIDENCE_LEVEL",
    "NOMINATION_PRIORITY",
]
ACCOUNT_ROWS = [
    [
        "SID-1",
        "ALPHA UNIVERSITY",
        "ALPHA UNIVERSITY",
        "CA",
        "EDU",
        "ENT-FOCUS",
        "AE Three",
        "ae.three@example.com",
        "HIGH",
        "2",
    ]
]


def _csv_bytes(headers: list[str], rows: list[list[str]]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


@pytest.fixture
def service(tmp_path, monkeypatch):
    db_path = tmp_path / "service.db"
    monkeypatch.setenv("OFFLOAD_DB_PATH", str(db_path))

    conn = get_connection(db_path=str(db_path))
    try:
        init_db(conn)
        create_user(conn, "admin", ADMIN_PASSWORD, "admin", "seed")
        create_user(conn, "reviewer", REVIEWER_PASSWORD, "reviewer", "seed")
        import_accounts_csv(
            conn=conn,
            file_bytes=_csv_bytes(ACCOUNT_HEADERS, ACCOUNT_ROWS),
            filename="accounts.csv",
            actor="admin",
        )
    finally:
        conn.close()

    with TestClient(app) as client:
        yield client


def _login(client: TestClient, username: str, password: str) -> None:
    response = client.post(
        "/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text


def _match_files():
    internal_csv = _csv_bytes(["Internal Name"], [["CA-ALPHA UNIVERSITY"]])
    external_csv = _csv_bytes(
        ["SAVM_ID", "SAV_NAME", "SFDC_ACC_NAME", "UNIFIED_STATE"],
        [["SID-1", "ALPHA UNIVERSITY", "ALPHA UNIVERSITY", "CA"]],
    )
    return {
        "internal_file": ("internal.csv", internal_csv, "text/csv"),
        "external_file": ("external.csv", external_csv, "text/csv"),
    }


def _config(external_col: str = "SAV_NAME") -> dict:
    return {
        "internal_col": "Internal Name",
        "external_col": external_col,
        "use_state_blocking": False,
        "use_context_validation": True,
        "abbreviations": None,
    }


# ---------------------------------------------------------------- auth

def test_health_needs_no_auth(service):
    assert service.get("/health").json() == {"status": "ok"}


def test_unauthenticated_request_returns_401(service):
    response = service.get("/matches")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_reviewer_cannot_access_admin_route(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.get("/users")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_bad_password_and_unknown_user_give_identical_errors(service):
    wrong = service.post(
        "/auth/login", json={"username": "admin", "password": "nope-nope-nope"}
    )
    ghost = service.post(
        "/auth/login", json={"username": "ghost", "password": "nope-nope-nope"}
    )
    assert wrong.status_code == ghost.status_code == 401
    assert wrong.json() == ghost.json()
    assert wrong.json()["error"]["message"] == "Invalid username or password."


def test_session_cookie_is_httponly(service):
    response = service.post(
        "/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}
    )
    cookie_header = response.headers.get("set-cookie", "")
    assert "httponly" in cookie_header.lower()
    assert "samesite=lax" in cookie_header.lower()


def test_logout_invalidates_session(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/auth/me").status_code == 200
    assert service.post("/auth/logout").status_code == 200
    assert service.get("/auth/me").status_code == 401


def test_user_endpoints_never_leak_password_hash(service):
    _login(service, "admin", ADMIN_PASSWORD)

    listing = service.get("/users").json()
    assert listing and all("password_hash" not in u for u in listing)

    created = service.post(
        "/users",
        json={"username": "carol", "password": "CarolPassword123", "role": "reviewer"},
    )
    assert created.status_code == 200
    assert "password_hash" not in created.json()

    patched = service.patch(f"/users/{created.json()['id']}", json={"role": "admin"})
    assert "password_hash" not in patched.json()


def test_weak_password_rejected_by_api(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post(
        "/users", json={"username": "dave", "password": "short", "role": "reviewer"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_duplicate_username_conflicts(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post(
        "/users", json={"username": "admin", "password": "AnotherPassword1", "role": "admin"}
    )
    assert response.status_code == 409


# ---------------------------------------------------------------- accounts

def test_accounts_listing_and_group_lookup(service):
    _login(service, "admin", ADMIN_PASSWORD)

    accounts = service.get("/accounts").json()
    assert accounts["total"] == 1
    assert accounts["items"][0]["savm_group_name"] == "ALPHA UNIVERSITY"

    group = service.get("/accounts/group/SID-1").json()
    assert group["tier"] == "ENT-FOCUS"
    assert group["am"]["am_email"] == "ae.three@example.com"
    assert len(group["accounts"]) == 1

    assert service.get("/accounts/group/nope").status_code == 404


def test_account_facets_power_the_filter_dropdowns(service):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        ["SID-2", "BETA COLLEGE", "BETA COLLEGE", "TX", "MFG", "COM-FOCUS", "G H", "ae.five@example.com", "MEDIUM", "4"],
        ["SID-2", "BETA COLLEGE", "BETA WEST", "TX", "MFG", "COM-FOCUS", "G H", "ae.five@example.com", "HIGH", "2"],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    facets = service.get("/accounts/facets").json()
    assert facets["state"] == ["CA", "TX"]
    assert facets["vertical"] == ["EDU", "MFG"]
    assert sorted(facets["tier"]) == ["COM-FOCUS", "ENT-FOCUS"]
    assert facets["total_accounts"] == 3
    assert facets["total_groups"] == 2


def test_accounts_filter_by_segment_and_tier(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts", params={"tier": "ENT-FOCUS"}).json()["total"] == 1
    assert service.get("/accounts", params={"tier": "NOPE"}).json()["total"] == 0


def test_facets_route_is_not_shadowed_by_account_id(service):
    """/accounts/facets must not be captured by /accounts/{account_id}."""
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts/facets").status_code == 200


def test_account_import_requires_admin(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, ACCOUNT_ROWS), "text/csv")},
    )
    assert response.status_code == 403


def test_account_import_rejects_non_csv(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post(
        "/accounts/import",
        files={"file": ("accounts.txt", b"not a csv", "text/plain")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_large_account_import_streams_without_buffering(service):
    """Exercises the streaming upload path used for the real 100+ MB export."""
    _login(service, "admin", ADMIN_PASSWORD)

    rows = [
        [
            f"SID-{index // 3}",
            f"GROUP {index // 3}",
            f"ACCOUNT NUMBER {index} HOLDINGS INCORPORATED",
            "CA",
            "EDU",
            "ENT-FOCUS",
            f"Owner {index}",
            f"owner{index}@example.com",
            "HIGH" if index % 2 else "MEDIUM",
            "2" if index % 2 else "4",
        ]
        for index in range(5000)
    ]

    response = service.post(
        "/accounts/import",
        files={"file": ("big.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )
    assert response.status_code == 200, response.text
    summary = response.json()
    assert summary["row_count"] == 5000
    assert summary["inserted"] == 5000
    assert summary["failed"] == 0

    # Group-level AM resolution still picks the best-ranked child at scale.
    group = service.get("/accounts/group/SID-0").json()
    assert group["am"]["am_confidence"] == "HIGH"
    assert service.get("/accounts").json()["total"] == 5000


def test_upload_over_the_limit_is_rejected(service, monkeypatch):
    _login(service, "admin", ADMIN_PASSWORD)
    monkeypatch.setenv("OFFLOAD_MAX_UPLOAD_BYTES", "512")

    rows = [
        [f"SID-{i}", f"GROUP {i}", f"ACCOUNT {i}", "CA", "EDU", "ENT-FOCUS", "X", "x@example.com", "HIGH", "2"]
        for i in range(200)
    ]
    response = service.post(
        "/accounts/import",
        files={"file": ("big.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"
    assert "MB limit" in response.json()["error"]["message"]


def test_non_utf8_account_import_is_rejected(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post(
        "/accounts/import",
        files={"file": ("bad.csv", b"SAVM_ID\n\xff\xfe\xff\n", "text/csv")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_account_import_via_api_returns_summary(service):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        ["SID-2", "BETA COLLEGE", "BETA COLLEGE", "TX", "EDU", "COM-FOCUS", "Grace H", "ae.four@example.com", "MEDIUM", "4"]
    ]
    response = service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["row_count"] == 2
    assert summary["inserted"] == 1
    assert summary["updated"] == 1


# ---------------------------------------------------------------- match run

def test_login_run_approve_then_library_hit_cycle(service):
    _login(service, "admin", ADMIN_PASSWORD)

    first = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    )
    assert first.status_code == 200, first.text
    payload = first.json()
    assert payload["library_hits"] == 0
    assert payload["newly_staged"] == 1

    matches = service.get("/matches").json()
    assert matches["total"] == 1
    item = matches["items"][0]
    assert item["savm_group_id"] == "SID-1"
    assert item["match_level"] == "SAVM"
    assert item["am"]["am_email"] == "ae.three@example.com"
    assert item["drifted"] is False

    approved = service.post(f"/matches/{item['id']}/approve", json={"notes": "ok"})
    assert approved.status_code == 200
    assert approved.json()["status"] == "active"

    second = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    )
    second_payload = second.json()
    assert second_payload["library_hits"] == 1
    assert second_payload["newly_staged"] == 0
    library_row = next(
        r for r in second_payload["results"] if r.get("Match_Stage") == "verified_library"
    )
    assert library_row["Confidence_Score"] == 1.0
    assert library_row["AM_Email"] == "ae.three@example.com"

    assert service.get("/matches").json()["total"] == 1


def test_swapped_upload_orientation_is_corrected(service):
    """The workspace sends the reference file as internal_file; staging must still work."""
    _login(service, "admin", ADMIN_PASSWORD)

    files = _match_files()
    swapped_files = {
        "internal_file": files["external_file"],
        "external_file": files["internal_file"],
    }
    swapped_config = {
        **_config(),
        "internal_col": "SAV_NAME",
        "external_col": "Internal Name",
    }

    response = service.post(
        "/match/run", files=swapped_files, data={"config": json.dumps(swapped_config)}
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["orientation_swapped"] is True
    assert payload["entity_column"] == "Internal Name"
    assert payload["newly_staged"] == 1

    item = service.get("/matches").json()["items"][0]
    assert item["entity_name_original"] == "CA-ALPHA UNIVERSITY"
    assert item["savm_group_id"] == "SID-1"


def test_sfdc_level_run_records_account(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post(
        "/match/run",
        files=_match_files(),
        data={"config": json.dumps(_config(external_col="SFDC_ACC_NAME"))},
    )
    assert response.status_code == 200
    item = service.get("/matches").json()["items"][0]
    assert item["match_level"] == "SFDC"
    assert item["sfdc_account_name"] == "ALPHA UNIVERSITY"
    assert item["account_state"] == "CA"


def test_rejected_match_is_suppressed_on_rerun(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.post("/match/run", files=_match_files(), data={"config": json.dumps(_config())})

    match_id = service.get("/matches").json()["items"][0]["id"]
    rejected = service.post(
        f"/matches/{match_id}/reject", json={"notes": "not the same organisation"}
    )
    assert rejected.status_code == 200

    rerun = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    ).json()
    assert rerun["suppressed"] == 1
    assert rerun["newly_staged"] == 0
    assert any(
        r.get("Match_Stage") == "suppressed_previously_rejected" for r in rerun["results"]
    )


def test_reject_without_notes_is_rejected(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.post("/match/run", files=_match_files(), data={"config": json.dumps(_config())})
    match_id = service.get("/matches").json()["items"][0]["id"]

    assert service.post(f"/matches/{match_id}/reject", json={"notes": "  "}).status_code == 400
    assert service.post(f"/matches/{match_id}/reject", json={}).status_code == 422


def test_stateless_match_endpoint_still_works_without_auth(service):
    response = service.post(
        "/match", files=_match_files(), data={"config": json.dumps(_config())}
    )
    assert response.status_code == 200
    body = response.json()
    assert "results" in body and "stats" in body
    assert service.get("/matches").status_code == 401


def test_match_run_requires_auth(service):
    response = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    )
    assert response.status_code == 401


def test_bad_matcher_config_rejected(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post("/match/run", files=_match_files(), data={"config": "{oops"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"

    missing_cols = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps({"internal_col": "x"})}
    )
    assert missing_cols.status_code == 400


# ---------------------------------------------------------------- workflow

def test_reviewer_cannot_approve_admin_queue_via_api(service):
    _login(service, "admin", ADMIN_PASSWORD)
    created = service.post(
        "/matches",
        json={
            "entity_name_original": "CA-HIGH SCORE",
            "entity_name_cleaned": "HIGH SCORE",
            "entity_state": "CA",
            "savm_group_id": "SID-1",
            "confidence_score": 0.99,
        },
    ).json()
    assert created["status"] == "pending_admin_approval"
    service.post("/auth/logout")

    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.post(f"/matches/{created['id']}/approve", json={})
    assert response.status_code == 403


def test_delete_and_restore_roundtrip(service):
    _login(service, "admin", ADMIN_PASSWORD)
    created = service.post(
        "/matches",
        json={
            "entity_name_original": "CA-DELETE ME",
            "entity_name_cleaned": "DELETE ME",
            "entity_state": "CA",
            "savm_group_id": "SID-1",
            "confidence_score": 0.5,
        },
    ).json()

    deleted = service.request(
        "DELETE", f"/matches/{created['id']}", json={"notes": "duplicate"}
    )
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    restored = service.post(f"/matches/{created['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "pending_review"


def test_history_endpoint_lists_events(service):
    _login(service, "admin", ADMIN_PASSWORD)
    created = service.post(
        "/matches",
        json={
            "entity_name_original": "CA-HISTORY CO",
            "entity_name_cleaned": "HISTORY CO",
            "entity_state": "CA",
            "savm_group_id": "SID-1",
            "confidence_score": 0.5,
        },
    ).json()
    service.patch(f"/matches/{created['id']}", json={"notes": "a note"})

    history = service.get(f"/matches/{created['id']}/history").json()
    assert [h["event"] for h in history] == ["edited", "created"]


def test_bulk_approve_requires_admin(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    assert service.post("/matches/bulk-approve", json={"ids": [1]}).status_code == 403


def test_export_returns_csv_with_joined_columns(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.post("/match/run", files=_match_files(), data={"config": json.dumps(_config())})

    response = service.get("/matches/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")

    reader = csv.DictReader(io.StringIO(response.text))
    rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["savm_group_id"] == "SID-1"
    assert rows[0]["am_email"] == "ae.three@example.com"
    assert rows[0]["tier"] == "ENT-FOCUS"


def test_unlinked_match_reported_after_group_disappears(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.post("/match/run", files=_match_files(), data={"config": json.dumps(_config())})

    replacement = [
        ["SID-9", "GAMMA INC", "GAMMA INC", "NY", "MFG", "COM-FOCUS", "Rex", "ae.six@example.com", "HIGH", "2"]
    ]
    summary = service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, replacement), "text/csv")},
    ).json()
    assert summary["newly_unlinked"] == 1

    unlinked = service.get("/matches", params={"link_status": "unlinked"}).json()
    assert unlinked["total"] == 1
    assert unlinked["items"][0]["status"] != "deleted"


def test_backup_endpoint_writes_file(service, tmp_path):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.post("/admin/backup")
    assert response.status_code == 200
    assert response.json()["backup_file"].startswith("offload-")


def test_backup_requires_admin(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    assert service.post("/admin/backup").status_code == 403
