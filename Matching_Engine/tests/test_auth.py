from datetime import datetime, timedelta, timezone

import pytest

import auth
from auth import (
    DuplicateUser,
    InvalidRole,
    WeakPassword,
    authenticate,
    create_session,
    create_user,
    delete_session,
    get_user_by_username,
    hash_password,
    list_users,
    purge_expired_sessions,
    resolve_session,
    update_user,
    verify_password,
)
from db import transaction

GOOD_PASSWORD = "correct horse battery"


def test_hash_is_not_plaintext():
    hashed = hash_password(GOOD_PASSWORD)
    assert GOOD_PASSWORD not in hashed
    assert hashed.startswith("$argon2id$")


def test_verify_accepts_correct_and_rejects_wrong():
    hashed = hash_password(GOOD_PASSWORD)
    assert verify_password(hashed, GOOD_PASSWORD) is True
    assert verify_password(hashed, "wrong password") is False


def test_verify_rejects_garbage_hash():
    assert verify_password("not-a-hash", GOOD_PASSWORD) is False


def test_hashes_are_salted_per_call():
    assert hash_password(GOOD_PASSWORD) != hash_password(GOOD_PASSWORD)


@pytest.mark.parametrize("password", ["", "short", "1234567"])
def test_short_passwords_rejected(password):
    with pytest.raises(WeakPassword):
        hash_password(password)


def test_overlong_password_rejected():
    with pytest.raises(WeakPassword):
        hash_password("x" * 129)


def test_create_user_and_fetch(db):
    user = create_user(db, "Alice", GOOD_PASSWORD, "admin", created_by="seed")
    assert user["username"] == "Alice"
    assert user["role"] == "admin"
    assert user["is_active"] == 1
    assert user["password_hash"] != GOOD_PASSWORD


def test_username_lookup_is_case_insensitive(db):
    create_user(db, "Alice", GOOD_PASSWORD, "admin")
    assert get_user_by_username(db, "alice") is not None
    assert get_user_by_username(db, "ALICE") is not None


def test_duplicate_username_rejected(db):
    create_user(db, "alice", GOOD_PASSWORD, "admin")
    with pytest.raises(DuplicateUser):
        create_user(db, "ALICE", GOOD_PASSWORD, "reviewer")


def test_invalid_role_rejected(db):
    with pytest.raises(InvalidRole):
        create_user(db, "bob", GOOD_PASSWORD, "superuser")


def test_blank_username_rejected(db):
    with pytest.raises(auth.AuthError):
        create_user(db, "   ", GOOD_PASSWORD, "admin")


def test_authenticate_success_and_failure(db):
    create_user(db, "alice", GOOD_PASSWORD, "reviewer")
    assert authenticate(db, "alice", GOOD_PASSWORD) is not None
    assert authenticate(db, "alice", "nope") is None
    assert authenticate(db, "ghost", GOOD_PASSWORD) is None


def test_inactive_user_cannot_authenticate(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "reviewer")
    update_user(db, user["id"], is_active=False)
    assert authenticate(db, "alice", GOOD_PASSWORD) is None


def test_list_users_excludes_nothing_but_orders(db):
    create_user(db, "zoe", GOOD_PASSWORD, "reviewer")
    create_user(db, "adam", GOOD_PASSWORD, "admin")
    names = [u["username"] for u in list_users(db)]
    assert names == ["adam", "zoe"]


def test_update_user_changes_role_and_password(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "reviewer")
    updated = update_user(db, user["id"], role="admin", password="a new long password")
    assert updated["role"] == "admin"
    assert authenticate(db, "alice", "a new long password") is not None
    assert authenticate(db, "alice", GOOD_PASSWORD) is None


def test_update_user_rejects_weak_password(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "reviewer")
    with pytest.raises(WeakPassword):
        update_user(db, user["id"], password="short")


def test_session_roundtrip(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    resolved = resolve_session(db, token)
    assert resolved is not None
    assert resolved["username"] == "alice"
    assert resolved["role"] == "admin"


def test_raw_token_is_not_stored(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    stored = db.execute("SELECT token_hash FROM sessions").fetchone()["token_hash"]
    assert stored != token
    assert len(stored) == 64


def test_resolve_session_rejects_unknown_and_empty(db):
    assert resolve_session(db, None) is None
    assert resolve_session(db, "") is None
    assert resolve_session(db, "made-up-token") is None


def test_expired_session_is_rejected_and_purged(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    with transaction(db):
        db.execute("UPDATE sessions SET expires_at = ?", (past,))

    assert resolve_session(db, token) is None
    assert db.execute("SELECT COUNT(*) AS c FROM sessions").fetchone()["c"] == 0


def test_deactivating_user_kills_sessions(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    update_user(db, user["id"], is_active=False)
    assert resolve_session(db, token) is None


def test_password_change_kills_sessions(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    update_user(db, user["id"], password="another long password")
    assert resolve_session(db, token) is None


def test_delete_session_logs_out(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    token = create_session(db, user["id"])
    delete_session(db, token)
    assert resolve_session(db, token) is None


def test_purge_expired_sessions_counts(db):
    user = create_user(db, "alice", GOOD_PASSWORD, "admin")
    create_session(db, user["id"])
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    with transaction(db):
        db.execute("UPDATE sessions SET expires_at = ?", (past,))
    assert purge_expired_sessions(db) == 1


def test_session_hours_env_override(monkeypatch):
    monkeypatch.setenv("OFFLOAD_SESSION_HOURS", "12")
    assert auth.session_hours() == 12
    monkeypatch.setenv("OFFLOAD_SESSION_HOURS", "garbage")
    assert auth.session_hours() == auth.DEFAULT_SESSION_HOURS
    monkeypatch.setenv("OFFLOAD_SESSION_HOURS", "0")
    assert auth.session_hours() == auth.DEFAULT_SESSION_HOURS
