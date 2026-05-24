import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes import auth, properties, analysis, market, scraper

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
    logger.info("Environment validated. All required variables present.")
    yield


app = FastAPI(title="REI API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(analysis.router)
app.include_router(market.router)
app.include_router(scraper.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "REI API is running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """
    Shallow liveness + DB connectivity check.
    Railway uses this path for its healthcheck — a 503 here triggers a restart.
    """
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check DB ping failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}
