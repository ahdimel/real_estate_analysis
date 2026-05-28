REGISTER_URL = "/auth/register"
VERIFY_URL = "/auth/verify"
PROPS_URL = "/properties"


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- CRUD ---

def test_create_property(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token))
    assert res.status_code == 201
    data = res.json()
    assert data["address_street"] == "123 Main St"
    assert data["purchase_price"] == 450000.0
    assert data["down_payment"] == 20.0
    assert "id" in data


def test_list_properties(client, auth_token, valid_property):
    client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token))
    client.post(PROPS_URL, json={**valid_property, "address_street": "456 Oak Ave"}, headers=auth_headers(auth_token))
    res = client.get(PROPS_URL, headers=auth_headers(auth_token))
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_only_returns_own_properties(client, auth_token, valid_property, get_code):
    client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token))

    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post(REGISTER_URL, json=bob)
    token_b = client.post(VERIFY_URL, json={"email": bob["email"], "code": get_code(bob["email"])}).json()["access_token"]
    client.post(PROPS_URL, json={**valid_property, "address_street": "999 Other St"}, headers=auth_headers(token_b))

    res = client.get(PROPS_URL, headers=auth_headers(auth_token))
    assert len(res.json()) == 1
    assert res.json()[0]["address_street"] == "123 Main St"


def test_get_property(client, auth_token, valid_property):
    created = client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token)).json()
    res = client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(auth_token))
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


def test_get_nonexistent_property_returns_404(client, auth_token):
    res = client.get(f"{PROPS_URL}/99999", headers=auth_headers(auth_token))
    assert res.status_code == 404


def test_update_property(client, auth_token, valid_property):
    created = client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token)).json()
    updated = {**valid_property, "address_street": "999 New Rd", "purchase_price": 500000.00}
    res = client.put(f"{PROPS_URL}/{created['id']}", json=updated, headers=auth_headers(auth_token))
    assert res.status_code == 200
    assert res.json()["address_street"] == "999 New Rd"
    assert res.json()["purchase_price"] == 500000.0


def test_delete_property(client, auth_token, valid_property):
    created = client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token)).json()
    res = client.delete(f"{PROPS_URL}/{created['id']}", headers=auth_headers(auth_token))
    assert res.status_code == 204
    res = client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(auth_token))
    assert res.status_code == 404


def test_delete_nonexistent_property_returns_404(client, auth_token):
    res = client.delete(f"{PROPS_URL}/99999", headers=auth_headers(auth_token))
    assert res.status_code == 404


# --- Auth / ownership ---

def test_unauthenticated_request_rejected(client):
    res = client.get(PROPS_URL)
    assert res.status_code in (401, 403)


def test_cannot_access_other_users_property(client, auth_token, valid_property, get_code):
    created = client.post(PROPS_URL, json=valid_property, headers=auth_headers(auth_token)).json()

    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post(REGISTER_URL, json=bob)
    token_b = client.post(VERIFY_URL, json={"email": bob["email"], "code": get_code(bob["email"])}).json()["access_token"]

    assert client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token_b)).status_code == 404
    assert client.put(f"{PROPS_URL}/{created['id']}", json=valid_property, headers=auth_headers(token_b)).status_code == 404
    assert client.delete(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token_b)).status_code == 404


# --- Field validation ---

def test_down_payment_over_100_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "down_payment": 101.0}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_down_payment_100_percent_accepted(client, auth_token, valid_property):
    # Cash purchase: 100% down is valid
    res = client.post(PROPS_URL, json={**valid_property, "down_payment": 100.0}, headers=auth_headers(auth_token))
    assert res.status_code == 201


def test_property_limit_enforced(client, auth_token, valid_property):
    for i in range(10):
        res = client.post(PROPS_URL, json={**valid_property, "address_street": f"{i} Main St"}, headers=auth_headers(auth_token))
        assert res.status_code == 201
    res = client.post(PROPS_URL, json={**valid_property, "address_street": "11 Over St"}, headers=auth_headers(auth_token))
    assert res.status_code == 400
    assert "limit" in res.json()["detail"].lower()


def test_invalid_rent_range(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "rent_lower": 3000.00, "rent_upper": 2000.00}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_equal_rent_bounds_accepted(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "rent_lower": 2500.00, "rent_upper": 2500.00}, headers=auth_headers(auth_token))
    assert res.status_code == 201


def test_bedrooms_out_of_range_rejected(client, auth_token, valid_property):
    assert client.post(PROPS_URL, json={**valid_property, "bedrooms": 0}, headers=auth_headers(auth_token)).status_code == 422
    assert client.post(PROPS_URL, json={**valid_property, "bedrooms": 21}, headers=auth_headers(auth_token)).status_code == 422


def test_mortgage_term_zero_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "mortgage_term": 0}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_non_standard_mortgage_term_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "mortgage_term": 7}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_standard_mortgage_terms_accepted(client, auth_token, valid_property):
    for term in (10, 15, 20, 30):
        res = client.post(PROPS_URL, json={**valid_property, "mortgage_term": term, "address_street": f"{term}yr St"}, headers=auth_headers(auth_token))
        assert res.status_code == 201, f"mortgage_term={term} should be accepted"


def test_zero_interest_rate_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "annual_interest_rate": 0.0}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_invalid_property_type_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "property_type": "castle"}, headers=auth_headers(auth_token))
    assert res.status_code == 422


def test_invalid_garage_value_rejected(client, auth_token, valid_property):
    res = client.post(PROPS_URL, json={**valid_property, "garage": "5"}, headers=auth_headers(auth_token))
    assert res.status_code == 422


# ── M5 — URL scheme validation ────────────────────────────────────────────────

import pytest

@pytest.mark.parametrize("field", ["source_url", "property_tax_url"])
def test_javascript_uri_in_url_field_rejected(client, auth_token, valid_property, field):
    res = client.post(PROPS_URL, json={**valid_property, field: "javascript:alert(1)"}, headers=auth_headers(auth_token))
    assert res.status_code == 422


@pytest.mark.parametrize("field", ["source_url", "property_tax_url"])
def test_non_http_scheme_in_url_field_rejected(client, auth_token, valid_property, field):
    res = client.post(PROPS_URL, json={**valid_property, field: "ftp://example.com/taxes"}, headers=auth_headers(auth_token))
    assert res.status_code == 422


@pytest.mark.parametrize("field,url", [
    ("source_url", "https://www.zillow.com/homedetails/test/"),
    ("source_url", "http://example.com/listing"),
    ("property_tax_url", "https://county.gov/property-tax/123"),
])
def test_valid_http_url_in_url_field_accepted(client, auth_token, valid_property, field, url):
    res = client.post(PROPS_URL, json={**valid_property, field: url}, headers=auth_headers(auth_token))
    assert res.status_code == 201
