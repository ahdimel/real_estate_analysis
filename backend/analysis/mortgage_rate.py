import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from backend.models.settings import upsert_setting

logger = logging.getLogger(__name__)

RATE_KEY = "mortgage_rate_30yr"
FETCHED_AT_KEY = "mortgage_rate_fetched_at"
IS_FALLBACK_KEY = "mortgage_rate_is_fallback"
TTL_DAYS = 7
FALLBACK_RATE = 6.51
CSV_URL = "https://www.freddiemac.com/pmms/docs/PMMS_history.csv"


def get_mortgage_rate(db: Session) -> tuple[float, str, bool]:
    from backend.models.settings import AppSetting

    rate_row = db.query(AppSetting).filter(AppSetting.key == RATE_KEY).first()
    fetched_row = db.query(AppSetting).filter(AppSetting.key == FETCHED_AT_KEY).first()
    fallback_row = db.query(AppSetting).filter(AppSetting.key == IS_FALLBACK_KEY).first()

    if rate_row and fetched_row:
        fetched_at = datetime.fromisoformat(fetched_row.value)
        if datetime.now(timezone.utc) - fetched_at < timedelta(days=TTL_DAYS):
            rate = float(rate_row.value)
            is_stale = fallback_row is not None and fallback_row.value == "true"
            return rate, _label(rate, is_stale), is_stale

    return _fetch_and_store(db)


def _fetch_and_store(db: Session) -> tuple[float, str, bool]:
    rate, is_fallback = _fetch_from_freddie_mac()
    upsert_setting(db, RATE_KEY, str(rate))
    upsert_setting(db, FETCHED_AT_KEY, datetime.now(timezone.utc).isoformat())
    upsert_setting(db, IS_FALLBACK_KEY, "true" if is_fallback else "false")
    db.commit()
    return rate, _label(rate, is_fallback), is_fallback


def _fetch_from_freddie_mac() -> tuple[float, bool]:
    try:
        import requests

        resp = requests.get(CSV_URL, timeout=10)
        resp.raise_for_status()
        lines = [line for line in resp.text.strip().splitlines() if line.strip()]
        last = lines[-1]
        rate = float(last.split(",")[1].strip().strip('"'))
        if not (2.0 <= rate <= 20.0):
            raise ValueError(f"Rate out of plausible range: {rate}")
        return rate, False
    except Exception:
        logger.exception("Freddie Mac rate fetch failed; using fallback rate")
        return FALLBACK_RATE, True


def _label(rate: float, is_stale: bool = False) -> str:
    suffix = " (estimated — live data unavailable)" if is_stale else ""
    return f"Freddie Mac weekly avg: {rate:.2f}%{suffix}"
