from unittest.mock import MagicMock, patch

from backend.scraper.zillow import scrape_zillow


# ScraperAPI's proxy endpoint only accepts api_key as a query parameter.
# Header auth (X-Api-Key) is not supported and causes 404 for all requests.

def test_scraperapi_key_sent_as_query_param():
    """Regression: ScraperAPI key must be in the api_key query param, not a header."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = ""

    with patch("backend.scraper.zillow.SCRAPER_API_KEY", "fake-key-for-test"):
        with patch("backend.scraper.zillow.std_requests.get") as mock_get:
            mock_get.return_value = mock_resp
            try:
                scrape_zillow("https://www.zillow.com/homedetails/123/")
            except ValueError:
                pass  # parse failure is expected — we only care about the outbound call

            mock_get.assert_called_once()
            _, kwargs = mock_get.call_args
            params = kwargs.get("params", {})
            headers = kwargs.get("headers", {})
            assert params.get("api_key") == "fake-key-for-test", "API key must be in api_key query param"
            assert "X-Api-Key" not in headers, "API key must not appear in X-Api-Key header (ScraperAPI ignores it)"
