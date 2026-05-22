from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./rei.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def create_tables():
    from backend.models.user import User  # pyright: ignore[reportUnusedImport]
    from backend.models.property import Property  # pyright: ignore[reportUnusedImport]
    from backend.models.settings import AppSetting  # pyright: ignore[reportUnusedImport]
    from backend.models.email_verification import EmailVerification  # pyright: ignore[reportUnusedImport]
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
