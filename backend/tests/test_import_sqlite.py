import sqlite3

import pytest

from app.db.import_sqlite import backup_sqlite, import_database, order_tables


def test_backup_and_dry_run_preserve_source(tmp_path):
    source = tmp_path / "legacy.sqlite"
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE users (id TEXT PRIMARY KEY, firebase_uid TEXT NOT NULL)")
        db.execute("INSERT INTO users VALUES ('a', 'firebase-a')")
    backup = tmp_path / "backup.sqlite"
    report = import_database(source, backup)
    assert report["source_counts"] == {"users": 1}
    assert len(report["backup_sha256"]) == 64
    with sqlite3.connect(source) as db:
        assert db.execute("SELECT firebase_uid FROM users").fetchone()[0] == "firebase-a"
    with sqlite3.connect(backup) as db:
        assert db.execute("SELECT firebase_uid FROM users").fetchone()[0] == "firebase-a"
    with pytest.raises(FileExistsError):
        backup_sqlite(source, backup)


def test_table_order_respects_foreign_keys():
    with sqlite3.connect(":memory:") as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
        db.execute("CREATE TABLE projects (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id))")
        db.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id))")
        assert order_tables(db, {"tasks", "users", "projects"}) == ["users", "projects", "tasks"]
