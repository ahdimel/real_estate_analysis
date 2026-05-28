from backend.analysis.market import MARKET_CAGR, MARKET_LABEL

MARKET_RATE_URL = "/market/rate"
MORTGAGE_RATE_URL = "/market/mortgage-rate"


# ── /market/rate ──────────────────────────────────────────────────────────────

def test_market_rate_requires_auth(client):
    res = client.get(MARKET_RATE_URL)
    assert res.status_code in (401, 403)


def test_market_rate_returns_200(client, auth_token):
    res = client.get(MARKET_RATE_URL, headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    assert "market_cagr_pct" in res.json()
    assert "market_label" in res.json()


def test_market_rate_value(client, auth_token):
    res = client.get(MARKET_RATE_URL, headers={"Authorization": f"Bearer {auth_token}"})
    assert abs(res.json()["market_cagr_pct"] - round(MARKET_CAGR * 100, 2)) < 0.001
    assert res.json()["market_label"] == MARKET_LABEL


def test_market_rate_is_stable(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    r1 = client.get(MARKET_RATE_URL, headers=headers).json()
    r2 = client.get(MARKET_RATE_URL, headers=headers).json()
    assert r1 == r2


# ── /market/mortgage-rate ─────────────────────────────────────────────────────

def test_mortgage_rate_requires_auth(client):
    res = client.get(MORTGAGE_RATE_URL)
    assert res.status_code in (401, 403)


def test_mortgage_rate_returns_expected_fields(client, auth_token, monkeypatch):
    from backend.analysis import mortgage_rate as mr
    monkeypatch.setattr(mr, "_fetch_from_freddie_mac", lambda: (7.00, False))

    res = client.get(MORTGAGE_RATE_URL, headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "rate_pct" in data
    assert "label" in data
    assert "is_stale" in data
    assert data["is_stale"] is False


def test_mortgage_rate_is_stale_when_fetch_fails(client, auth_token, monkeypatch):
    from backend.analysis import mortgage_rate as mr
    monkeypatch.setattr(mr, "_fetch_from_freddie_mac", lambda: (mr.FALLBACK_RATE, True))

    res = client.get(MORTGAGE_RATE_URL, headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_stale"] is True
    assert data["rate_pct"] == mr.FALLBACK_RATE
    assert "estimated" in data["label"]
