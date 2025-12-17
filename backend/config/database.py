"""
Database configuration helpers for Flask / SQLAlchemy.

This module keeps all database related environment parsing in one place so
that switching from the default SQLite file to Postgres can be done by only
changing environment variables.
"""

from __future__ import annotations

import os
from typing import Dict, Any
from pathlib import Path

from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BACKEND_ROOT / "instance" / "futures_link.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"


def normalize_database_url(database_url: str | None) -> str:
    """
    Normalise the DATABASE_URL so SQLAlchemy can understand it.

    - Falls back to the default SQLite file when unset.
    - Converts legacy Heroku style postgres:// URLs to explicit psycopg2 driver
      URIs that SQLAlchemy 2.x accepts without warnings.
    """
    if not database_url:
        volume_path = Path("/data")
        if volume_path.exists():
            return f"sqlite:///{volume_path / 'futures_link.db'}"
        return DEFAULT_SQLITE_URL

    cleaned = database_url.strip()
    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql+psycopg2://", 1)
    elif cleaned.startswith("postgresql://") and "+psycopg2" not in cleaned:
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg2://", 1)

    # For SQLite URLs without an absolute path, resolve them relative to the backend root
    try:
        url = make_url(cleaned)
        if url.drivername == "sqlite" and url.database and url.database != ":memory:":
            db_path = Path(url.database)
            if not db_path.is_absolute():
                resolved = BACKEND_ROOT / db_path
                cleaned = str(url.set(database=str(resolved)))
    except Exception:
        pass

    return cleaned


def _int_from_env(env_key: str, default: int) -> int:
    """Read an integer value from the environment with a safe fallback."""
    raw_value = os.getenv(env_key)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


def build_sqlalchemy_settings() -> Dict[str, Any]:
    """
    Assemble the SQLAlchemy configuration block for the Flask app.

    Returns a dictionary containing entries ready to merge into app.config:
      - SQLALCHEMY_DATABASE_URI
      - SQLALCHEMY_ENGINE_OPTIONS (only populated for server-style databases)
    """
    database_url = normalize_database_url(os.getenv("DATABASE_URL"))

    engine_options: Dict[str, Any] = {}

    # Only apply pool tuning for server databases (Postgres, MySQL, etc.).
    if database_url.startswith("postgresql"):
        engine_options = {
            "pool_pre_ping": os.getenv("DATABASE_POOL_PRE_PING", "true").lower()
            in {"1", "true", "yes"},
            "pool_recycle": _int_from_env("DATABASE_POOL_RECYCLE", 1800),
            "pool_timeout": _int_from_env("DATABASE_POOL_TIMEOUT", 30),
            "pool_size": _int_from_env("DATABASE_POOL_SIZE", 5),
            "max_overflow": _int_from_env("DATABASE_MAX_OVERFLOW", 10),
        }

    settings: Dict[str, Any] = {
        "SQLALCHEMY_DATABASE_URI": database_url,
    }

    try:
        url = make_url(database_url)
        if url.drivername == "sqlite" and url.database and url.database != ":memory:":
            db_path = Path(url.database)
            if not db_path.is_absolute():
                db_path = BACKEND_ROOT / db_path
                url = url.set(database=str(db_path))
                database_url = str(url)
                settings["SQLALCHEMY_DATABASE_URI"] = database_url
            db_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    if engine_options:
        settings["SQLALCHEMY_ENGINE_OPTIONS"] = engine_options

    return settings


def is_sqlite_url(database_url: str | None) -> bool:
    """Lightweight helper to check whether we are using an SQLite backend."""
    url = normalize_database_url(database_url)
    return url.startswith("sqlite:")



