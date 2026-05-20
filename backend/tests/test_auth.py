REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"

VALID_USER = {"username": "alice", "email": "alice@example.com", "password": "strongpass1"}


def test_register_success(client):
    res = client.post(REGISTER_URL, json=VALID_USER)
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "alice"
    assert data["email"] == "alice@example.com"
    assert "id" in data
    assert "password" not in data


def test_register_duplicate_username(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(REGISTER_URL, json={**VALID_USER, "email": "other@example.com"})
    assert res.status_code == 400
    assert "username" in res.json()["detail"].lower()


def test_register_duplicate_email(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(REGISTER_URL, json={**VALID_USER, "username": "bob"})
    assert res.status_code == 400
    assert "email" in res.json()["detail"].lower()


def test_login_success(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(LOGIN_URL, json={"username": "alice", "password": "strongpass1"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post(REGISTER_URL, json=VALID_USER)
    res = client.post(LOGIN_URL, json={"username": "alice", "password": "wrongpass"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post(LOGIN_URL, json={"username": "nobody", "password": "pass"})
    assert res.status_code == 401
