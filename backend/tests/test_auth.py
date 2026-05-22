import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend.models.email_verification import EmailVerification

REGISTER_URL = "/auth/register"
VERIFY_URL = "/auth/verify"
LOGIN_URL = "/auth/login"

VALID_USER = {"username": "alice", "email": "alice@example.com", "password": "strongpass1"}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_email():
    """Prevent any real email from being sent during tests."""
    with patch("backend.routes.auth.send_verification_email") as m:
        yield m


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_code(client, email: str) -> str:
    """Read the pending verification code straight from the test DB."""
    from backend.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    row = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    assert row is not None, f"No pending verification found for {email}"
    return row.code


def _register_and_verify(client, user: dict = None) -> dict:
    """Full two-step registration. Returns the Token dict."""
    if user is None:
        user = VALID_USER
    res = client.post(REGISTER_URL, json=user)
    assert res.status_code == 202, res.json()
    code = _get_code(client, user["email"])
    res2 = client.post(VERIFY_URL, json={"email": user["email"], "code": code})
    assert res2.status_code == 201, res2.json()
    return res2.json()


# ── /auth/register tests ──────────────────────────────────────────────────────

def test_register_sends_code(client, mock_email):
    res = client.post(REGISTER_URL, json=VALID_USER)
    assert res.status_code == 202
    mock_email.assert_called_once()


def test_register_duplicate_username(client):
    _register_and_verify(client)
    res = client.post(REGISTER_URL, json={**VALID_USER, "email": "other@example.com"})
    assert res.status_code == 400
    assert "username" in res.json()["detail"].lower()


def test_register_duplicate_email(client):
    _register_and_verify(client)
    res = client.post(REGISTER_URL, json={**VALID_USER, "username": "bob"})
    assert res.status_code == 400
    assert "email" in res.json()["detail"].lower()


def test_register_cooldown(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(REGISTER_URL, json=VALID_USER)
    assert res.status_code == 429
    assert "wait" in res.json()["detail"].lower()


# ── /auth/verify tests ────────────────────────────────────────────────────────

def test_verify_success_returns_token(client):
    token_data = _register_and_verify(client)
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"


def test_verify_wrong_code(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(VERIFY_URL, json={"email": VALID_USER["email"], "code": "000000"})
    assert res.status_code == 400
    assert "invalid" in res.json()["detail"].lower()


def test_verify_no_pending(client):
    res = client.post(VERIFY_URL, json={"email": "ghost@example.com", "code": "123456"})
    assert res.status_code == 400
    assert "no pending" in res.json()["detail"].lower()


def test_verify_expired_code(client):
    client.post(REGISTER_URL, json=VALID_USER)

    from backend.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    row = db.query(EmailVerification).filter(EmailVerification.email == VALID_USER["email"]).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    res = client.post(VERIFY_URL, json={"email": VALID_USER["email"], "code": row.code})
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_verify_deletes_pending_row(client):
    _register_and_verify(client)

    from backend.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    row = db.query(EmailVerification).filter(EmailVerification.email == VALID_USER["email"]).first()
    assert row is None


def test_user_cap_enforced(client):
    client.post(REGISTER_URL, json=VALID_USER)
    code = _get_code(client, VALID_USER["email"])
    with patch("backend.routes.auth.USER_CAP", 0):
        res = client.post(VERIFY_URL, json={"email": VALID_USER["email"], "code": code})
    assert res.status_code == 403
    assert "limit" in res.json()["detail"].lower() or "closed" in res.json()["detail"].lower()


# ── /auth/login tests ─────────────────────────────────────────────────────────

def test_login_success(client):
    _register_and_verify(client)
    res = client.post(LOGIN_URL, json={"username": "alice", "password": "strongpass1"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    _register_and_verify(client)
    res = client.post(LOGIN_URL, json={"username": "alice", "password": "wrongpass"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post(LOGIN_URL, json={"username": "nobody", "password": "pass"})
    assert res.status_code == 401
