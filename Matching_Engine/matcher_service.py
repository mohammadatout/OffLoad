"""FastAPI service for OffLoad matching plus the persistent match library."""

from __future__ import annotations

import csv
import io
import json
import math
import os
import shutil
import sqlite3
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import uvicorn
from fastapi import (
    Body,
    Cookie,
    Depends,
    FastAPI,
    File,
    Form,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from auth import (
    AuthError,
    DuplicateUser,
    InvalidRole,
    UserNotFound,
    WeakPassword,
    authenticate,
    create_session,
    create_user,
    delete_session,
    list_users,
    resolve_session,
    session_hours,
    update_user,
)
from account_export import parse_columns_param, stream_accounts_workbook
from cisco_store import (
    COLUMN_ALIASES,
    AmbiguousAccountReference,
    CiscoStoreError,
    UnknownAccountReference,
    ValidationFailedError as AccountValidationFailedError,
    count_accounts,
    get_account,
    get_account_facets,
    get_group_accounts,
    get_group_summary,
    import_accounts_stream,
    iter_accounts,
    list_accounts,
    purge_accounts,
    resolve_account_am,
    resolve_account_reference,
    resolve_group_am,
    search_account_options,
)
from db import get_connection, init_db, resolve_db_path
from settings_store import (
    SettingsError,
    get_allocation_columns,
    reset_allocation_columns,
    set_allocation_columns,
)
from match_store import (
    DuplicateActiveMatch,
    InvalidTransition,
    MatchNotFoundError,
    PermissionDeniedError,
    MatchStoreError,
    ValidationFailedError as MatchValidationFailedError,
    approve_match,
    bulk_approve,
    create_match,
    get_active_library,
    get_match_history,
    get_rejected_keys,
    import_match_deletions_csv,
    import_matches_csv,
    list_matches,
    reject_match,
    restore_match,
    soft_delete_match,
    update_notes,
)

# Patch streamlit before importing entity_matcher_v4 so module-level
# st.set_page_config / st.markdown / st.session_state calls become no-ops.
st_mock = MagicMock()
sys.modules["streamlit"] = st_mock

from entity_matcher_v4 import MultiStageEntityMatcher  # noqa: E402

COOKIE_NAME = "offload_session"
# The Cisco reference export runs to a few hundred megabytes, and it is streamed
# rather than buffered, so the cap is generous by default.
UPLOAD_MAX_BYTES_DEFAULT = 536_870_912  # 512 MB

app = FastAPI(title="OffLoad Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MATCH_STAGE_LADDER = (
    {
        "id": "verified_library",
        "order": 1,
        "name": "Stage 1 - Library lookup",
        "comparison_target": "Approved match library",
        "implemented": True,
    },
    {
        "id": "exact_fuzzy_94",
        "order": 2,
        "name": "Stage 2 - Exact and fuzzy >= 94%",
        "comparison_target": "Reference names with strict threshold",
        "implemented": True,
    },
    {
        "id": "savm_lookup",
        "order": 3,
        "name": "Stage 3 - SAVM lookup",
        "comparison_target": "SAVM-level reference records",
        "implemented": True,
    },
    {
        "id": "sfdc_lookup",
        "order": 4,
        "name": "Stage 4 - SFDC lookup",
        "comparison_target": "SFDC account-level reference records",
        "implemented": True,
    },
    {
        "id": "synonym_pass",
        "order": 5,
        "name": "Stage 5 - Synonym pass",
        "comparison_target": "Synonym-expanded candidates",
        "implemented": False,
    },
    {
        "id": "opportunity_name",
        "order": 6,
        "name": "Stage 6 - Opportunity name",
        "comparison_target": "Opportunity-name candidates",
        "implemented": False,
    },
    {
        "id": "website_address",
        "order": 7,
        "name": "Stage 7 - Website and address",
        "comparison_target": "Website and address signals",
        "implemented": False,
    },
)
MATCH_STAGE_BY_ID = {stage["id"]: stage for stage in MATCH_STAGE_LADDER}
IMPLEMENTED_MATCH_STAGE_LADDER = tuple(
    stage for stage in MATCH_STAGE_LADDER if bool(stage.get("implemented"))
)
IMPLEMENTED_STAGE_BY_ID = {
    stage["id"]: stage for stage in IMPLEMENTED_MATCH_STAGE_LADDER
}
MATCH_STAGE_IDS = tuple(stage["id"] for stage in IMPLEMENTED_MATCH_STAGE_LADDER)
STAGE_LIBRARY_ID = "verified_library"
EXACT_FUZZY_THRESHOLD = 0.94

_RUN_PROGRESS: dict[str, dict[str, Any]] = {}
_RUN_PROGRESS_LOCK = Lock()
_RUN_PROGRESS_MAX = 250


class APIError(Exception):
    """Structured API error used by the handlers."""

    def __init__(self, code: str, message: str, status_code: int):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str


class UpdateUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


class MatchCreateRequest(BaseModel):
    entity_name_original: str
    entity_name_cleaned: str
    entity_state: str | None = None
    savm_group_id: str
    sfdc_account_name: str | None = None
    account_state: str | None = None
    match_level: str | None = None
    confidence_score: float | None = None
    match_stage: str | None = None
    notes: str | None = None
    source: str = "manual"
    source_detail: str | None = None


class NotesPatchRequest(BaseModel):
    notes: str | None = None


class RejectRequest(BaseModel):
    notes: str


class BulkApproveRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)
    notes: str | None = None


class DeleteRequest(BaseModel):
    notes: str | None = None


class AllocationColumnsRequest(BaseModel):
    columns: list[str] = Field(default_factory=list)


class PurgeAccountsRequest(BaseModel):
    """Typed confirmation for an irreversible delete of the whole reference."""

    confirm: str = ""


# --------------------------------------------------------------------------
# config helpers
# --------------------------------------------------------------------------

def _session_max_age_seconds() -> int:
    return session_hours() * 3600


def _cookie_secure() -> bool:
    return os.getenv("OFFLOAD_COOKIE_SECURE", "0") == "1"


def _max_json_export_rows() -> int:
    raw = os.environ.get("OFFLOAD_MAX_JSON_EXPORT_ROWS")
    if not raw:
        return 10_000
    try:
        value = int(raw)
    except ValueError:
        return 10_000
    return value if value > 0 else 10_000


def _account_filter_params(**values: str | None) -> dict[str, str | None]:
    """Collect the account filter query parameters into one mapping."""
    return dict(values)


def _max_upload_bytes() -> int:
    raw = os.getenv("OFFLOAD_MAX_UPLOAD_BYTES", str(UPLOAD_MAX_BYTES_DEFAULT))
    try:
        value = int(raw)
    except ValueError:
        return UPLOAD_MAX_BYTES_DEFAULT
    return value if value > 0 else UPLOAD_MAX_BYTES_DEFAULT


def _normalize_header(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _run_stage(stage_id: str) -> dict[str, Any]:
    return IMPLEMENTED_STAGE_BY_ID[stage_id]


def _stage_names(stage_ids: list[str]) -> list[str]:
    return [_run_stage(stage_id)["name"] for stage_id in stage_ids]


def _validate_stage_ladder() -> None:
    stage_ids = [stage["id"] for stage in MATCH_STAGE_LADDER]
    if len(stage_ids) != len(set(stage_ids)):
        raise RuntimeError("MATCH_STAGE_LADDER has duplicate stage ids.")

    stage_orders = [stage["order"] for stage in MATCH_STAGE_LADDER]
    if len(stage_orders) != len(set(stage_orders)):
        raise RuntimeError("MATCH_STAGE_LADDER has duplicate stage order values.")

    if STAGE_LIBRARY_ID not in IMPLEMENTED_STAGE_BY_ID:
        raise RuntimeError("Stage 1 library lookup must be implemented.")

    if not IMPLEMENTED_MATCH_STAGE_LADDER:
        raise RuntimeError("MATCH_STAGE_LADDER has no implemented stages.")


def _next_run_id(value: str | None) -> str:
    cleaned = _clean_text(value)
    return cleaned if cleaned else uuid.uuid4().hex


def _trim_progress_cache() -> None:
    while len(_RUN_PROGRESS) > _RUN_PROGRESS_MAX:
        oldest_key = next(iter(_RUN_PROGRESS))
        _RUN_PROGRESS.pop(oldest_key, None)


def _set_progress(run_id: str, **updates: Any) -> dict[str, Any]:
    with _RUN_PROGRESS_LOCK:
        current = dict(_RUN_PROGRESS.get(run_id, {"run_id": run_id}))
        current.update(updates)
        current["updated_at"] = datetime.now(timezone.utc).isoformat()
        _RUN_PROGRESS[run_id] = current
        _trim_progress_cache()
        return dict(current)


def _start_progress(run_id: str, skipped_stage_ids: list[str]) -> None:
    _set_progress(
        run_id,
        completed=False,
        status="running",
        total_stages=len(IMPLEMENTED_MATCH_STAGE_LADDER),
        current_stage_id=None,
        current_stage_name=None,
        comparison_target=None,
        message="Initializing matcher run",
        completed_stage_ids=[],
        skipped_stage_ids=skipped_stage_ids,
        warnings=[],
        error=None,
    )


def _mark_stage_progress(
    run_id: str,
    stage_id: str,
    *,
    message: str,
    completed_stage_ids: list[str],
    skipped_stage_ids: list[str],
    warnings: list[str],
    status: str = "running",
) -> None:
    stage = _run_stage(stage_id)
    _set_progress(
        run_id,
        status=status,
        current_stage_id=stage_id,
        current_stage_name=stage["name"],
        comparison_target=stage["comparison_target"],
        message=message,
        completed_stage_ids=completed_stage_ids,
        skipped_stage_ids=skipped_stage_ids,
        warnings=warnings,
    )


def _finish_progress(
    run_id: str,
    *,
    completed_stage_ids: list[str],
    skipped_stage_ids: list[str],
    warnings: list[str],
    summary: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    _set_progress(
        run_id,
        completed=True,
        status="error" if error else "complete",
        message="Run failed." if error else "Run completed.",
        current_stage_id=None,
        current_stage_name=None,
        comparison_target=None,
        completed_stage_ids=completed_stage_ids,
        skipped_stage_ids=skipped_stage_ids,
        warnings=warnings,
        summary=summary,
        error=error,
    )


def _frame_has_canonical_column(frame: pd.DataFrame, canonical_key: str) -> bool:
    return any(
        COLUMN_ALIASES.get(_normalize_header(str(column))) == canonical_key
        for column in frame.columns
    )


def _as_score(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(numeric):
        return 0.0
    return numeric


def _stage_for_match_record(record: dict[str, Any], match_level: str) -> str:
    if _as_score(record.get("Confidence_Score")) >= EXACT_FUZZY_THRESHOLD:
        return "exact_fuzzy_94"
    if match_level == "SFDC":
        return "sfdc_lookup"
    return "savm_lookup"


def _state_flag(
    *,
    requested_state_blocking: bool,
    reference_has_state: bool,
    entity_state: str | None,
    reference_state: str | None,
) -> str:
    if not requested_state_blocking:
        return ""
    if not reference_has_state:
        return "reference_state_missing"
    entity = _clean_text(entity_state)
    reference = _clean_text(reference_state)
    if not entity or not reference:
        return ""
    return "state_mismatch" if entity != reference else ""


PUBLIC_USER_FIELDS = ("id", "username", "role", "is_active", "created_at", "created_by")


def _user_public(row: Any) -> dict[str, Any]:
    """Project a user row to its public shape. Never exposes password_hash."""
    data = dict(row)
    return {field: data.get(field) for field in PUBLIC_USER_FIELDS}


# --------------------------------------------------------------------------
# errors
# --------------------------------------------------------------------------

def _to_api_error(exc: Exception) -> APIError:
    if isinstance(exc, APIError):
        return exc
    if isinstance(exc, PermissionDeniedError):
        return APIError("forbidden", str(exc), 403)
    if isinstance(exc, DuplicateActiveMatch):
        return APIError("duplicate_active_match", str(exc), 409)
    if isinstance(exc, InvalidTransition):
        return APIError("invalid_transition", str(exc), 409)
    if isinstance(exc, MatchNotFoundError):
        return APIError("not_found", str(exc), 404)
    if isinstance(exc, DuplicateUser):
        return APIError("validation_failed", str(exc), 409)
    if isinstance(exc, UserNotFound):
        return APIError("not_found", str(exc), 404)
    if isinstance(
        exc,
        (
            AccountValidationFailedError,
            MatchValidationFailedError,
            WeakPassword,
            InvalidRole,
            AuthError,
            SettingsError,
        ),
    ):
        return APIError("validation_failed", str(exc), 400)
    if isinstance(exc, (UnknownAccountReference, AmbiguousAccountReference)):
        return APIError("validation_failed", str(exc), 400)
    return APIError("internal_error", "Internal server error.", 500)


def _error_response(exc: Exception) -> JSONResponse:
    api_error = _to_api_error(exc)
    return JSONResponse(
        status_code=api_error.status_code,
        content={"error": {"code": api_error.code, "message": api_error.message}},
    )


@app.exception_handler(APIError)
async def api_error_handler(_: Request, exc: APIError):
    return _error_response(exc)


# Domain exceptions get explicit handlers rather than relying on the catch-all,
# which would otherwise mask them behind a generic 500.
@app.exception_handler(AuthError)
async def auth_error_handler(_: Request, exc: AuthError):
    return _error_response(exc)


@app.exception_handler(MatchStoreError)
async def match_store_error_handler(_: Request, exc: MatchStoreError):
    return _error_response(exc)


@app.exception_handler(CiscoStoreError)
async def cisco_store_error_handler(_: Request, exc: CiscoStoreError):
    return _error_response(exc)


@app.exception_handler(SettingsError)
async def settings_error_handler(_: Request, exc: SettingsError):
    return _error_response(exc)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    return _error_response(exc)


# --------------------------------------------------------------------------
# dependencies
# --------------------------------------------------------------------------

@contextmanager
def _db_connection():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def get_db():
    with _db_connection() as conn:
        yield conn


@app.on_event("startup")
def startup() -> None:
    _validate_stage_ladder()
    with _db_connection() as conn:
        init_db(conn)


def require_user(
    offload_session: str | None = Cookie(default=None),
    conn=Depends(get_db),
) -> dict[str, Any]:
    if not offload_session:
        raise APIError("unauthorized", "Authentication required.", 401)
    row = resolve_session(conn, offload_session)
    if row is None:
        raise APIError("unauthorized", "Authentication required.", 401)
    user = _user_public(row)
    user["raw_session_token"] = offload_session
    return user


def require_admin(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    if user["role"] != "admin":
        raise APIError("forbidden", "Admin role required.", 403)
    return user


def _require_csv_name(file: UploadFile) -> None:
    if not (file.filename or "").lower().endswith(".csv"):
        raise APIError("unsupported_file_type", "Only CSV uploads are supported.", 415)


def _upload_size(file: UploadFile) -> int:
    handle = file.file
    handle.seek(0, os.SEEK_END)
    size = handle.tell()
    handle.seek(0)
    return size


def _enforce_upload_limit(file: UploadFile) -> int:
    limit = _max_upload_bytes()
    size = _upload_size(file)
    if size > limit:
        raise APIError(
            "file_too_large",
            f"Uploaded file is {size / 1_048_576:.0f} MB, over the "
            f"{limit / 1_048_576:.0f} MB limit. Raise OFFLOAD_MAX_UPLOAD_BYTES to allow it.",
            413,
        )
    return size


async def _read_upload(file: UploadFile, require_csv: bool = True) -> bytes:
    """Read a whole upload into memory. Only for files small enough to hold."""
    if require_csv:
        _require_csv_name(file)
    _enforce_upload_limit(file)
    return await file.read()


def _upload_text_stream(file: UploadFile) -> io.TextIOWrapper:
    """Wrap an upload as text without loading it.

    Starlette already spools request bodies to a temporary file, so this reads
    straight off that handle. Keeps peak memory flat for very large exports.
    """
    _require_csv_name(file)
    _enforce_upload_limit(file)
    return io.TextIOWrapper(file.file, encoding="utf-8-sig", newline="")


def _parse_csv_bytes(data: bytes, label: str) -> pd.DataFrame:
    try:
        return pd.read_csv(io.BytesIO(data))
    except Exception as exc:
        raise APIError("validation_failed", f"Invalid CSV in {label}.", 400) from exc


def _parse_match_config(config: str) -> dict[str, Any]:
    try:
        cfg = json.loads(config)
    except json.JSONDecodeError as exc:
        raise APIError("validation_failed", "Invalid matcher config JSON.", 400) from exc

    if not isinstance(cfg, dict):
        raise APIError("validation_failed", "Matcher config must be an object.", 400)
    if "internal_col" not in cfg or "external_col" not in cfg:
        raise APIError(
            "validation_failed",
            "Matcher config requires internal_col and external_col.",
            400,
        )

    raw_skipped = cfg.get("skipped_stages") or []
    if not isinstance(raw_skipped, list) or not all(
        isinstance(stage_id, str) for stage_id in raw_skipped
    ):
        raise APIError(
            "validation_failed",
            "skipped_stages must be an array of stage ids.",
            400,
        )
    unknown_stage_ids = sorted(
        {stage_id for stage_id in raw_skipped if stage_id not in MATCH_STAGE_BY_ID}
    )
    if unknown_stage_ids:
        raise APIError(
            "validation_failed",
            "Unknown skipped stage ids: " + ", ".join(unknown_stage_ids),
            400,
        )
    unimplemented_stage_ids = sorted(
        {
            stage_id
            for stage_id in raw_skipped
            if stage_id in MATCH_STAGE_BY_ID and stage_id not in IMPLEMENTED_STAGE_BY_ID
        }
    )
    if unimplemented_stage_ids:
        raise APIError(
            "validation_failed",
            "Cannot skip non-implemented stage ids: " + ", ".join(unimplemented_stage_ids),
            400,
        )
    cfg["skipped_stages"] = list(dict.fromkeys(raw_skipped))
    return cfg


def _sanitize_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for record in records:
        for key, value in list(record.items()):
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                record[key] = None
            elif not isinstance(value, (list, dict)) and pd.isna(value):
                record[key] = ""
    return records


def _batch_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    batch = dict(row)
    if batch.get("error_report"):
        batch["error_report"] = json.loads(batch["error_report"])
    else:
        batch["error_report"] = {"warnings": [], "rows": []}
    return batch


# --------------------------------------------------------------------------
# health + auth
# --------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login")
def login(payload: LoginRequest, response: Response, conn=Depends(get_db)):
    user = authenticate(conn, payload.username, payload.password)
    if user is None:
        # One message for every failure mode, so this cannot be used to
        # discover which usernames exist.
        raise APIError("unauthorized", "Invalid username or password.", 401)

    raw_token = create_session(conn, int(user["id"]))
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=_session_max_age_seconds(),
        secure=_cookie_secure(),
    )
    return {"username": user["username"], "role": user["role"]}


@app.post("/auth/logout")
def logout(
    response: Response,
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    delete_session(conn, user.get("raw_session_token"))
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(require_user)):
    return {"username": user["username"], "role": user["role"]}


# --------------------------------------------------------------------------
# users
# --------------------------------------------------------------------------

@app.get("/users")
def get_users(_: dict[str, Any] = Depends(require_admin), conn=Depends(get_db)):
    return [_user_public(row) for row in list_users(conn)]


@app.post("/users")
def add_user(
    payload: CreateUserRequest,
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    created = create_user(
        conn=conn,
        username=payload.username,
        password=payload.password,
        role=payload.role,
        created_by=admin["username"],
    )
    return _user_public(created)


@app.patch("/users/{user_id}")
def patch_user(
    user_id: int,
    payload: UpdateUserRequest,
    _: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    updated = update_user(
        conn=conn,
        user_id=user_id,
        role=payload.role,
        is_active=payload.is_active,
        password=payload.password,
    )
    return _user_public(updated)


# --------------------------------------------------------------------------
# Cisco account reference
# --------------------------------------------------------------------------

@app.get("/accounts")
def get_accounts(
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sl2: str | None = Query(default=None),
    sl3: str | None = Query(default=None),
    sl4: str | None = Query(default=None),
    sl5: str | None = Query(default=None),
    sl6: str | None = Query(default=None),
    savm_group_id: str | None = Query(default=None),
    unified_account_name: str | None = Query(default=None),
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return list_accounts(
        conn=conn,
        search=search,
        state=state,
        vertical=vertical,
        tier=tier,
        segment=segment,
        source=source,
        sl2=sl2,
        sl3=sl3,
        sl4=sl4,
        sl5=sl5,
        sl6=sl6,
        savm_group_id=savm_group_id,
        unified_account_name=unified_account_name,
        limit=limit,
        offset=offset,
    )


@app.get("/accounts/facets")
def get_accounts_facets(
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sl2: str | None = Query(default=None),
    sl3: str | None = Query(default=None),
    sl4: str | None = Query(default=None),
    sl5: str | None = Query(default=None),
    sl6: str | None = Query(default=None),
    savm_group_id: str | None = Query(default=None),
    unified_account_name: str | None = Query(default=None),
    sl6_search: str | None = Query(default=None),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return get_account_facets(
        conn=conn,
        search=search,
        state=state,
        vertical=vertical,
        tier=tier,
        segment=segment,
        source=source,
        sl2=sl2,
        sl3=sl3,
        sl4=sl4,
        sl5=sl5,
        sl6=sl6,
        savm_group_id=savm_group_id,
        unified_account_name=unified_account_name,
        sl6_search=sl6_search,
    )


@app.get("/accounts/options")
def get_account_options(
    column: str = Query(...),
    query: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sl2: str | None = Query(default=None),
    sl3: str | None = Query(default=None),
    sl4: str | None = Query(default=None),
    sl5: str | None = Query(default=None),
    sl6: str | None = Query(default=None),
    savm_group_id: str | None = Query(default=None),
    unified_account_name: str | None = Query(default=None),
    limit: int = Query(default=50),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """Searchable dropdown options for a high-cardinality column."""
    return search_account_options(
        conn=conn,
        column=column,
        query=query,
        limit=limit,
        state=state,
        vertical=vertical,
        tier=tier,
        segment=segment,
        source=source,
        sl2=sl2,
        sl3=sl3,
        sl4=sl4,
        sl5=sl5,
        sl6=sl6,
        savm_group_id=savm_group_id,
        unified_account_name=unified_account_name,
    )


@app.get("/accounts/export.xlsx")
def export_accounts_workbook(
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sl2: str | None = Query(default=None),
    sl3: str | None = Query(default=None),
    sl4: str | None = Query(default=None),
    sl5: str | None = Query(default=None),
    sl6: str | None = Query(default=None),
    savm_group_id: str | None = Query(default=None),
    unified_account_name: str | None = Query(default=None),
    columns: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """Every row matching the filters, as a ready-made Excel workbook.

    Built here rather than in the browser: the reference runs to a few hundred
    thousand rows, and handing that over as JSON for the client to assemble
    costs hundreds of megabytes and minutes of waiting.
    """
    filters = _account_filter_params(
        state=state,
        vertical=vertical,
        tier=tier,
        segment=segment,
        source=source,
        sl2=sl2,
        sl3=sl3,
        sl4=sl4,
        sl5=sl5,
        sl6=sl6,
        savm_group_id=savm_group_id,
        unified_account_name=unified_account_name,
    )
    selected = parse_columns_param(columns) or get_allocation_columns(conn)["selected"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"ALLOCATION_ae_accounts_{stamp}.xlsx"

    return StreamingResponse(
        stream_accounts_workbook(
            conn,
            selected=selected,
            search=search,
            include_inactive=include_inactive,
            **filters,
        ),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/accounts/export")
def export_accounts(
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sl2: str | None = Query(default=None),
    sl3: str | None = Query(default=None),
    sl4: str | None = Query(default=None),
    sl5: str | None = Query(default=None),
    sl6: str | None = Query(default=None),
    savm_group_id: str | None = Query(default=None),
    unified_account_name: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """The filtered rows as JSON, for programmatic callers.

    Capped, because serializing the whole reference here runs to hundreds of
    megabytes and minutes of wall time. Use `/accounts/export.xlsx` for a real
    download; it streams and has no cap.
    """
    filters = _account_filter_params(
        state=state,
        vertical=vertical,
        tier=tier,
        segment=segment,
        source=source,
        sl2=sl2,
        sl3=sl3,
        sl4=sl4,
        sl5=sl5,
        sl6=sl6,
        savm_group_id=savm_group_id,
        unified_account_name=unified_account_name,
    )

    limit = _max_json_export_rows()
    total = count_accounts(
        conn, search=search, include_inactive=include_inactive, **filters
    )
    if total > limit:
        raise APIError(
            "payload_too_large",
            f"{total:,} rows exceeds the {limit:,}-row JSON export cap. "
            "Narrow the filters, or use /accounts/export.xlsx for the full set.",
            413,
        )

    def _chunks():
        yield '{"items":['
        count = 0
        for item in iter_accounts(
            conn, search=search, include_inactive=include_inactive, **filters
        ):
            item.pop("account_id", None)
            yield ("," if count else "") + json.dumps(item, default=str)
            count += 1
        yield f'],"total":{count}}}'

    return StreamingResponse(
        _chunks(),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


@app.delete("/accounts")
def purge_account_reference(
    payload: PurgeAccountsRequest,
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    """Irreversibly empty the reference table. Export first; this does not.

    Guarded by a typed confirmation rather than a plain boolean so an accidental
    or replayed request cannot wipe the reference.
    """
    if (payload.confirm or "").strip() != "DELETE":
        raise APIError(
            "validation_failed",
            "Type DELETE to confirm emptying the AE Allocation reference table.",
            400,
        )
    return purge_accounts(conn, actor=admin["username"])


@app.get("/accounts/group/{savm_group_id}")
def get_account_group(
    savm_group_id: str,
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    summary = get_group_summary(conn, savm_group_id)
    if summary is None:
        raise APIError("not_found", "SAVM group not found.", 404)
    summary["accounts"] = get_group_accounts(conn, savm_group_id)
    return summary


@app.get("/accounts/{account_id}")
def get_one_account(
    account_id: int,
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    item = get_account(conn, account_id)
    if item is None:
        raise APIError("not_found", "Account not found.", 404)
    return item


@app.post("/accounts/import")
async def import_accounts(
    file: UploadFile = File(...),
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    stream = _upload_text_stream(file)
    try:
        return import_accounts_stream(
            conn=conn,
            text_stream=stream,
            filename=file.filename or "cisco_accounts.csv",
            actor=admin["username"],
        )
    except UnicodeDecodeError as exc:
        raise APIError("validation_failed", "CSV must be valid UTF-8 text.", 400) from exc
    finally:
        # Detach so closing the wrapper does not close Starlette's spooled file.
        stream.detach()


@app.get("/accounts/import/{batch_id}")
def get_account_import(
    batch_id: int,
    _: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    row = conn.execute(
        "SELECT * FROM import_batches WHERE id = ? AND kind = 'cisco_accounts'",
        (batch_id,),
    ).fetchone()
    if row is None:
        raise APIError("not_found", "Import batch not found.", 404)
    return _batch_row_to_dict(row)


# --------------------------------------------------------------------------
# matches
# --------------------------------------------------------------------------

def _match_filters(
    status: str | None,
    search: str | None,
    state: str | None,
    vertical: str | None,
    tier: str | None,
    link_status: str | None,
    match_level: str | None,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    return {
        "status": status,
        "search": search,
        "state": state,
        "vertical": vertical,
        "tier": tier,
        "link_status": link_status,
        "match_level": match_level,
        "limit": limit,
        "offset": offset,
    }


@app.get("/matches")
def get_matches(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    link_status: str | None = Query(default=None),
    match_level: str | None = Query(default=None),
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return list_matches(
        conn,
        _match_filters(
            status, search, state, vertical, tier, link_status, match_level, limit, offset
        ),
    )


@app.post("/matches")
def add_match(
    payload: MatchCreateRequest,
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return create_match(conn, payload.model_dump(), actor=user["username"])


@app.post("/matches/bulk-approve")
def bulk_approve_matches(
    payload: BulkApproveRequest,
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    return bulk_approve(
        conn=conn,
        ids=payload.ids,
        actor=admin["username"],
        role=admin["role"],
        notes=payload.notes,
    )


@app.get("/matches/export")
def export_matches(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    link_status: str | None = Query(default=None),
    match_level: str | None = Query(default=None),
    limit: int = Query(default=200),
    offset: int = Query(default=0),
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    data = list_matches(
        conn,
        _match_filters(
            status, search, state, vertical, tier, link_status, match_level, limit, offset
        ),
    )

    fieldnames = [
        "match_id",
        "entity_name_original",
        "entity_name_cleaned",
        "entity_state",
        "savm_group_id",
        "savm_group_name",
        "sfdc_account_name",
        "account_state",
        "match_level",
        "am_name",
        "am_email",
        "am_confidence",
        "vertical",
        "tier",
        "segment",
        "confidence_score",
        "match_stage",
        "status",
        "link_status",
        "drifted",
        "notes",
        "source",
        "source_detail",
        "created_by",
        "created_at",
        "decided_by",
        "decided_at",
    ]

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for item in data["items"]:
        account = item.get("account") or {}
        am = item.get("am") or {}
        writer.writerow(
            {
                **item,
                "savm_group_name": account.get("savm_group_name")
                or item.get("snap_savm_group_name"),
                "vertical": account.get("vertical"),
                "tier": account.get("tier"),
                "segment": account.get("segment"),
                "am_name": am.get("am_name"),
                "am_email": am.get("am_email"),
                "am_confidence": am.get("am_confidence"),
            }
        )
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=matches_export.csv"},
    )


@app.post("/matches/import")
async def import_matches(
    file: UploadFile = File(...),
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    file_bytes = await _read_upload(file, require_csv=True)
    return import_matches_csv(
        conn=conn,
        file_bytes=file_bytes,
        filename=file.filename or "matches_import.csv",
        actor=admin["username"],
    )


@app.post("/matches/import-deletions")
async def import_deletions(
    file: UploadFile = File(...),
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    file_bytes = await _read_upload(file, require_csv=True)
    return import_match_deletions_csv(
        conn=conn,
        file_bytes=file_bytes,
        filename=file.filename or "deletions_import.csv",
        actor=admin["username"],
    )


@app.patch("/matches/{match_id}")
def patch_match_notes(
    match_id: int,
    payload: NotesPatchRequest,
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return update_notes(
        conn, match_id=match_id, actor=user["username"], notes=payload.notes
    )


@app.post("/matches/{match_id}/approve")
def approve_one_match(
    match_id: int,
    payload: NotesPatchRequest = Body(default=NotesPatchRequest()),
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return approve_match(
        conn=conn,
        match_id=match_id,
        actor=user["username"],
        role=user["role"],
        notes=payload.notes,
    )


@app.post("/matches/{match_id}/reject")
def reject_one_match(
    match_id: int,
    payload: RejectRequest,
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return reject_match(
        conn, match_id=match_id, actor=user["username"], notes=payload.notes
    )


@app.delete("/matches/{match_id}")
def delete_one_match(
    match_id: int,
    payload: DeleteRequest = Body(default=DeleteRequest()),
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    return soft_delete_match(
        conn=conn,
        match_id=match_id,
        actor=admin["username"],
        role=admin["role"],
        notes=payload.notes,
    )


@app.post("/matches/{match_id}/restore")
def restore_one_match(
    match_id: int,
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    return restore_match(
        conn=conn, match_id=match_id, actor=admin["username"], role=admin["role"]
    )


@app.get("/matches/{match_id}/history")
def read_match_history(
    match_id: int,
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return get_match_history(conn, match_id)


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------


@app.get("/match/stages")
def get_match_stages(
    include_unimplemented: bool = Query(default=False),
    _: dict[str, Any] = Depends(require_user),
):
    stages = (
        MATCH_STAGE_LADDER if include_unimplemented else IMPLEMENTED_MATCH_STAGE_LADDER
    )
    return {"stages": [dict(stage) for stage in stages]}


@app.get("/match/progress/{run_id}")
def get_match_progress(run_id: str, _: dict[str, Any] = Depends(require_user)):
    with _RUN_PROGRESS_LOCK:
        progress = _RUN_PROGRESS.get(run_id)
    if progress is None:
        return {
            "run_id": run_id,
            "completed": False,
            "status": "pending",
            "message": "Run has not started yet.",
            "completed_stage_ids": [],
            "skipped_stage_ids": [],
            "warnings": [],
        }
    return progress

def _run_matcher_config(cfg: dict[str, Any]) -> MultiStageEntityMatcher:
    return MultiStageEntityMatcher(
        abbreviations=cfg.get("abbreviations"),
        use_state_blocking=cfg.get("use_state_blocking", True),
        use_context_validation=cfg.get("use_context_validation", True),
        context_config=cfg.get("context_config"),
    )


def _external_field(record: dict[str, Any], canonical_key: str) -> str | None:
    """Pull a canonical reference field out of the matcher's External_* columns."""
    for key, value in record.items():
        if not key.startswith("External_"):
            continue
        if COLUMN_ALIASES.get(_normalize_header(key[len("External_"):])) != canonical_key:
            continue
        text_value = _clean_text(value)
        if text_value:
            return text_value
    return None


def _match_level_for(reference_col: str) -> str:
    """SAVM or SFDC, based on which reference column the user matched against."""
    canonical = COLUMN_ALIASES.get(_normalize_header(str(reference_col)))
    return "SFDC" if canonical == "sfdc_account_name" else "SAVM"


def _frame_is_reference(frame: pd.DataFrame) -> bool:
    """True when a frame carries the SAVM group id, marking it as the Cisco reference."""
    return any(
        COLUMN_ALIASES.get(_normalize_header(str(column))) == "savm_group_id"
        for column in frame.columns
    )


def _orient_frames(
    internal_df: pd.DataFrame, external_df: pd.DataFrame, cfg: dict[str, Any]
) -> tuple[pd.DataFrame, pd.DataFrame, str, str, bool]:
    """Return (entity_df, reference_df, entity_col, reference_col, swapped).

    The library keys on the entity being matched, so the entity list has to be
    the frame the matcher iterates. The workspace UI sends the two files in the
    opposite order, so instead of trusting the labels we detect which side
    carries the SAVM group id and treat that side as the Cisco reference.
    """
    if _frame_is_reference(internal_df) and not _frame_is_reference(external_df):
        return (
            external_df,
            internal_df,
            str(cfg["external_col"]),
            str(cfg["internal_col"]),
            True,
        )
    return (
        internal_df,
        external_df,
        str(cfg["internal_col"]),
        str(cfg["external_col"]),
        False,
    )


def _derive_cleaned_and_state(
    matcher: MultiStageEntityMatcher, original_name: str
) -> tuple[str, str]:
    state, core_name = matcher.normalizer.extract_state_and_name(original_name or "")
    cleaned_name = matcher.normalizer.normalize_name(core_name, expand_abbrev=True)
    return cleaned_name, state


def _apply_am(record: dict[str, Any], am: dict[str, Any] | None) -> None:
    record["AM_Name"] = (am or {}).get("am_name") or ""
    record["AM_Email"] = (am or {}).get("am_email") or ""
    record["AM_Confidence"] = (am or {}).get("am_confidence") or ""
    record["AM_Source_Account"] = (am or {}).get("am_source_account_name") or ""


@app.post("/match")
async def match(
    internal_file: UploadFile = File(...),
    external_file: UploadFile = File(...),
    config: str = Form(...),
):
    """Stateless match. Kept unchanged for backward compatibility."""
    cfg = _parse_match_config(config)
    internal_df = _parse_csv_bytes(
        await _read_upload(internal_file, require_csv=True), "internal_file"
    )
    external_df = _parse_csv_bytes(
        await _read_upload(external_file, require_csv=True), "external_file"
    )

    matcher = _run_matcher_config(cfg)
    results_df, stats = matcher.match_entities(
        internal_df, external_df, cfg["internal_col"], cfg["external_col"]
    )
    records = _sanitize_records(results_df.fillna("").to_dict(orient="records"))
    return JSONResponse({"results": records, "stats": stats})


@app.post("/match/run")
async def match_and_stage(
    internal_file: UploadFile = File(...),
    external_file: UploadFile = File(...),
    config: str = Form(...),
    run_id: str | None = Form(default=None),
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """Match with library memory: Stage 1 is a lookup, only misses are scored."""
    cfg = _parse_match_config(config)
    run_token = _next_run_id(run_id)
    skipped_stage_ids = cfg.get("skipped_stages", [])
    skipped_stage_set = set(skipped_stage_ids)
    skipped_stage_names = _stage_names(skipped_stage_ids)
    warnings: list[str] = []
    if STAGE_LIBRARY_ID in skipped_stage_set:
        warnings.append(
            "Stage 1 (library lookup) was skipped. Previously approved matches were re-scored."
        )

    completed_stage_ids: list[str] = []
    _start_progress(run_token, skipped_stage_ids=skipped_stage_ids)

    try:
        internal_df = _parse_csv_bytes(
            await _read_upload(internal_file, require_csv=True), "internal_file"
        )
        external_df = _parse_csv_bytes(
            await _read_upload(external_file, require_csv=True), "external_file"
        )

        entity_df, reference_df, entity_col, reference_col, swapped = _orient_frames(
            internal_df, external_df, cfg
        )

        requested_state_blocking = bool(cfg.get("use_state_blocking", True))
        reference_has_state = _frame_has_canonical_column(reference_df, "state")
        effective_cfg = dict(cfg)
        if requested_state_blocking and not reference_has_state:
            effective_cfg["use_state_blocking"] = False
            warnings.append(
                "State blocking was requested but the reference file has no state column. "
                "Scoring proceeded with state blocking off and flagged rows for mismatch review."
            )

        matcher = _run_matcher_config(effective_cfg)
        active_library = get_active_library(conn)
        rejected_keys = get_rejected_keys(conn)
        match_level = _match_level_for(reference_col)

        library_records: list[dict[str, Any]] = []
        remaining_indices: list[Any] = []

        if STAGE_LIBRARY_ID in skipped_stage_set:
            remaining_indices = list(entity_df.index)
            _mark_stage_progress(
                run_token,
                STAGE_LIBRARY_ID,
                message="Skipped by user toggle.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="skipped",
            )
        else:
            _mark_stage_progress(
                run_token,
                STAGE_LIBRARY_ID,
                message="Checking approved match library.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
            )
            for idx, row in entity_df.iterrows():
                internal_value = row.get(entity_col, "")
                original_name = "" if pd.isna(internal_value) else str(internal_value)
                cleaned_name, state = _derive_cleaned_and_state(matcher, original_name)

                entry = active_library.get((cleaned_name, state))
                if entry is None:
                    remaining_indices.append(idx)
                    continue

                record = row.to_dict()
                matched_name = (
                    entry.get("account_name")
                    or entry.get("savm_group_name")
                    or ""
                )
                record["Match_Status"] = "Matched"
                record["Matched_Name"] = matched_name
                record["Confidence_Score"] = 1.0
                record["Match_Stage"] = STAGE_LIBRARY_ID
                record["State"] = state
                record["Context_Notes"] = "Resolved from the match library"
                record["Top_3_Candidates"] = ""
                record["Library_Match_ID"] = entry.get("match_id")
                record["SAVM_Group_ID"] = entry.get("savm_group_id") or ""
                record["SAVM_Group_Name"] = entry.get("savm_group_name") or ""
                record["Match_Level"] = entry.get("match_level") or ""
                record["Review_Required"] = False
                record["State_Mismatch_Flag"] = _state_flag(
                    requested_state_blocking=requested_state_blocking,
                    reference_has_state=reference_has_state,
                    entity_state=state,
                    reference_state=entry.get("account_state"),
                )

                group_id = entry.get("savm_group_id")
                if entry.get("match_level") == "SFDC" and group_id:
                    try:
                        account = resolve_account_reference(
                            conn,
                            group_id,
                            entry.get("sfdc_account_name"),
                            entry.get("account_state"),
                        )
                        _apply_am(record, resolve_account_am(account))
                    except (UnknownAccountReference, AmbiguousAccountReference):
                        _apply_am(record, None)
                elif group_id:
                    _apply_am(record, resolve_group_am(conn, group_id))
                else:
                    _apply_am(record, None)

                library_records.append(record)

            completed_stage_ids.append(STAGE_LIBRARY_ID)
            _mark_stage_progress(
                run_token,
                STAGE_LIBRARY_ID,
                message=f"Library lookup complete ({len(library_records)} hits).",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="complete",
            )

        matcher_records: list[dict[str, Any]] = []
        stats: dict[str, Any] = {
            "total_internal": int(len(entity_df)),
            "total_external": int(len(reference_df)),
            "stage_0_exact": 0,
            "stage_1_high_confidence": 0,
            "stage_2_confident": 0,
            "stage_3_probable": 0,
            "stage_4_review": 0,
            "unmatched": 0,
            "total_matched": 0,
            "match_rate": 0.0,
            "elapsed_time": 0.0,
        }

        exact_stage_id = "exact_fuzzy_94"
        savm_stage_id = "savm_lookup"
        sfdc_stage_id = "sfdc_lookup"
        raw_matcher_records: list[dict[str, Any]] = []

        for stage_id in (savm_stage_id, sfdc_stage_id):
            if stage_id in skipped_stage_set:
                _mark_stage_progress(
                    run_token,
                    stage_id,
                    message="Skipped by user toggle.",
                    completed_stage_ids=completed_stage_ids,
                    skipped_stage_ids=skipped_stage_ids,
                    warnings=warnings,
                    status="skipped",
                )

        if exact_stage_id in skipped_stage_set:
            _mark_stage_progress(
                run_token,
                exact_stage_id,
                message="Skipped by user toggle.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="skipped",
            )
        elif not remaining_indices:
            completed_stage_ids.append(exact_stage_id)
            _mark_stage_progress(
                run_token,
                exact_stage_id,
                message="No entities remaining for this stage.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="complete",
            )
        else:
            _mark_stage_progress(
                run_token,
                exact_stage_id,
                message="Running matcher comparisons.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
            )
            remaining_df = entity_df.loc[remaining_indices].copy()
            results_df, stats = matcher.match_entities(
                remaining_df, reference_df, entity_col, reference_col
            )
            raw_matcher_records = _sanitize_records(
                results_df.fillna("").to_dict(orient="records")
            )
            completed_stage_ids.append(exact_stage_id)
            _mark_stage_progress(
                run_token,
                exact_stage_id,
                message=f"Scored {len(raw_matcher_records)} remaining rows.",
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="complete",
            )

        if remaining_indices and not raw_matcher_records:
            fallback_stage = (
                exact_stage_id if exact_stage_id not in skipped_stage_set else STAGE_LIBRARY_ID
            )
            for idx in remaining_indices:
                row = entity_df.loc[idx]
                original_name = "" if pd.isna(row.get(entity_col, "")) else str(row.get(entity_col, ""))
                _, derived_state = _derive_cleaned_and_state(matcher, original_name)
                passthrough = row.to_dict()
                passthrough["Match_Status"] = "Unmatched"
                passthrough["Matched_Name"] = ""
                passthrough["Confidence_Score"] = 0.0
                passthrough["Match_Stage"] = fallback_stage
                passthrough["State"] = derived_state
                passthrough["Context_Notes"] = "All non-library stages were skipped."
                passthrough["Top_3_Candidates"] = ""
                passthrough["Review_Required"] = False
                passthrough["State_Mismatch_Flag"] = _state_flag(
                    requested_state_blocking=requested_state_blocking,
                    reference_has_state=reference_has_state,
                    entity_state=derived_state,
                    reference_state=None,
                )
                raw_matcher_records.append(passthrough)

        newly_staged = 0
        suppressed = 0

        for record in raw_matcher_records:
            original_stage = _clean_text(record.get("Match_Stage")) or ""
            record["Review_Required"] = original_stage == "review"
            record["Match_Stage"] = _stage_for_match_record(record, match_level)

            original_name = _clean_text(record.get(entity_col)) or ""
            cleaned_name, fallback_state = _derive_cleaned_and_state(matcher, original_name)
            entity_state = _clean_text(record.get("State")) or fallback_state
            record["State"] = entity_state

            group_id = _external_field(record, "savm_group_id")
            account_name = _external_field(record, "sfdc_account_name")
            account_state = _external_field(record, "state")
            record["State_Mismatch_Flag"] = _state_flag(
                requested_state_blocking=requested_state_blocking,
                reference_has_state=reference_has_state,
                entity_state=entity_state,
                reference_state=account_state,
            )
            record["SAVM_Group_ID"] = group_id or ""
            record["Match_Level"] = match_level if group_id else ""

            if _clean_text(record.get("Match_Status")) != "Matched":
                matcher_records.append(record)
                continue

            if record["Match_Stage"] in skipped_stage_set:
                record["Match_Status"] = "Unmatched"
                record["Matched_Name"] = ""
                record["Context_Notes"] = f"Skipped {_run_stage(record['Match_Stage'])['name']}."
                matcher_records.append(record)
                continue

            if not group_id:
                # The reference file did not carry a SAVM group id, so there is
                # nothing stable to remember. Leave the result unstaged.
                record["Match_Status"] = "Unmatched"
                record["Library_Note"] = "not_staged_missing_savm_group_id"
                _apply_am(record, None)
                matcher_records.append(record)
                continue

            row_level = match_level
            resolved_account: dict[str, Any] | None = None
            if row_level == "SFDC" and account_name:
                try:
                    resolved_account = resolve_account_reference(
                        conn, group_id, account_name, account_state
                    )
                except (UnknownAccountReference, AmbiguousAccountReference):
                    resolved_account = None
                    row_level = "SAVM"
            else:
                row_level = "SAVM"

            rejected_key = (
                cleaned_name,
                group_id,
                (resolved_account or {}).get("sfdc_account_name") or "",
                (resolved_account or {}).get("state") or "",
            )
            if rejected_key in rejected_keys:
                record["Match_Status"] = "Suppressed"
                record["Context_Notes"] = "Previously rejected for this account"
                suppressed += 1
                matcher_records.append(record)
                continue

            if resolved_account is not None:
                _apply_am(record, resolve_account_am(resolved_account))
            else:
                _apply_am(record, resolve_group_am(conn, group_id))

            try:
                created = create_match(
                    conn=conn,
                    payload={
                        "entity_name_original": original_name,
                        "entity_name_cleaned": cleaned_name,
                        "entity_state": entity_state,
                        "savm_group_id": group_id,
                        "sfdc_account_name": (resolved_account or {}).get("sfdc_account_name"),
                        "account_state": (resolved_account or {}).get("state"),
                        "match_level": row_level,
                        "confidence_score": record.get("Confidence_Score"),
                        "match_stage": record.get("Match_Stage"),
                        "source": "match_run",
                        "source_detail": internal_file.filename or "internal.csv",
                    },
                    actor=user["username"],
                )
                record["Staged_Match_ID"] = created.get("id")
                record["Staged_Status"] = created.get("status")
                newly_staged += 1
            except DuplicateActiveMatch:
                record["Library_Note"] = "already_active"
            except MatchValidationFailedError as exc:
                record["Library_Note"] = f"not_staged: {exc}"

            matcher_records.append(record)

        combined = _sanitize_records(matcher_records + library_records)
        for record in combined:
            stage_id = _clean_text(record.get("Match_Stage"))
            if not stage_id or stage_id not in MATCH_STAGE_BY_ID:
                record["Match_Stage"] = STAGE_LIBRARY_ID

        combined.sort(
            key=lambda item: float(item.get("Confidence_Score") or 0.0), reverse=True
        )

        stage_counts = {stage_id: 0 for stage_id in MATCH_STAGE_IDS}
        for record in combined:
            if _clean_text(record.get("Match_Status")) == "Matched":
                stage_id = _clean_text(record.get("Match_Stage")) or STAGE_LIBRARY_ID
                stage_counts[stage_id] = stage_counts.get(stage_id, 0) + 1

        total_internal = int(len(entity_df))
        total_matched = sum(stage_counts.values())
        unmatched_rows = sum(
            1 for record in combined if _clean_text(record.get("Match_Status")) != "Matched"
        )
        stats["total_internal"] = total_internal
        stats["total_external"] = int(len(reference_df))
        stats["total_matched"] = total_matched
        stats["unmatched"] = unmatched_rows
        stats["match_rate"] = (total_matched / total_internal) if total_internal else 0.0
        stats["stage_counts"] = stage_counts

        for stage_id, stage_label in (
            (savm_stage_id, "SAVM-level"),
            (sfdc_stage_id, "SFDC-level"),
        ):
            if stage_id in skipped_stage_set:
                continue
            if stage_id not in completed_stage_ids:
                completed_stage_ids.append(stage_id)
            _mark_stage_progress(
                run_token,
                stage_id,
                message=(
                    f"Resolved {stage_counts.get(stage_id, 0)} matched rows at {stage_label}."
                ),
                completed_stage_ids=completed_stage_ids,
                skipped_stage_ids=skipped_stage_ids,
                warnings=warnings,
                status="complete",
            )

        run_summary = {
            "skipped_stage_ids": skipped_stage_ids,
            "skipped_stages": skipped_stage_names,
            "warnings": warnings,
            "stage_1_skipped_warning": STAGE_LIBRARY_ID in skipped_stage_set,
        }
        _finish_progress(
            run_token,
            completed_stage_ids=completed_stage_ids,
            skipped_stage_ids=skipped_stage_ids,
            warnings=warnings,
            summary=run_summary,
        )

        return JSONResponse(
            {
                "run_id": run_token,
                "results": combined,
                "stats": stats,
                "library_hits": len(library_records),
                "newly_staged": newly_staged,
                "suppressed": suppressed,
                "orientation_swapped": swapped,
                "entity_column": entity_col,
                "reference_column": reference_col,
                "stage_ladder": [dict(stage) for stage in IMPLEMENTED_MATCH_STAGE_LADDER],
                "run_summary": run_summary,
            }
        )
    except Exception as exc:
        _finish_progress(
            run_token,
            completed_stage_ids=completed_stage_ids,
            skipped_stage_ids=skipped_stage_ids,
            warnings=warnings,
            error=str(exc),
        )
        raise


# --------------------------------------------------------------------------
# settings
# --------------------------------------------------------------------------

@app.get("/settings/allocation-columns")
def read_allocation_columns(
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """The AE Allocation column selection. Global, so every reviewer sees it."""
    return get_allocation_columns(conn)


@app.put("/settings/allocation-columns")
def write_allocation_columns(
    payload: AllocationColumnsRequest,
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    return set_allocation_columns(conn, payload.columns, actor=admin["username"])


@app.post("/settings/allocation-columns/reset")
def restore_allocation_columns(
    admin: dict[str, Any] = Depends(require_admin),
    conn=Depends(get_db),
):
    return reset_allocation_columns(conn, actor=admin["username"])


# --------------------------------------------------------------------------
# admin ops
# --------------------------------------------------------------------------

@app.post("/admin/backup")
def backup_database(_: dict[str, Any] = Depends(require_admin)):
    db_path = resolve_db_path()
    if not os.path.exists(db_path):
        raise APIError("not_found", "Database file not found.", 404)

    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
    os.makedirs(backup_dir, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = os.path.join(backup_dir, f"offload-{stamp}.db")

    with _db_connection() as conn:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    shutil.copy2(db_path, target)

    return {"backup_file": os.path.basename(target), "created_at": stamp}


if __name__ == "__main__":
    port = int(os.getenv("OFFLOAD_MATCHER_PORT", "8010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
