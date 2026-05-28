import os

# Set required env vars before importing the app so the lifespan validation
# passes. Values are dummies — email is globally mocked, JWTs only need a
# non-empty key for signing/verification to work in tests.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("RESEND_API_KEY", "re_test_placeholder")

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Shared user for auth fixtures — import this in test modules instead of redefining
TEST_USER = {"username": "alice", "email": "alice@example.com", "password": "strongpass1"}

# Single source of truth for the property payload used across test modules
_VALID_PROPERTY_DATA = {
    "address_street": "123 Main St",
    "address_city": "Austin",
    "address_state": "TX",
    "address_zip": "78701",
    "property_type": "single_family",
    "bedrooms": 3,
    "bathrooms": 2,
    "garage": "2",
    "square_feet": 1800,
    "purchase_price": 450000.00,
    "annual_interest_rate": 6.75,
    "mortgage_term": 30,
    "down_payment": 20.00,      # percentage: 20%
    "closing_costs": 9000.00,
    "rent_lower": 2200.00,
    "rent_upper": 2500.00,
    "property_tax_annual": 7200.00,
    "hoa_annual": 0.00,
    "property_management_annual": 3000.00,
    "vacancy_days_annual": 18,
    "maintenance_annual": 2500.00,
    "insurance_annual": 1800.00,
    "rent_increase_pct": 3.0,
    "maintenance_increase_pct": 2.5,
    "appreciation_rate_pct": 4.0,
    "property_tax_increase_pct": 2.0,
    "insurance_increase_pct": 4.0,
}


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(setup_test_db):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state.limiter.enabled = False
    with TestClient(app) as c:
        yield c
    app.state.limiter.enabled = True
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def mock_email():
    """Suppress outbound email for all tests. test_auth.py overrides this locally to inspect the mock."""
    with patch("backend.routes.auth.send_verification_email"):
        yield


@pytest.fixture
def valid_property():
    """Return a fresh copy of the standard valid property payload."""
    return dict(_VALID_PROPERTY_DATA)


@pytest.fixture
def get_code(client):
    """Return a helper that fetches the pending verification code for an email from the test DB."""
    from backend.models.email_verification import EmailVerification

    def _inner(email: str) -> str:
        db = next(client.app.dependency_overrides[get_db]())
        row = db.query(EmailVerification).filter(EmailVerification.email == email).first()
        assert row is not None, f"No pending verification found for {email}"
        return row.code

    return _inner


@pytest.fixture
def auth_token(client, get_code):
    """Register and verify alice, returning her JWT access token."""
    client.post("/auth/register", json=TEST_USER)
    code = get_code(TEST_USER["email"])
    data = client.post("/auth/verify", json={"email": TEST_USER["email"], "code": code}).json()
    return data["access_token"]
