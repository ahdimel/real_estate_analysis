import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MARKET_CAGR_KEY  = "market_cagr"
MARKET_LABEL_KEY = "market_label"
WINDOW_YEARS     = 50
TICKER           = "^GSPC"
FALLBACK_CAGR    = 0.0898   # S&P 500 50-year historical average
FALLBACK_LABEL   = f"S&P 500 {WINDOW_YEARS}-yr avg (~8.98%/yr) [fallback]"


def get_market_cagr(db: Session) -> tuple[float, str]:
    """
    Returns (cagr_decimal, label) from the database.
    Fetches from Yahoo Finance and stores permanently on first call.
    Never re-fetches automatically — call refresh_market_cagr() to update.
    """
    from backend.models.settings import AppSetting

    cagr_row  = db.query(AppSetting).filter(AppSetting.key == MARKET_CAGR_KEY).first()
    label_row = db.query(AppSetting).filter(AppSetting.key == MARKET_LABEL_KEY).first()

    if cagr_row and label_row:
        return float(cagr_row.value), label_row.value

    cagr, label = _fetch_from_yahoo()
    _upsert(db, MARKET_CAGR_KEY, str(cagr))
    _upsert(db, MARKET_LABEL_KEY, label)
    db.commit()
    return cagr, label


def refresh_market_cagr(db: Session) -> tuple[float, str]:
    """Force a fresh fetch from Yahoo Finance and overwrite the stored values."""
    cagr, label = _fetch_from_yahoo()
    _upsert(db, MARKET_CAGR_KEY, str(cagr))
    _upsert(db, MARKET_LABEL_KEY, label)
    db.commit()
    return cagr, label


def _fetch_from_yahoo() -> tuple[float, str]:
    try:
        import yfinance as yf

        start = datetime.today() - timedelta(days=WINDOW_YEARS * 365.25)
        hist  = yf.Ticker(TICKER).history(start=start.strftime("%Y-%m-%d"))

        if hist.empty or len(hist) < 2:
            raise ValueError("Empty history returned")

        start_price  = float(hist["Close"].iloc[0])
        end_price    = float(hist["Close"].iloc[-1])
        actual_years = (hist.index[-1] - hist.index[0]).days / 365.25
        cagr         = (end_price / start_price) ** (1 / actual_years) - 1

        start_str = hist.index[0].strftime("%b %Y")
        end_str   = hist.index[-1].strftime("%b %Y")
        label     = f"S&P 500 {start_str}–{end_str} CAGR ({cagr * 100:.2f}%/yr)"
        return cagr, label

    except Exception:
        logger.exception("Yahoo Finance fetch failed for %s; using fallback CAGR", TICKER)
        return FALLBACK_CAGR, FALLBACK_LABEL


def _upsert(db: Session, key: str, value: str) -> None:
    from backend.models.settings import AppSetting

    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
