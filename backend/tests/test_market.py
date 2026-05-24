from unittest.mock import patch
from backend.analysis.market import FALLBACK_CAGR, FALLBACK_LABEL

MARKET_RATE_URL = "/market/rate"
MARKET_REFRESH_URL = "/market/rate/refresh"


def test_market_rate_returns_200(client):
    with patch("backend.analysis.market._fetch_from_yahoo", return_value=(FALLBACK_CAGR, FALLBACK_LABEL)):
        res = client.get(MARKET_RATE_URL)
    assert res.status_code == 200
    assert "market_cagr_pct" in res.json()
    assert "market_label" in res.json()


def test_market_rate_uses_fallback_on_empty_db(client):
    # Empty test DB → get_market_cagr calls _fetch_from_yahoo → returns fallback
    with patch("backend.analysis.market._fetch_from_yahoo", return_value=(FALLBACK_CAGR, FALLBACK_LABEL)):
        res = client.get(MARKET_RATE_URL)
    expected_pct = round(FALLBACK_CAGR * 100, 2)
    assert abs(res.json()["market_cagr_pct"] - expected_pct) < 0.01
    assert res.json()["market_label"] == FALLBACK_LABEL


def test_market_rate_cached_after_first_call(client):
    # Second GET should not trigger another Yahoo Finance fetch
    with patch("backend.analysis.market._fetch_from_yahoo", return_value=(FALLBACK_CAGR, FALLBACK_LABEL)) as mock_fetch:
        client.get(MARKET_RATE_URL)
        client.get(MARKET_RATE_URL)
    assert mock_fetch.call_count == 1


def test_market_refresh_overwrites_cached_rate(client):
    initial = (0.07, "initial label")
    updated = (0.11, "updated label")

    with patch("backend.analysis.market._fetch_from_yahoo", return_value=initial):
        client.get(MARKET_RATE_URL)  # prime the cache

    with patch("backend.analysis.market._fetch_from_yahoo", return_value=updated):
        res = client.post(MARKET_REFRESH_URL)

    assert res.status_code == 200
    assert abs(res.json()["market_cagr_pct"] - 11.0) < 0.01
    assert res.json()["market_label"] == "updated label"


def test_market_rate_subsequent_get_reflects_refresh(client):
    # After a refresh, a subsequent GET should return the new value (still cached)
    initial = (0.07, "initial label")
    updated = (0.11, "updated label")

    with patch("backend.analysis.market._fetch_from_yahoo", return_value=initial):
        client.get(MARKET_RATE_URL)

    with patch("backend.analysis.market._fetch_from_yahoo", return_value=updated):
        client.post(MARKET_REFRESH_URL)

    # No patch here — should read from DB cache, not hit Yahoo
    res = client.get(MARKET_RATE_URL)
    assert abs(res.json()["market_cagr_pct"] - 11.0) < 0.01
