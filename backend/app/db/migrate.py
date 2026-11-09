from pathlib import Path

from app.core.database import get_connection


def apply_migrations() -> list[str]:
    migration_dir = Path(__file__).resolve().parents[2] / "migrations"
    applied: list[str] = []
    with get_connection() as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        known = {
            row["version"]
            for row in connection.execute("SELECT version FROM schema_migrations").fetchall()
        }
        for migration in sorted(migration_dir.glob("*.sql")):
            if migration.name in known:
                continue
            connection.execute(migration.read_text(encoding="utf-8"))
            connection.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)", (migration.name,)
            )
            applied.append(migration.name)
    return applied


if __name__ == "__main__":
    print({"applied": apply_migrations()})
