"""Conservative, repeatable import of a legacy DayLoop SQLite database.

Only tables whose names and columns match the migrated PostgreSQL schema are
accepted. The source is backed up first and is never modified. Conflicting
PostgreSQL rows are never overwritten.
"""

import argparse
import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

from psycopg import connect, sql
from psycopg.rows import dict_row

from app.core.config import get_settings


def backup_sqlite(source: Path, backup: Path) -> str:
    if source.resolve() == backup.resolve():
        raise ValueError("Backup path must differ from source path")
    if backup.exists():
        raise FileExistsError(f"Backup already exists: {backup}")
    backup.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True) as original:
        if original.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity check failed")
        if original.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise ValueError("SQLite foreign key check failed")
        with sqlite3.connect(backup) as copy:
            original.backup(copy)
    digest = hashlib.sha256()
    with backup.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(connection: sqlite3.Connection) -> dict[str, int]:
    tables = [name for (name,) in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]
    if any(not re.fullmatch(r"[a-z][a-z0-9_]*", name) for name in tables):
        raise ValueError("SQLite contains an unsupported table name")
    return {name: connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0] for name in tables}


def order_tables(connection: sqlite3.Connection, names: set[str]) -> list[str]:
    dependencies = {name: {row[2] for row in connection.execute(f'PRAGMA foreign_key_list("{name}")')
                           if row[2] in names and row[2] != name} for name in names}
    ordered: list[str] = []
    while dependencies:
        ready = sorted(name for name, deps in dependencies.items() if not deps)
        if not ready:
            raise ValueError(f"Cross-table foreign key cycle: {sorted(dependencies)}")
        ordered.extend(ready)
        for name in ready:
            del dependencies[name]
        for deps in dependencies.values():
            deps.difference_update(ready)
    return ordered


def import_database(source: Path, backup: Path, *, apply: bool = False) -> dict:
    if not source.is_file():
        raise FileNotFoundError(source)
    backup_hash = backup_sqlite(source, backup)
    with sqlite3.connect(f"file:{backup.as_posix()}?mode=ro", uri=True) as sqlite:
        sqlite.row_factory = sqlite3.Row
        counts = inventory(sqlite)
        report = {"backup": str(backup), "backup_sha256": backup_hash, "source_counts": counts}
        if not apply:
            return report
        if get_settings()["app_env"] != "staging":
            raise ValueError("Import requires DAYLOOP_ENV=staging; production cutover needs separate verification")
        with connect(get_settings()["database_url"], row_factory=dict_row) as postgres:
            with postgres.transaction():
                pg_columns = defaultdict(dict)
                for row in postgres.execute(
                    "SELECT table_name,column_name,data_type FROM information_schema.columns "
                    "WHERE table_schema='public'"
                ):
                    pg_columns[row["table_name"]][row["column_name"]] = row["data_type"]
                excluded = {"schema_migrations", "sync_change_log"}
                names = set(counts) - excluded
                unknown = names - set(pg_columns)
                if unknown:
                    raise ValueError(f"No PostgreSQL table for SQLite tables: {sorted(unknown)}")
                imported = {}
                for table in order_tables(sqlite, names):
                    source_columns = [row[1] for row in sqlite.execute(f'PRAGMA table_info("{table}")')]
                    missing = set(source_columns) - set(pg_columns[table])
                    if missing:
                        raise ValueError(f"{table}: source columns absent in PostgreSQL: {sorted(missing)}")
                    identifiers = sql.SQL(",").join(map(sql.Identifier, source_columns))
                    statement = sql.SQL("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT DO NOTHING").format(
                        sql.Identifier(table), identifiers,
                        sql.SQL(",").join(sql.Placeholder() for _ in source_columns),
                    )
                    inserted = 0
                    for row in sqlite.execute(f'SELECT * FROM "{table}"'):
                        values = []
                        for column in source_columns:
                            value = row[column]
                            kind = pg_columns[table][column]
                            if value is not None and kind == "boolean":
                                value = bool(value)
                            elif value is not None and kind in ("json", "jsonb"):
                                value = json.loads(value) if isinstance(value, str) else value
                                value = json.dumps(value)
                            values.append(value)
                        inserted += postgres.execute(statement, values).rowcount
                    if inserted != counts[table]:
                        raise ValueError(f"{table}: inserted {inserted}/{counts[table]}; destination already has conflicting or previously imported rows. Transaction rolled back.")
                    verified = postgres.execute(
                        sql.SQL("SELECT COUNT(*) AS count FROM {}").format(sql.Identifier(table))
                    ).fetchone()["count"]
                    if verified < counts[table]:
                        raise ValueError(f"{table}: PostgreSQL count {verified} is below source count {counts[table]}")
                    imported[table] = inserted
                if "users" in names and "firebase_uid" in pg_columns["users"]:
                    source_uids = {row[0] for row in sqlite.execute("SELECT firebase_uid FROM users")}
                    destination_uids = {row["firebase_uid"] for row in postgres.execute(
                        "SELECT firebase_uid FROM users WHERE firebase_uid = ANY(%s)",
                        (list(source_uids),),
                    )} if source_uids else set()
                    if source_uids != destination_uids:
                        raise ValueError("Firebase UID verification failed; transaction rolled back")
                    report["verified_firebase_uids"] = len(source_uids)
                report["imported_counts"] = imported
        return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("backup", type=Path)
    parser.add_argument("--apply", action="store_true", help="Import into a staging PostgreSQL database")
    args = parser.parse_args()
    print(json.dumps(import_database(args.source, args.backup, apply=args.apply), indent=2))


if __name__ == "__main__":
    main()
