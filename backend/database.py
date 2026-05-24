import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rei.db")

# Railway injects postgres:// but SQLAlchemy requires postgresql://
if _DATABASE_URL.startswith("postgres://"):
    _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)

# check_same_thread is SQLite-only
_connect_args = {"check_same_thread": False} if _DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(_DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
