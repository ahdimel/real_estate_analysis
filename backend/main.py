import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes import auth, properties, analysis, market, scraper, reports

logger = logging.getLogger(__name__)

# Variables that must be present at startup. Missing any of these in production
# is a silent failure mode (empty SECRET_KEY produces forgeable JWTs; missing
# RESEND_API_KEY causes every registration to 500).
_REQUIRED_ENV_VARS = ["SECRET_KEY", "RESEND_API_KEY"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    missing = [v for v in _REQUIRED_ENV_VARS if not os.getenv(v)]
    if missing:
        raise RuntimeError(
            f"Required environment variables are not set: {', '.join(missing)}. "
            "Set them in .env (local) or Railway environment variables (prod)."
        )
    # In production (PostgreSQL), DATABASE_URL must be explicitly set.
    # Absence means the app would silently fall back to ephemeral SQLite and
    # lose all data on every deploy.
    db_url = os.getenv("DATABASE_URL", "")
    is_production = bool(os.getenv("RAILWAY_ENVIRONMENT"))
    if is_production and not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set in production. "
            "Link the PostgreSQL addon to the backend service in Railway."
        )
    if not db_url:
        logger.warning("DATABASE_URL not set — falling back to local SQLite.")
    logger.info("Environment validated. All required variables present.")
    yield


app = FastAPI(title="REIA API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(analysis.router)
app.include_router(market.router)
app.include_router(scraper.router)
app.include_router(reports.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "REIA API is running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """
    Liveness + schema check. Railway polls this — a 503 triggers a restart.
    Verifies both DB connectivity and that the core schema is in place so a
    misconfigured DB (e.g. missing DATABASE_URL) fails fast instead of
    silently serving an empty SQLite instance.
    """
    try:
        db.execute(text("SELECT 1 FROM users LIMIT 1"))
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable or schema missing")
    return {"status": "ok"}
