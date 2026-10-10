"""The models and the migrations must declare the same column types.

This exists because the same bug has now shipped twice:

  * id columns modelled as String(36) against a `uuid` column —
    "column is of type uuid but expression is of type character varying"
  * minutes_by_weekday modelled as Text against a `jsonb` column —
    "column is of type jsonb but expression is of type character varying"

Both passed the entire test suite, because the suite runs on SQLite, which
accepts a string into any column. Postgres does not. Nothing in a SQLite test
can catch it, so the check cannot be behavioural — it has to compare the two
declarations directly.

Postgres is only strict *across* type families. A VARCHAR(16) value goes into
a `text` column quite happily, so String(16) vs text is a legitimate pairing
and is not flagged; a varchar into `uuid` or `jsonb` is the error above. So
this compares families, not exact type names.

No database is required: the model types are compiled with the Postgres
dialect and the migrations are read as text.
"""

from __future__ import annotations

import pathlib
import re

import pytest
from sqlalchemy.dialects import postgresql

from app.models import Base

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[1] / "migrations"

# Types Postgres will implicitly accept from one another. Anything crossing
# these groups is the bug this module exists to catch.
FAMILIES: dict[str, str] = {
    "text": "text",
    "varchar": "text",
    "character varying": "text",
    "char": "text",
    "json": "json",
    "jsonb": "json",
    "uuid": "uuid",
    "int": "int",
    "int4": "int",
    "integer": "int",
    "bigint": "int",
    "smallint": "int",
    "boolean": "bool",
    "bool": "bool",
    "date": "date",
    "timestamptz": "timestamptz",
    "timestamp with time zone": "timestamptz",
    "timestamp": "timestamp",
    "numeric": "numeric",
}

# Table-level clauses that look like a column but are not one.
NOT_A_COLUMN = {"primary", "unique", "foreign", "constraint", "check", "exclude"}


def family(sql_type: str) -> str:
    """'VARCHAR(16)' -> 'text'. An unknown type returns itself, so a typo
    surfaces as a mismatch rather than silently passing."""
    bare = re.sub(r"\(.*?\)", "", sql_type).strip().lower()
    return FAMILIES.get(bare, bare)


def _column(fragment: str) -> dict[str, str]:
    parts = fragment.strip().split()
    if len(parts) < 2 or parts[0].lower() in NOT_A_COLUMN:
        return {}
    # `"group"` is quoted in the SQL because it is a reserved word; the model
    # knows it as plain `group`.
    return {parts[0].strip('"'): parts[1]}


def _split_top_level(body: str) -> list[str]:
    """Split on commas outside parentheses, so numeric(4,1) stays intact."""
    out: list[str] = []
    depth = 0
    current = ""
    for char in body:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            out.append(current)
            current = ""
        else:
            current += char
    out.append(current)
    return out


def parse_migrations() -> dict[str, dict[str, str]]:
    """table -> {column: declared type}, across every migration.

    Reading only 0001 would report a column added by a later migration as
    missing, so every file is concatenated in filename order — the order
    Postgres saw them — and both create-table and add-column are applied.
    """
    sql = ""
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        sql += path.read_text(encoding="utf-8") + "\n"
    # Strip comments so a '--' line inside a table body is not read as a column.
    sql = "\n".join(line.split("--")[0] for line in sql.splitlines())

    tables: dict[str, dict[str, str]] = {}

    for match in re.finditer(
        r"create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\((.*?)\n\s*\)\s*;",
        sql,
        re.IGNORECASE | re.DOTALL,
    ):
        name, body = match.group(1), match.group(2)
        columns: dict[str, str] = {}
        for fragment in _split_top_level(body):
            columns.update(_column(fragment))
        tables[name] = columns

    # alter table <t> add column [if not exists] <col> <type>, ...
    for match in re.finditer(
        r"alter\s+table\s+(\w+)\s+(add\s+column\b.*?)(?=;)",
        sql,
        re.IGNORECASE | re.DOTALL,
    ):
        table, body = match.group(1), match.group(2)
        for clause in _split_top_level(body):
            clause = re.sub(
                r"^\s*add\s+column\s+(?:if\s+not\s+exists\s+)?",
                "",
                clause,
                flags=re.IGNORECASE,
            )
            tables.setdefault(table, {}).update(_column(clause))

    return tables


MIGRATION_TABLES = parse_migrations()


def test_the_migrations_parsed_at_all() -> None:
    """Guards the parser itself: a regex that silently matched nothing would
    make every other test below vacuously pass."""
    assert len(MIGRATION_TABLES) >= 17, f"only parsed {sorted(MIGRATION_TABLES)}"
    assert MIGRATION_TABLES["schedules"]["minutes_by_weekday"] == "jsonb"
    assert MIGRATION_TABLES["users"]["id"] == "uuid"
    assert MIGRATION_TABLES["goals"]["group"] == "text", "quoted identifier not unwrapped"
    assert "code_hash" in MIGRATION_TABLES["parent_consents"], "0002 add-column not applied"


def test_families_catch_the_two_historical_bugs() -> None:
    """The regressions this module was written for, stated as the comparison
    it actually makes."""
    assert family("VARCHAR(36)") != family("uuid")
    assert family("TEXT") != family("jsonb")
    # ...while the legitimate pairing stays legitimate.
    assert family("VARCHAR(16)") == family("text")


@pytest.mark.parametrize("model", Base.__subclasses__(), ids=lambda m: m.__tablename__)
def test_model_columns_match_the_migration(model: type) -> None:
    table = model.__tablename__
    assert table in MIGRATION_TABLES, f"{table} is modelled but not in any migration"
    declared = MIGRATION_TABLES[table]

    mismatches = []
    for column in model.__table__.columns:
        if column.name not in declared:
            mismatches.append(f"{column.name}: modelled but absent from the migrations")
            continue
        model_type = column.type.compile(dialect=postgresql.dialect())
        if family(model_type) != family(declared[column.name]):
            mismatches.append(
                f"{column.name}: model says {model_type} "
                f"({family(model_type)}), migration says "
                f"{declared[column.name]} ({family(declared[column.name])})"
            )

    assert not mismatches, f"{table}:\n  " + "\n  ".join(mismatches)
