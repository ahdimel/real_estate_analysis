from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.analysis.market import get_voo_cagr, refresh_voo_cagr

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/voo")
def voo_status(db: Session = Depends(get_db)):
    """Return the currently stored VOO rate (does not fetch)."""
    cagr, label = get_voo_cagr(db)
    return {"voo_cagr_pct": round(cagr * 100, 2), "voo_label": label}


@router.post("/voo/refresh")
def voo_refresh(db: Session = Depends(get_db)):
    """Force a fresh fetch from Yahoo Finance and overwrite the stored rate."""
    cagr, label = refresh_voo_cagr(db)
    return {"voo_cagr_pct": round(cagr * 100, 2), "voo_label": label}
