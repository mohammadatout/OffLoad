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
    "NODE_SEGMENT",
    "NODE_SUBSEGMENT",
    "SOURCE",
    "SALES LEVEL 2",
    "SALES LEVEL 3",
    "SALES LEVEL 4",
    "SALES LEVEL 5",
    "SALES LEVEL 6",
    "NOMINATED_OWNER_NAME",
    "NOMINATED_OWNER_EMAIL",
    "CONFIDENCE_LEVEL",
    "NOMINATION_PRIORITY",
    # Last, so the shorter row literals below still line up and simply leave
    # this column empty.
    "UNIFIED_ACCOUNT_NAME",
]
ACCOUNT_ROWS = [
    [
        "SID-1",
        "ALPHA UNIVERSITY",
        "ALPHA UNIVERSITY",
        "CA",
        "EDU",
        "PUBLIC SECTOR",
        "ENT-FOCUS",
        "SAV+SFDC",
        "US PS Market Segment",
        "PS-WEST",
        "PS-REGION-A",
        "PS-DIST-1",
        "PHOENIX WEST",
        "AE Three",
        "ae.three@example.com",
        "HIGH",
        "2",
        "ALPHA UNIVERSITY UNIFIED",
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


def _match_files_without_reference_state():
    internal_csv = _csv_bytes(["Internal Name"], [["CA-ALPHA UNIVERSITY"]])
    external_csv = _csv_bytes(
        ["SAVM_ID", "SAV_NAME", "SFDC_ACC_NAME"],
        [["SID-1", "ALPHA UNIVERSITY", "ALPHA UNIVERSITY"]],
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
        "skipped_stages": [],
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
        [
            "SID-2",
            "BETA COLLEGE",
            "BETA COLLEGE",
            "TX",
            "MFG",
            "COMMERCIAL",
            "COM-FOCUS",
            "SAV+SFDC",
            "US COMMERCIAL",
            "COMM-SOUTH",
            "COMM-REGION-A",
            "COMM-DIST-1",
            "DALLAS CORE",
            "G H",
            "ae.five@example.com",
            "MEDIUM",
            "4",
        ],
        [
            "SID-2",
            "BETA COLLEGE",
            "BETA WEST",
            "TX",
            "MFG",
            "COMMERCIAL",
            "COM-FOCUS",
            "SAV+SFDC",
            "US COMMERCIAL",
            "COMM-SOUTH",
            "COMM-REGION-A",
            "COMM-DIST-1",
            "DALLAS CORE",
            "G H",
            "ae.five@example.com",
            "HIGH",
            "2",
        ],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    facets = service.get("/accounts/facets").json()
    assert facets["state"] == ["CA", "TX"]
    assert facets["vertical"] == ["EDU", "MFG"]
    assert sorted(facets["tier"]) == ["COM-FOCUS", "ENT-FOCUS"]
    assert "sl1" not in facets
    assert facets["total_accounts"] == 3
    assert facets["total_groups"] == 2


def test_accounts_filter_by_segment_and_tier(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts", params={"tier": "ENT-FOCUS"}).json()["total"] == 1
    assert service.get("/accounts", params={"tier": "NOPE"}).json()["total"] == 0


def test_accounts_default_scope_and_hierarchy_filters(service):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        [
            "SID-2",
            "BETA COLLEGE",
            "BETA COLLEGE",
            "TX",
            "MFG",
            "COMMERCIAL",
            "COM-FOCUS",
            "SAV+SFDC",
            "US COMMERCIAL",
            "COMM-SOUTH",
            "COMM-REGION-A",
            "COMM-DIST-1",
            "DALLAS CORE",
            "G H",
            "ae.five@example.com",
            "MEDIUM",
            "4",
        ],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    default_scope = service.get(
        "/accounts", params={"source": "SAV+SFDC", "sl2": "US PS Market Segment"}
    ).json()
    assert default_scope["total"] == 1
    widened_scope = service.get(
        "/accounts", params={"source": "SAV+SFDC", "sl2": "US COMMERCIAL"}
    ).json()
    assert widened_scope["total"] == 1

    hierarchy_filtered = service.get(
        "/accounts",
        params={
            "source": "SAV+SFDC",
            "sl2": "US PS Market Segment",
            "sl3": "PS-WEST",
            "sl4": "PS-REGION-A",
            "sl5": "PS-DIST-1",
            "sl6": "PHOENIX WEST",
        },
    ).json()
    assert hierarchy_filtered["total"] == 1


def test_account_facets_cascade_and_sl6_search(service):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        [
            "SID-1",
            "ALPHA UNIVERSITY",
            "ALPHA EAST",
            "CA",
            "EDU",
            "PUBLIC SECTOR",
            "ENT-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-WEST",
            "PS-REGION-A",
            "PS-DIST-1",
            "PHOENIX EAST",
            "AE Three",
            "ae.three@example.com",
            "HIGH",
            "2",
        ],
        [
            "SID-3",
            "GAMMA SCHOOL",
            "GAMMA SCHOOL",
            "CA",
            "EDU",
            "PUBLIC SECTOR",
            "ENT-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-EAST",
            "PS-REGION-B",
            "PS-DIST-2",
            "BOSTON CORE",
            "AE Seven",
            "ae.seven@example.com",
            "HIGH",
            "2",
        ],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    narrowed = service.get(
        "/accounts/facets",
        params={
            "source": "SAV+SFDC",
            "sl2": "US PS Market Segment",
            "sl3": "PS-WEST",
            "sl4": "PS-REGION-A",
            "sl5": "PS-DIST-1",
        },
    ).json()
    assert sorted(narrowed["sl6"]) == ["PHOENIX EAST", "PHOENIX WEST"]

    searched = service.get(
        "/accounts/facets",
        params={"source": "SAV+SFDC", "sl2": "US PS Market Segment", "sl6_search": "pho"},
    ).json()
    assert sorted(searched["sl6"]) == ["PHOENIX EAST", "PHOENIX WEST"]
    assert searched["sl6_server_side"] is True
    assert searched["sl6_min_search_chars"] == 3


def test_accounts_state_filter_supports_non_two_char_values(service):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        [
            "SID-4",
            "INTERNATIONAL NODE",
            "INTERNATIONAL NODE",
            "CDMX",
            "GOVT",
            "PUBLIC SECTOR",
            "ENT-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-LATAM",
            "PS-REGION-C",
            "PS-DIST-9",
            "MEXICO CITY CORE",
            "AE Eight",
            "ae.eight@example.com",
            "MEDIUM",
            "4",
        ],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    filtered = service.get("/accounts", params={"state": "CDMX"}).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["state"] == "CDMX"


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
            "PUBLIC SECTOR",
            "ENT-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-WEST",
            "PS-REGION-A",
            "PS-DIST-1",
            f"PS-NODE-{index}",
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
        [
            f"SID-{i}",
            f"GROUP {i}",
            f"ACCOUNT {i}",
            "CA",
            "EDU",
            "PUBLIC SECTOR",
            "ENT-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-WEST",
            "PS-REGION-A",
            "PS-DIST-1",
            f"PS-NODE-{i}",
            "X",
            "x@example.com",
            "HIGH",
            "2",
        ]
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
        [
            "SID-2",
            "BETA COLLEGE",
            "BETA COLLEGE",
            "TX",
            "EDU",
            "PUBLIC SECTOR",
            "COM-FOCUS",
            "SAV+SFDC",
            "US PS Market Segment",
            "PS-EAST",
            "PS-REGION-B",
            "PS-DIST-3",
            "AUSTIN CORE",
            "Grace H",
            "ae.four@example.com",
            "MEDIUM",
            "4",
        ]
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


def test_match_stages_endpoint_and_stage_ids(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.get("/match/stages")
    assert response.status_code == 200
    stages = response.json()["stages"]
    stage_ids = [stage["id"] for stage in stages]
    assert all(stage["implemented"] is True for stage in stages)
    assert stage_ids[0] == "verified_library"
    assert "exact_fuzzy_94" in stage_ids
    assert "savm_lookup" in stage_ids
    assert "sfdc_lookup" in stage_ids
    assert "website_address" not in stage_ids


def test_non_implemented_stage_skip_is_rejected(service):
    _login(service, "admin", ADMIN_PASSWORD)
    cfg = _config()
    cfg["skipped_stages"] = ["website_address"]
    response = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(cfg)}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_skipping_library_stage_is_reported_in_run_summary(service):
    _login(service, "admin", ADMIN_PASSWORD)

    initial = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    )
    assert initial.status_code == 200
    match_id = service.get("/matches").json()["items"][0]["id"]
    assert service.post(f"/matches/{match_id}/approve", json={"notes": "seed"}).status_code == 200

    cfg = _config()
    cfg["skipped_stages"] = ["verified_library"]
    rerun = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(cfg)}
    )
    assert rerun.status_code == 200
    payload = rerun.json()
    assert payload["library_hits"] == 0
    assert payload["run_summary"]["stage_1_skipped_warning"] is True
    assert payload["run_summary"]["skipped_stage_ids"] == ["verified_library"]


def test_skip_all_non_library_stages_returns_only_library_hits(service):
    _login(service, "admin", ADMIN_PASSWORD)
    first = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(_config())}
    )
    assert first.status_code == 200
    staged_match_id = service.get("/matches").json()["items"][0]["id"]
    assert service.post(f"/matches/{staged_match_id}/approve", json={"notes": "seed"}).status_code == 200

    cfg = _config()
    stages = service.get("/match/stages").json()["stages"]
    cfg["skipped_stages"] = [
        stage["id"] for stage in stages if stage["id"] != "verified_library"
    ]
    second = service.post(
        "/match/run", files=_match_files(), data={"config": json.dumps(cfg)}
    )
    assert second.status_code == 200, second.text
    payload = second.json()
    assert payload["library_hits"] == 1
    matched_rows = [row for row in payload["results"] if row.get("Match_Status") == "Matched"]
    assert len(matched_rows) == 1
    assert matched_rows[0]["Match_Stage"] == "verified_library"


def test_state_blocking_without_reference_state_sets_flag(service):
    _login(service, "admin", ADMIN_PASSWORD)
    cfg = _config()
    cfg["use_state_blocking"] = True

    response = service.post(
        "/match/run",
        files=_match_files_without_reference_state(),
        data={"config": json.dumps(cfg)},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["stats"]["total_internal"] == 1
    assert len(payload["results"]) == 1
    assert payload["results"][0]["State_Mismatch_Flag"] == "reference_state_missing"
    assert any("reference file has no state column" in warning for warning in payload["run_summary"]["warnings"])


def test_progress_endpoint_reports_completed_stage(service):
    _login(service, "admin", ADMIN_PASSWORD)
    run_id = "progress-check-run"
    response = service.post(
        "/match/run",
        files=_match_files(),
        data={"config": json.dumps(_config()), "run_id": run_id},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == run_id
    assert all(row.get("Match_Stage") for row in payload["results"])
    valid_stage_ids = {stage["id"] for stage in payload["stage_ladder"]}
    assert all(row["Match_Stage"] in valid_stage_ids for row in payload["results"])

    progress = service.get(f"/match/progress/{run_id}")
    assert progress.status_code == 200
    body = progress.json()
    assert body["completed"] is True
    assert body["status"] == "complete"
    assert "verified_library" in body["completed_stage_ids"] or "verified_library" in body["skipped_stage_ids"]


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
    suppressed_rows = [r for r in rerun["results"] if r.get("Match_Status") == "Suppressed"]
    assert len(suppressed_rows) == 1
    valid_stage_ids = {stage["id"] for stage in rerun["stage_ladder"]}
    assert suppressed_rows[0]["Match_Stage"] in valid_stage_ids


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
        [
            "SID-9",
            "GAMMA INC",
            "GAMMA INC",
            "NY",
            "MFG",
            "COMMERCIAL",
            "COM-FOCUS",
            "SAV+SFDC",
            "US COMMERCIAL",
            "COMM-EAST",
            "COMM-REGION-B",
            "COMM-DIST-4",
            "NEW YORK CORE",
            "Rex",
            "ae.six@example.com",
            "HIGH",
            "2",
        ]
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


# --------------------------------------------------------------------------
# AE Allocation: new filters, searchable options, export, purge
# --------------------------------------------------------------------------

def test_accounts_filter_by_sav_id_and_unified_name(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts", params={"savm_group_id": "SID-1"}).json()["total"] == 1
    assert service.get("/accounts", params={"savm_group_id": "SID-9"}).json()["total"] == 0
    assert (
        service.get(
            "/accounts", params={"unified_account_name": "ALPHA UNIVERSITY UNIFIED"}
        ).json()["total"]
        == 1
    )


def test_account_options_endpoint_searches_server_side(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.get(
        "/accounts/options", params={"column": "unified_account_name", "query": "UNIFIED"}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["options"] == ["ALPHA UNIVERSITY UNIFIED"]
    assert payload["column"] == "unified_account_name"


def test_account_options_rejects_a_column_off_the_allow_list(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.get("/accounts/options", params={"column": "am_email"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_account_options_requires_authentication(service):
    assert service.get("/accounts/options", params={"column": "savm_group_id"}).status_code == 401


def test_accounts_export_streams_every_filtered_row(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.get("/accounts/export")
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["savm_group_id"] == "SID-1"
    # The export carries the full row, not the visible column subset.
    assert payload["items"][0]["am_email"] == "ae.three@example.com"
    assert "sl6" in payload["items"][0]


def test_accounts_export_respects_filters(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts/export", params={"state": "CA"}).json()["total"] == 1
    assert service.get("/accounts/export", params={"state": "ZZ"}).json()["total"] == 0


def test_accounts_export_requires_authentication(service):
    assert service.get("/accounts/export").status_code == 401


def test_json_export_cap_is_configurable(service, monkeypatch):
    monkeypatch.setenv("OFFLOAD_MAX_JSON_EXPORT_ROWS", "500")
    import matcher_service

    assert matcher_service._max_json_export_rows() == 500
    for bad in ("0", "-5", "not-a-number"):
        monkeypatch.setenv("OFFLOAD_MAX_JSON_EXPORT_ROWS", bad)
        assert matcher_service._max_json_export_rows() == 10_000


def test_json_export_rejects_an_oversized_set(service, monkeypatch):
    _login(service, "admin", ADMIN_PASSWORD)
    rows = ACCOUNT_ROWS + [
        ["SID-2", "BETA", "BETA", "TX", "MFG", "COMMERCIAL", "COM-FOCUS", "SAV+SFDC",
         "US COMMERCIAL", "COMM-SOUTH", "COMM-REGION-A", "COMM-DIST-1", "DALLAS CORE",
         "AE Five", "ae.five@example.com", "HIGH", "2", "BETA UNIFIED"],
    ]
    service.post(
        "/accounts/import",
        files={"file": ("accounts.csv", _csv_bytes(ACCOUNT_HEADERS, rows), "text/csv")},
    )

    import matcher_service

    monkeypatch.setattr(matcher_service, "_max_json_export_rows", lambda: 1)
    response = service.get("/accounts/export")
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert "export.xlsx" in response.json()["error"]["message"]


def test_workbook_export_returns_a_real_xlsx(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.get("/accounts/export.xlsx")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "ALLOCATION_ae_accounts_" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].startswith("attachment;")
    # A real xlsx is a zip archive.
    assert response.content[:2] == b"PK"


def test_workbook_export_is_not_capped(service, monkeypatch):
    import matcher_service

    monkeypatch.setattr(matcher_service, "_max_json_export_rows", lambda: 0)
    _login(service, "admin", ADMIN_PASSWORD)
    # The JSON route refuses; the workbook route still serves.
    assert service.get("/accounts/export").status_code == 413
    assert service.get("/accounts/export.xlsx").status_code == 200


def test_workbook_export_honours_filters_and_columns(service):
    _login(service, "admin", ADMIN_PASSWORD)
    ok = service.get(
        "/accounts/export.xlsx",
        params={"state": "CA", "columns": "savm_group_id,state"},
    )
    assert ok.status_code == 200
    assert ok.content[:2] == b"PK"


def test_workbook_export_requires_authentication(service):
    assert service.get("/accounts/export.xlsx").status_code == 401


def test_purge_requires_admin(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.request("DELETE", "/accounts", json={"confirm": "DELETE"})
    assert response.status_code == 403
    # Nothing was removed.
    _login(service, "admin", ADMIN_PASSWORD)
    assert service.get("/accounts").json()["total"] == 1


def test_purge_requires_the_typed_confirmation(service):
    _login(service, "admin", ADMIN_PASSWORD)
    for bad in ({}, {"confirm": ""}, {"confirm": "delete"}, {"confirm": "yes"}):
        response = service.request("DELETE", "/accounts", json=bad)
        assert response.status_code == 400, bad
    assert service.get("/accounts").json()["total"] == 1


def test_purge_empties_the_reference(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.request("DELETE", "/accounts", json={"confirm": "DELETE"})
    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    assert service.get("/accounts").json()["total"] == 0


def test_purge_flags_matches_rather_than_deleting_them(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.post("/match/run", files=_match_files(), data={"config": json.dumps(_config())})

    result = service.request("DELETE", "/accounts", json={"confirm": "DELETE"}).json()
    assert result["newly_unlinked"] == 1

    unlinked = service.get("/matches", params={"link_status": "unlinked"}).json()
    assert unlinked["total"] == 1
    assert unlinked["items"][0]["status"] != "deleted"


# --------------------------------------------------------------------------
# AE Allocation: global column selection
# --------------------------------------------------------------------------

def test_allocation_columns_readable_by_any_reviewer(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.get("/settings/allocation-columns")
    assert response.status_code == 200

    payload = response.json()
    assert payload["is_default"] is True
    assert "unified_account_name" in payload["selected"]
    assert any(
        column["key"] == "unified_account_name" and column["label"] == "Unified Acc. Name"
        for column in payload["available"]
    )


def test_allocation_column_labels_match_the_business_names(service):
    _login(service, "admin", ADMIN_PASSWORD)
    labels = {
        column["key"]: column["label"]
        for column in service.get("/settings/allocation-columns").json()["available"]
    }
    assert labels["savm_group_id"] == "SAV ID"
    assert labels["state"] == "State"
    assert labels["tier"] == "Tier"
    assert labels["vertical"] == "SAV Vertical"
    assert labels["sl2"] == "Theater - SL2"
    assert labels["sl3"] == "Area - SL3"
    assert labels["sl4"] == "Operation - SL4"
    assert labels["sl5"] == "Region - SL5"
    assert labels["sl6"] == "Account - SL6"


def test_allocation_columns_are_global_across_users(service):
    _login(service, "admin", ADMIN_PASSWORD)
    saved = service.put(
        "/settings/allocation-columns",
        json={"columns": ["savm_group_id", "unified_account_name", "state"]},
    )
    assert saved.status_code == 200

    _login(service, "reviewer", REVIEWER_PASSWORD)
    seen = service.get("/settings/allocation-columns").json()
    assert seen["selected"] == ["savm_group_id", "unified_account_name", "state"]
    assert seen["is_default"] is False


def test_allocation_columns_write_requires_admin(service):
    _login(service, "reviewer", REVIEWER_PASSWORD)
    response = service.put(
        "/settings/allocation-columns", json={"columns": ["savm_group_id"]}
    )
    assert response.status_code == 403
    assert service.post("/settings/allocation-columns/reset").status_code == 403


def test_allocation_columns_reject_unknown_keys(service):
    _login(service, "admin", ADMIN_PASSWORD)
    response = service.put(
        "/settings/allocation-columns", json={"columns": ["savm_group_id", "nope"]}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_allocation_columns_reject_an_empty_selection(service):
    _login(service, "admin", ADMIN_PASSWORD)
    assert (
        service.put("/settings/allocation-columns", json={"columns": []}).status_code
        == 400
    )


def test_allocation_columns_reset_restores_defaults(service):
    _login(service, "admin", ADMIN_PASSWORD)
    service.put("/settings/allocation-columns", json={"columns": ["state"]})
    restored = service.post("/settings/allocation-columns/reset")
    assert restored.status_code == 200
    assert restored.json()["is_default"] is True
