from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.limiter import limiter
from backend.models.user import User

router = APIRouter(prefix="/scraper", tags=["scraper"])

_ALLOWED_ZILLOW_HOSTS = {"www.zillow.com", "zillow.com"}


def _validate_zillow_url(url: str) -> None:
    """Reject anything that isn't a plain https://zillow.com listing URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid URL.")
    if parsed.scheme != "https":
        raise HTTPException(status_code=422, detail="Only https:// Zillow URLs are accepted.")
    if parsed.netloc.lower() not in _ALLOWED_ZILLOW_HOSTS:
        raise HTTPException(status_code=422, detail="URL must be a zillow.com listing.")


class ScrapeRequest(BaseModel):
    url: str


@router.post("/zillow")
@limiter.limit("5/minute")
def scrape_zillow_endpoint(
    request: Request,
    payload: ScrapeRequest,
    _current_user: User = Depends(get_current_user),
):
    _validate_zillow_url(payload.url)
    from backend.scraper.zillow import scrape_zillow
    try:
        data = scrape_zillow(payload.url)
        return {"data": data}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Scrape failed. Please try again or fill in the form manually.")
