from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

RATE_KEY = "mortgage_rate_30yr"
FETCHED_AT_KEY = "mortgage_rate_fetched_at"
TTL_DAYS = 7
FALLBACK_RATE = 6.51
CSV_URL = "https://www.freddiemac.com/pmms/docs/PMMS_history.csv"


def get_mortgage_rate(db: Session) -> tuple[float, str]:
    from backend.models.settings import AppSetting

    rate_row = db.query(AppSetting).filter(AppSetting.key == RATE_KEY).first()
    fetched_row = db.query(AppSetting).filter(AppSetting.key == FETCHED_AT_KEY).first()

    if rate_row and fetched_row:
        fetched_at = datetime.fromisoformat(fetched_row.value)
        if datetime.now(timezone.utc) - fetched_at < timedelta(days=TTL_DAYS):
            rate = float(rate_row.value)
            return rate, _label(rate)

    return _fetch_and_store(db)


def _fetch_and_store(db: Session) -> tuple[float, str]:
    rate = _fetch_from_freddie_mac()
    _upsert(db, RATE_KEY, str(rate))
    _upsert(db, FETCHED_AT_KEY, datetime.now(timezone.utc).isoformat())
    db.commit()
    return rate, _label(rate)


def _fetch_from_freddie_mac() -> float:
    try:
        import requests

        resp = requests.get(CSV_URL, timeout=10)
        resp.raise_for_status()
        lines = [line for line in resp.text.strip().splitlines() if line.strip()]
        last = lines[-1]
        rate = float(last.split(",")[1].strip().strip('"'))
        if not (2.0 <= rate <= 20.0):
            raise ValueError(f"Rate out of plausible range: {rate}")
        return rate
    except Exception:
        return FALLBACK_RATE


def _label(rate: float) -> str:
    return f"Freddie Mac weekly avg: {rate:.2f}%"


def _upsert(db: Session, key: str, value: str) -> None:
    from backend.models.settings import AppSetting

    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
