from sqlalchemy.orm import Session

VOO_CAGR_KEY = "voo_cagr"
VOO_LABEL_KEY = "voo_label"
VOO_INCEPTION = "2010-09-09"
FALLBACK_CAGR = 0.105
FALLBACK_LABEL = "S&P 500 long-term avg (~10.5%/yr) [fallback]"


def get_voo_cagr(db: Session) -> tuple[float, str]:
    """
    Returns (cagr_decimal, label) from the database.
    Fetches from Yahoo Finance and stores permanently on first call.
    Never re-fetches automatically — call refresh_voo_cagr() to update.
    """
    from backend.models.settings import AppSetting

    cagr_row = db.query(AppSetting).filter(AppSetting.key == VOO_CAGR_KEY).first()
    label_row = db.query(AppSetting).filter(AppSetting.key == VOO_LABEL_KEY).first()

    if cagr_row and label_row:
        return float(cagr_row.value), label_row.value

    cagr, label = _fetch_from_yahoo()
    _upsert(db, VOO_CAGR_KEY, str(cagr))
    _upsert(db, VOO_LABEL_KEY, label)
    db.commit()
    return cagr, label


def refresh_voo_cagr(db: Session) -> tuple[float, str]:
    """Force a fresh fetch from Yahoo Finance and overwrite the stored values."""
    cagr, label = _fetch_from_yahoo()
    _upsert(db, VOO_CAGR_KEY, str(cagr))
    _upsert(db, VOO_LABEL_KEY, label)
    db.commit()
    return cagr, label


def _fetch_from_yahoo() -> tuple[float, str]:
    try:
        import yfinance as yf

        hist = yf.Ticker("VOO").history(start=VOO_INCEPTION)
        if hist.empty or len(hist) < 2:
            raise ValueError("Empty history returned")

        start_price = float(hist["Close"].iloc[0])
        end_price = float(hist["Close"].iloc[-1])
        years = (hist.index[-1] - hist.index[0]).days / 365.25
        cagr = (end_price / start_price) ** (1 / years) - 1

        start_str = hist.index[0].strftime("%b %Y")
        end_str = hist.index[-1].strftime("%b %Y")
        label = f"VOO {start_str}–{end_str} CAGR ({cagr * 100:.1f}%/yr)"
        return cagr, label

    except Exception:
        return FALLBACK_CAGR, FALLBACK_LABEL


def _upsert(db: Session, key: str, value: str) -> None:
    from backend.models.settings import AppSetting

    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
