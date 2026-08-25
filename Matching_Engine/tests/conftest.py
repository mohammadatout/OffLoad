import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_connection, init_db  # noqa: E402


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test_offload.db")


@pytest.fixture
def db(db_path):
    conn = get_connection(db_path)
    init_db(conn)
    yield conn
    conn.close()
