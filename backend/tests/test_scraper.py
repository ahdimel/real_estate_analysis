from unittest.mock import MagicMock, patch

from backend.scraper.zillow import scrape_zillow


# ── L4 — ScraperAPI key must not appear in URL params ─────────────────────────

def test_scraperapi_key_sent_as_header_not_query_param():
    """Regression: ScraperAPI key must appear in X-Api-Key header, never in URL params."""
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
            assert "api_key" not in params, "API key must not appear as a URL query parameter"
            assert headers.get("X-Api-Key") == "fake-key-for-test", "API key must be passed as X-Api-Key header"
