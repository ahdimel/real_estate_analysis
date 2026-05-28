import json
import os
import re

import requests as std_requests
from curl_cffi import requests as cffi_requests
from dotenv import load_dotenv

load_dotenv()

SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

HOME_TYPE_MAP = {
    "SINGLE_FAMILY": "single_family",
    "CONDO": "condo",
    "APARTMENT": "condo",
    "TOWNHOUSE": "townhouse",
    "MULTI_FAMILY": "multi_family",
    "MANUFACTURED": "single_family",
}


def _parse_garage(reso: dict) -> str:
    capacity = int(reso.get("garageParkingCapacity") or 0)
    has_carport = int(reso.get("carportParkingCapacity") or 0) > 0
    if capacity >= 1:
        return str(min(capacity, 4))
    if has_carport:
        return "carport"
    return "none"


def _merge_cache(cache: dict) -> dict:
    """Merge all property dicts across cache entries (Zillow splits data across keys)."""
    merged: dict = {}
    for v in cache.values():
        if isinstance(v, dict) and "property" in v:
            merged.update(v["property"])
    return merged


def scrape_zillow(url: str) -> dict:
    """
    Fetch a Zillow listing and return a dict of form-ready field values.
    Only includes fields that were actually found; missing fields are omitted.
    Raises ValueError on fetch failure or if property data cannot be located.
    """
    if SCRAPER_API_KEY:
        # Production: route through ScraperAPI residential proxies
        r = std_requests.get(
            "https://api.scraperapi.com",
            params={"url": url},
            headers={"X-Api-Key": SCRAPER_API_KEY},
            timeout=60,
        )
    else:
        # Local dev: spoof browser TLS fingerprint directly
        r = cffi_requests.get(url, impersonate="chrome124", headers=HEADERS, timeout=20)

    if r.status_code == 403:
        raise ValueError("Zillow blocked this request. URL scraping works when running the app locally. Please fill in the form manually.")
    if r.status_code != 200:
        raise ValueError(f"Zillow returned HTTP {r.status_code}")

    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        r.text,
        re.DOTALL,
    )
    if not match:
        raise ValueError("Could not locate property data in the page. Zillow may have changed their layout.")

    data = json.loads(match.group(1))

    try:
        cache_raw = data["props"]["pageProps"]["componentProps"]["gdpClientCache"]
    except KeyError:
        raise ValueError("Unexpected Zillow page structure.")

    cache = json.loads(cache_raw) if isinstance(cache_raw, str) else cache_raw
    prop = _merge_cache(cache)

    if not prop:
        raise ValueError("No property data found in page.")

    result: dict = {}

    # --- Address ---
    addr = prop.get("address") or {}
    for our_key, zillow_key in [
        ("address_street", "streetAddress"),
        ("address_city", "city"),
        ("address_state", "state"),
        ("address_zip", "zipcode"),
    ]:
        val = addr.get(zillow_key) or prop.get(zillow_key)
        if val:
            result[our_key] = val

    # --- Property details ---
    if prop.get("bedrooms") is not None:
        result["bedrooms"] = int(prop["bedrooms"])
    if prop.get("bathrooms") is not None:
        result["bathrooms"] = int(prop["bathrooms"])
    if prop.get("livingArea"):
        result["square_feet"] = int(prop["livingArea"])
    if prop.get("yearBuilt"):
        result["year_built"] = int(prop["yearBuilt"])

    home_type = HOME_TYPE_MAP.get(prop.get("homeType") or "")
    if home_type:
        result["property_type"] = home_type

    reso = prop.get("resoFacts") or {}
    result["garage"] = _parse_garage(reso)

    # --- MLS / identifiers ---
    if prop.get("mlsid"):
        result["mls_id"] = str(prop["mlsid"])

    # --- Financials ---
    if prop.get("price"):
        result["purchase_price"] = float(prop["price"])

    # Property tax: Zillow gives a rate (percent) — multiply by price
    tax_rate = prop.get("propertyTaxRate")
    price = prop.get("price")
    if tax_rate and price:
        result["property_tax_annual"] = round(float(price) * float(tax_rate) / 100, 2)

    # HOA: Zillow shows monthly — convert to annual
    hoa = prop.get("hoaFee") or reso.get("hoaFee")
    if hoa:
        result["hoa_annual"] = round(float(hoa) * 12, 2)

    # Rent estimate: use Zestimate as both bounds (user can adjust)
    if prop.get("rentZestimate"):
        rent = float(prop["rentZestimate"])
        result["rent_lower"] = rent
        result["rent_upper"] = rent

    return result
