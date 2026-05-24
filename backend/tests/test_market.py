from backend.analysis.market import MARKET_CAGR, MARKET_LABEL

MARKET_RATE_URL = "/market/rate"


def test_market_rate_returns_200(client):
    res = client.get(MARKET_RATE_URL)
    assert res.status_code == 200
    assert "market_cagr_pct" in res.json()
    assert "market_label" in res.json()


def test_market_rate_value(client):
    res = client.get(MARKET_RATE_URL)
    assert abs(res.json()["market_cagr_pct"] - round(MARKET_CAGR * 100, 2)) < 0.001
    assert res.json()["market_label"] == MARKET_LABEL


def test_market_rate_is_stable(client):
    r1 = client.get(MARKET_RATE_URL).json()
    r2 = client.get(MARKET_RATE_URL).json()
    assert r1 == r2
