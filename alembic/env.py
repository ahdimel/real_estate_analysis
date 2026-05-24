import os
from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from alembic import context

# Import Base and all models so autogenerate can see the full schema.
# The noqa comments suppress "imported but unused" linter warnings — these
# imports are needed to populate Base.metadata, not to reference the symbols.
from backend.database import Base
import backend.models.user  # noqa: F401
import backend.models.property  # noqa: F401
import backend.models.settings  # noqa: F401
import backend.models.email_verification  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./rei.db")
    # Railway injects postgres:// but SQLAlchemy requires postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (used by some CI pipelines)."""
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Required for SQLite: ALTER TABLE is emulated via table recreation
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection (normal path)."""
    url = _get_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

    # NullPool avoids leaving open connections after migration; safe for a
    # short-lived migration process that exits immediately after.
    connectable = create_engine(url, connect_args=connect_args, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Required for SQLite: ALTER TABLE is emulated via table recreation
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
