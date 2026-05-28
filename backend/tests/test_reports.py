import pytest
from backend.tests.conftest import TEST_USER
from backend.routes.reports import CREDIT_LIMIT


def _make_property(client, token, valid_property):
    res = client.post("/properties", json=valid_property, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    return res.json()["id"]


def _generate(client, token, property_id):
    return client.post(
        f"/properties/{property_id}/analysis",
        headers={"Authorization": f"Bearer {token}"},
    )


# ── Generation ────────────────────────────────────────────────────────────────

def test_generate_report_success(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    res = _generate(client, auth_token, pid)
    assert res.status_code == 200
    body = res.json()
    assert body["remaining"] == CREDIT_LIMIT - 1
    report = body["report"]
    assert len(report["public_id"]) == 8
    assert report["public_id"].isalnum()
    assert report["property_id"] == pid
    assert "snapshot" in report
    assert "property" in report["snapshot"]
    assert "analysis" in report["snapshot"]


def test_generate_decrements_remaining(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    r1 = _generate(client, auth_token, pid).json()
    r2 = _generate(client, auth_token, pid).json()
    assert r1["remaining"] == CREDIT_LIMIT - 1
    assert r2["remaining"] == CREDIT_LIMIT - 2


def test_generate_wrong_owner(client, auth_token, get_code, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post("/auth/register", json=bob)
    token_b = client.post(
        "/auth/verify", json={"email": bob["email"], "code": get_code(bob["email"])}
    ).json()["access_token"]
    res = client.post(f"/properties/{pid}/analysis", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code == 404


def test_generate_nonexistent_property(client, auth_token):
    res = _generate(client, auth_token, 99999)
    assert res.status_code == 404


def test_generate_enforces_lifetime_limit(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    for _ in range(CREDIT_LIMIT):
        res = _generate(client, auth_token, pid)
        assert res.status_code == 200
    res = _generate(client, auth_token, pid)
    assert res.status_code == 429


# ── Listing ───────────────────────────────────────────────────────────────────

def test_list_reports_empty(client, auth_token):
    res = client.get("/reports", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    assert res.json() == []


def test_list_reports_returns_all(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    _generate(client, auth_token, pid)
    _generate(client, auth_token, pid)
    res = client.get("/reports", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_property_reports(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    _generate(client, auth_token, pid)
    res = client.get(f"/properties/{pid}/reports", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["property_id"] == pid


def test_list_reports_isolated_between_users(client, auth_token, get_code, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    _generate(client, auth_token, pid)

    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post("/auth/register", json=bob)
    token_b = client.post(
        "/auth/verify", json={"email": bob["email"], "code": get_code(bob["email"])}
    ).json()["access_token"]

    res = client.get("/reports", headers={"Authorization": f"Bearer {token_b}"})
    assert res.json() == []


# ── Count endpoint ────────────────────────────────────────────────────────────

def test_report_count(client, auth_token, valid_property):
    res = client.get("/reports/count", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    assert res.json() == {"used": 0, "limit": CREDIT_LIMIT, "remaining": CREDIT_LIMIT}

    pid = _make_property(client, auth_token, valid_property)
    _generate(client, auth_token, pid)

    res = client.get("/reports/count", headers={"Authorization": f"Bearer {auth_token}"})
    data = res.json()
    assert data["used"] == 1
    assert data["remaining"] == CREDIT_LIMIT - 1


# ── Re-download (GET /reports/{public_id}) ────────────────────────────────────

def test_get_report_by_public_id(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    public_id = _generate(client, auth_token, pid).json()["report"]["public_id"]

    res = client.get(f"/reports/{public_id}", headers={"Authorization": f"Bearer {auth_token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["public_id"] == public_id
    assert "snapshot" in body


def test_get_report_wrong_owner(client, auth_token, get_code, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    public_id = _generate(client, auth_token, pid).json()["report"]["public_id"]

    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post("/auth/register", json=bob)
    token_b = client.post(
        "/auth/verify", json={"email": bob["email"], "code": get_code(bob["email"])}
    ).json()["access_token"]

    res = client.get(f"/reports/{public_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code == 404


def test_get_report_unauthenticated(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    public_id = _generate(client, auth_token, pid).json()["report"]["public_id"]
    res = client.get(f"/reports/{public_id}")
    assert res.status_code == 401


def test_report_public_ids_are_unique(client, auth_token, valid_property):
    pid = _make_property(client, auth_token, valid_property)
    ids = [_generate(client, auth_token, pid).json()["report"]["public_id"] for _ in range(5)]
    assert len(set(ids)) == 5
