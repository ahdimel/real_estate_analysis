import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend.models.email_verification import EmailVerification
from backend.tests.conftest import TEST_USER

REGISTER_URL = "/auth/register"
VERIFY_URL = "/auth/verify"
LOGIN_URL = "/auth/login"
REFRESH_URL = "/auth/refresh"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_email():
    """Override conftest autouse fixture to expose mock for call assertions."""
    with patch("backend.routes.auth.send_verification_email") as m:
        yield m


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register_and_verify(client, get_code, user: dict = None) -> dict:
    """Full two-step registration. Returns the Token dict."""
    if user is None:
        user = TEST_USER
    res = client.post(REGISTER_URL, json=user)
    assert res.status_code == 202, res.json()
    code = get_code(user["email"])
    res2 = client.post(VERIFY_URL, json={"email": user["email"], "code": code})
    assert res2.status_code == 201, res2.json()
    return res2.json()


# ── /auth/register tests ──────────────────────────────────────────────────────

def test_register_sends_code(client, mock_email):
    res = client.post(REGISTER_URL, json=TEST_USER)
    assert res.status_code == 202
    mock_email.assert_called_once()


def test_register_duplicate_username(client, get_code):
    _register_and_verify(client, get_code)
    res = client.post(REGISTER_URL, json={**TEST_USER, "email": "other@example.com"})
    assert res.status_code == 400
    assert "username" in res.json()["detail"].lower()


def test_register_duplicate_email(client, get_code):
    _register_and_verify(client, get_code)
    res = client.post(REGISTER_URL, json={**TEST_USER, "username": "bob"})
    assert res.status_code == 400
    assert "email" in res.json()["detail"].lower()


def test_register_cooldown(client):
    client.post(REGISTER_URL, json=TEST_USER)
    res = client.post(REGISTER_URL, json=TEST_USER)
    assert res.status_code == 429
    assert "wait" in res.json()["detail"].lower()


# ── /auth/verify tests ────────────────────────────────────────────────────────

def test_verify_success_returns_token(client, get_code):
    token_data = _register_and_verify(client, get_code)
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"


def test_verify_wrong_code(client):
    client.post(REGISTER_URL, json=TEST_USER)
    res = client.post(VERIFY_URL, json={"email": TEST_USER["email"], "code": "000000"})
    assert res.status_code == 400
    assert "invalid" in res.json()["detail"].lower()


def test_verify_no_pending(client):
    res = client.post(VERIFY_URL, json={"email": "ghost@example.com", "code": "123456"})
    assert res.status_code == 400
    assert "no pending" in res.json()["detail"].lower()


def test_verify_expired_code(client):
    client.post(REGISTER_URL, json=TEST_USER)

    from backend.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    row = db.query(EmailVerification).filter(EmailVerification.email == TEST_USER["email"]).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    res = client.post(VERIFY_URL, json={"email": TEST_USER["email"], "code": row.code})
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_verify_deletes_pending_row(client, get_code):
    _register_and_verify(client, get_code)

    from backend.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    row = db.query(EmailVerification).filter(EmailVerification.email == TEST_USER["email"]).first()
    assert row is None


def test_user_cap_enforced(client, get_code):
    client.post(REGISTER_URL, json=TEST_USER)
    code = get_code(TEST_USER["email"])
    with patch("backend.routes.auth.USER_CAP", 0):
        res = client.post(VERIFY_URL, json={"email": TEST_USER["email"], "code": code})
    assert res.status_code == 403
    assert "limit" in res.json()["detail"].lower() or "closed" in res.json()["detail"].lower()


# ── /auth/login tests ─────────────────────────────────────────────────────────

def test_login_success(client, get_code):
    _register_and_verify(client, get_code)
    res = client.post(LOGIN_URL, json={"username": TEST_USER["username"], "password": TEST_USER["password"]})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, get_code):
    _register_and_verify(client, get_code)
    res = client.post(LOGIN_URL, json={"username": TEST_USER["username"], "password": "wrongpass"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post(LOGIN_URL, json={"username": "nobody", "password": "pass"})
    assert res.status_code == 401


# ── /auth/refresh tests ───────────────────────────────────────────────────────

def test_refresh_returns_valid_token(client, get_code):
    token = _register_and_verify(client, get_code)["access_token"]
    res = client.post(REFRESH_URL, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    # New token must be usable on a protected endpoint
    props = client.get("/properties", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert props.status_code == 200


def test_refresh_with_invalid_token_rejected(client):
    res = client.post(REFRESH_URL, headers={"Authorization": "Bearer not.a.real.token"})
    assert res.status_code == 401


def test_refresh_without_token_rejected(client):
    res = client.post(REFRESH_URL)
    assert res.status_code in (401, 403)


# ── M1 — enumeration regression ───────────────────────────────────────────────

def test_duplicate_credentials_return_same_message(client, get_code):
    """Duplicate username and duplicate email must return the identical detail string (prevents enumeration)."""
    _register_and_verify(client, get_code)
    res_username = client.post(REGISTER_URL, json={**TEST_USER, "email": "other@example.com"})
    res_email = client.post(REGISTER_URL, json={**TEST_USER, "username": "bob"})
    assert res_username.status_code == 400
    assert res_email.status_code == 400
    assert res_username.json()["detail"] == res_email.json()["detail"]


# ── L3 — username constraints ─────────────────────────────────────────────────

def test_username_too_short_rejected(client):
    res = client.post(REGISTER_URL, json={**TEST_USER, "username": "ab"})
    assert res.status_code == 422


def test_username_too_long_rejected(client):
    res = client.post(REGISTER_URL, json={**TEST_USER, "username": "a" * 33})
    assert res.status_code == 422


def test_username_invalid_chars_rejected(client):
    for bad in ("alice user", "alice$bob", "alice@bob", "alice.bob"):
        res = client.post(REGISTER_URL, json={**TEST_USER, "username": bad})
        assert res.status_code == 422, f"Expected 422 for username={bad!r}"


def test_username_valid_edge_cases_accepted(client):
    for username in ("abc", "alice_123", "alice-bob"):
        user = {**TEST_USER, "username": username, "email": f"{username}@example.com"}
        res = client.post(REGISTER_URL, json=user)
        assert res.status_code == 202, f"Expected 202 for username={username!r}"


def test_username_max_length_accepted(client):
    username = "a" * 32
    res = client.post(REGISTER_URL, json={**TEST_USER, "username": username, "email": "long@example.com"})
    assert res.status_code == 202
