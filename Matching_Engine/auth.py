"""
Users, sessions, and password hashing for the OffLoad match library.

Passwords are hashed with Argon2id and never stored or logged in plaintext.
Session tokens are returned to the caller exactly once; only their SHA-256
hash is persisted, so a database leak cannot be replayed as a login.
"""

import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from db import transaction, utcnow

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
TOKEN_BYTES = 32
DEFAULT_SESSION_HOURS = 8
VALID_ROLES = ("admin", "reviewer")

_hasher = PasswordHasher()

# Verified against every failed lookup so a missing username costs roughly the
# same time as a wrong password, denying an enumeration oracle.
_DUMMY_HASH = _hasher.hash("offload-timing-equalizer")


class AuthError(Exception):
    """Base class for authentication and user-management failures."""


class DuplicateUser(AuthError):
    pass


class WeakPassword(AuthError):
    pass


class InvalidRole(AuthError):
    pass


class UserNotFound(AuthError):
    pass


# --------------------------------------------------------------------------
# passwords
# --------------------------------------------------------------------------

def validate_password(password: str) -> None:
    if password is None or len(password) < MIN_PASSWORD_LENGTH:
        raise WeakPassword(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise WeakPassword(
            f"Password must be at most {MAX_PASSWORD_LENGTH} characters."
        )


def hash_password(password: str) -> str:
    validate_password(password)
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _burn_time() -> None:
    """Spend a comparable amount of time on a failed username lookup."""
    try:
        _hasher.verify(_DUMMY_HASH, "not-the-password")
    except Exception:
        pass


# --------------------------------------------------------------------------
# users
# --------------------------------------------------------------------------

def _validate_role(role: str) -> None:
    if role not in VALID_ROLES:
        raise InvalidRole(f"Role must be one of {', '.join(VALID_ROLES)}.")


def create_user(
    conn: sqlite3.Connection,
    username: str,
    password: str,
    role: str,
    created_by: Optional[str] = None,
) -> sqlite3.Row:
    username = (username or "").strip()
    if not username:
        raise AuthError("Username is required.")
    _validate_role(role)
    password_hash = hash_password(password)

    try:
        with transaction(conn):
            cur = conn.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active, created_at, created_by)
                VALUES (?, ?, ?, 1, ?, ?)
                """,
                (username, password_hash, role, utcnow(), created_by),
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError as exc:
        raise DuplicateUser(f"User '{username}' already exists.") from exc

    return get_user(conn, user_id)


def get_user(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise UserNotFound(f"No user with id {user_id}.")
    return row


def get_user_by_username(
    conn: sqlite3.Connection, username: str
) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
        ((username or "").strip(),),
    ).fetchone()


def list_users(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT id, username, role, is_active, created_at, created_by "
        "FROM users ORDER BY username COLLATE NOCASE"
    ).fetchall()


def update_user(
    conn: sqlite3.Connection,
    user_id: int,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
) -> sqlite3.Row:
    get_user(conn, user_id)

    fields = []
    params: List[object] = []

    if role is not None:
        _validate_role(role)
        fields.append("role = ?")
        params.append(role)

    if is_active is not None:
        fields.append("is_active = ?")
        params.append(1 if is_active else 0)

    if password is not None:
        fields.append("password_hash = ?")
        params.append(hash_password(password))

    if not fields:
        return get_user(conn, user_id)

    params.append(user_id)
    with transaction(conn):
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params)
        # A password change or deactivation must not leave live sessions behind.
        if password is not None or is_active is False:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))

    return get_user(conn, user_id)


def count_users(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]


def authenticate(
    conn: sqlite3.Connection, username: str, password: str
) -> Optional[sqlite3.Row]:
    """Return the user row on success, None on any failure.

    Callers must surface a single generic message for every None result so the
    response cannot be used to tell a bad username from a bad password.
    """
    user = get_user_by_username(conn, username)
    if user is None:
        _burn_time()
        return None
    if not user["is_active"]:
        _burn_time()
        return None
    if not verify_password(user["password_hash"], password):
        return None
    return user


# --------------------------------------------------------------------------
# sessions
# --------------------------------------------------------------------------

def session_hours() -> int:
    raw = os.environ.get("OFFLOAD_SESSION_HOURS")
    if not raw:
        return DEFAULT_SESSION_HOURS
    try:
        hours = int(raw)
    except ValueError:
        return DEFAULT_SESSION_HOURS
    return hours if hours > 0 else DEFAULT_SESSION_HOURS


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    """Create a session and return the raw token. It is never recoverable later."""
    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=session_hours())

    with transaction(conn):
        conn.execute(
            """
            INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                _hash_token(raw_token),
                user_id,
                now.isoformat(),
                expires.isoformat(),
                now.isoformat(),
            ),
        )
    return raw_token


def resolve_session(
    conn: sqlite3.Connection, raw_token: Optional[str]
) -> Optional[sqlite3.Row]:
    """Return the active user for a token, or None if absent/expired/inactive."""
    if not raw_token:
        return None

    token_hash = _hash_token(raw_token)
    row = conn.execute(
        """
        SELECT s.token_hash, s.expires_at, u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
        """,
        (token_hash,),
    ).fetchone()

    if row is None:
        return None

    now = datetime.now(timezone.utc)
    if _parse_iso(row["expires_at"]) <= now:
        with transaction(conn):
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        return None

    if not row["is_active"]:
        with transaction(conn):
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        return None

    with transaction(conn):
        conn.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
            (now.isoformat(), token_hash),
        )
    return row


def delete_session(conn: sqlite3.Connection, raw_token: Optional[str]) -> None:
    if not raw_token:
        return
    with transaction(conn):
        conn.execute(
            "DELETE FROM sessions WHERE token_hash = ?", (_hash_token(raw_token),)
        )


def purge_expired_sessions(conn: sqlite3.Connection) -> int:
    now = datetime.now(timezone.utc).isoformat()
    with transaction(conn):
        cur = conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    return cur.rowcount


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
