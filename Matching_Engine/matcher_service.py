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
from contextlib import contextmanager
from datetime import datetime, timezone
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
from cisco_store import (
    COLUMN_ALIASES,
    AmbiguousAccountReference,
    CiscoStoreError,
    UnknownAccountReference,
    ValidationFailedError as AccountValidationFailedError,
    get_account,
    get_account_facets,
    get_group_accounts,
    get_group_summary,
    import_accounts_stream,
    list_accounts,
    resolve_account_am,
    resolve_account_reference,
    resolve_group_am,
)
from db import get_connection, init_db, resolve_db_path
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


# --------------------------------------------------------------------------
# config helpers
# --------------------------------------------------------------------------

def _session_max_age_seconds() -> int:
    return session_hours() * 3600


def _cookie_secure() -> bool:
    return os.getenv("OFFLOAD_COOKIE_SECURE", "0") == "1"


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
        limit=limit,
        offset=offset,
    )


@app.get("/accounts/facets")
def get_accounts_facets(
    _: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    return get_account_facets(conn)


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
    user: dict[str, Any] = Depends(require_user),
    conn=Depends(get_db),
):
    """Match with library memory: Stage 1 is a lookup, only misses are scored."""
    cfg = _parse_match_config(config)
    internal_df = _parse_csv_bytes(
        await _read_upload(internal_file, require_csv=True), "internal_file"
    )
    external_df = _parse_csv_bytes(
        await _read_upload(external_file, require_csv=True), "external_file"
    )

    entity_df, reference_df, entity_col, reference_col, swapped = _orient_frames(
        internal_df, external_df, cfg
    )

    matcher = _run_matcher_config(cfg)
    active_library = get_active_library(conn)
    rejected_keys = get_rejected_keys(conn)
    match_level = _match_level_for(reference_col)

    library_records: list[dict[str, Any]] = []
    remaining_indices: list[Any] = []

    for idx, row in entity_df.iterrows():
        internal_value = row.get(entity_col, "")
        original_name = "" if pd.isna(internal_value) else str(internal_value)
        cleaned_name, state = _derive_cleaned_and_state(matcher, original_name)

        entry = active_library.get((cleaned_name, state))
        if entry is None:
            remaining_indices.append(idx)
            continue

        record = row.to_dict()
        matched_name = entry.get("account_name") or entry.get("savm_group_name") or ""
        record["Match_Status"] = "Matched"
        record["Matched_Name"] = matched_name
        record["Confidence_Score"] = 1.0
        record["Match_Stage"] = "verified_library"
        record["State"] = state
        record["Context_Notes"] = "Resolved from the match library"
        record["Top_3_Candidates"] = ""
        record["Library_Match_ID"] = entry.get("match_id")
        record["SAVM_Group_ID"] = entry.get("savm_group_id") or ""
        record["SAVM_Group_Name"] = entry.get("savm_group_name") or ""
        record["Match_Level"] = entry.get("match_level") or ""

        group_id = entry.get("savm_group_id")
        if entry.get("match_level") == "SFDC" and group_id:
            try:
                account = resolve_account_reference(
                    conn, group_id, entry.get("sfdc_account_name"), entry.get("account_state")
                )
                _apply_am(record, resolve_account_am(account))
            except (UnknownAccountReference, AmbiguousAccountReference):
                _apply_am(record, None)
        elif group_id:
            _apply_am(record, resolve_group_am(conn, group_id))
        else:
            _apply_am(record, None)

        library_records.append(record)

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

    if remaining_indices:
        remaining_df = entity_df.loc[remaining_indices].copy()
        results_df, stats = matcher.match_entities(
            remaining_df, reference_df, entity_col, reference_col
        )
        matcher_records = _sanitize_records(
            results_df.fillna("").to_dict(orient="records")
        )

    newly_staged = 0
    suppressed = 0

    for record in matcher_records:
        if _clean_text(record.get("Match_Status")) != "Matched":
            continue

        original_name = _clean_text(record.get(entity_col)) or ""
        cleaned_name, fallback_state = _derive_cleaned_and_state(matcher, original_name)
        entity_state = _clean_text(record.get("State")) or fallback_state

        group_id = _external_field(record, "savm_group_id")
        account_name = _external_field(record, "sfdc_account_name")
        account_state = _external_field(record, "state")

        record["SAVM_Group_ID"] = group_id or ""
        record["Match_Level"] = match_level if group_id else ""

        if not group_id:
            # The reference file did not carry a SAVM group id, so there is
            # nothing stable to remember. Leave the result unstaged.
            record["Library_Note"] = "not_staged_missing_savm_group_id"
            _apply_am(record, None)
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
            record["Match_Stage"] = "suppressed_previously_rejected"
            record["Context_Notes"] = "Previously rejected for this account"
            suppressed += 1
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

    combined = _sanitize_records(matcher_records + library_records)
    combined.sort(
        key=lambda item: float(item.get("Confidence_Score") or 0.0), reverse=True
    )

    return JSONResponse(
        {
            "results": combined,
            "stats": stats,
            "library_hits": len(library_records),
            "newly_staged": newly_staged,
            "suppressed": suppressed,
            "orientation_swapped": swapped,
            "entity_column": entity_col,
            "reference_column": reference_col,
        }
    )


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
