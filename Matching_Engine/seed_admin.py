"""
Create the first admin account.

Reads credentials from the environment so no password is ever written into
source or shell history in this file:

    set OFFLOAD_ADMIN_USER=your.name
    set OFFLOAD_ADMIN_PASSWORD=<a strong password>
    python seed_admin.py

Exits non-zero if either variable is missing, if the password is too weak, or
if the user already exists.
"""

import os
import sys

from auth import DuplicateUser, WeakPassword, create_user
from db import IncompatibleSchema, get_connection, init_db


def main() -> int:
    username = os.environ.get("OFFLOAD_ADMIN_USER", "").strip()
    password = os.environ.get("OFFLOAD_ADMIN_PASSWORD", "")

    if not username or not password:
        print(
            "ERROR: set OFFLOAD_ADMIN_USER and OFFLOAD_ADMIN_PASSWORD before running.",
            file=sys.stderr,
        )
        return 2

    conn = get_connection()
    try:
        try:
            init_db(conn)
        except IncompatibleSchema as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 5

        try:
            user = create_user(conn, username, password, "admin", created_by="seed")
        except DuplicateUser:
            print(f"ERROR: user '{username}' already exists.", file=sys.stderr)
            return 3
        except WeakPassword as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 4

        print(f"Created admin '{user['username']}' (id {user['id']}).")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
