from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.analysis.market import get_market_cagr
from backend.analysis.mortgage_rate import get_mortgage_rate

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/rate")
def market_rate_status():
    cagr, label = get_market_cagr()
    return {"market_cagr_pct": round(cagr * 100, 2), "market_label": label}


@router.get("/mortgage-rate")
def mortgage_rate(db: Session = Depends(get_db)):
    """Return the current 30-yr fixed mortgage rate (Freddie Mac PMMS, cached 7 days)."""
    rate, label = get_mortgage_rate(db)
    return {"rate_pct": rate, "label": label}
