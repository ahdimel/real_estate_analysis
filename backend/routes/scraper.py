from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/scraper", tags=["scraper"])


class ScrapeRequest(BaseModel):
    url: str


@router.post("/zillow")
def scrape_zillow_endpoint(payload: ScrapeRequest):
    from backend.scraper.zillow import scrape_zillow
    try:
        data = scrape_zillow(payload.url)
        return {"data": data}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")
