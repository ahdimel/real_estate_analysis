---
description: Deploy backend and/or frontend to Railway production
---

# Deploy REI Analyzer to Production

## Before deploying

**Run the test suite from the repo root. All tests must pass.**
```bash
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -m pytest backend/tests/
```
Do not deploy if any tests fail.

**Confirm Railway CLI is authenticated:**
```bash
railway whoami
```
If not logged in: `railway login`

---

## Deploy backend

Run from the repo root `/Users/ahdimel/Documents/vscode/REI`.

```bash
railway service backend
railway up
```

**Verify backend health after deploy:**
```bash
curl -s https://backend-production-8eb7.up.railway.app/health
```
Expected: `{"status":"ok"}`. If it fails, check Railway dashboard logs for the backend service.

---

## Deploy frontend

Run from the repo root.

```bash
railway service frontend
railway up ./frontend --path-as-root
```

**Verify frontend after deploy:**
```bash
curl -s -o /dev/null -w "%{http_code}" https://reianalyzer.online
```
Expected: `200`.

---

## Post-deploy smoke checks

```bash
# Backend health
curl -s https://backend-production-8eb7.up.railway.app/health

# Mortgage rate endpoint (confirms DB + external fetch works)
curl -s https://backend-production-8eb7.up.railway.app/market/mortgage-rate

# Market CAGR (confirms app_settings cache)
curl -s https://backend-production-8eb7.up.railway.app/market/rate
```

Then open https://reianalyzer.online and confirm the landing page loads and "Backend API: ok" is shown.

---

## Known gotchas

- **Two `railway.toml` files**: root is backend, `frontend/railway.toml` is frontend. Railway uses whichever is in scope for the `railway up` command — don't merge or move them.
- **`requirements.txt` at root must stay in sync with `backend/requirements.txt`**: Railpack reads from the project root. If you add a backend dependency, update both files.
- **Dashboard-triggered redeploys have no code**: Railway dashboard "Redeploy" button uses the last uploaded bundle, not GitHub. Always use `railway up` for code changes.
- **Schema changes in production**: no Alembic. Connect to Railway PostgreSQL and run `ALTER TABLE` manually. There is no migration tooling.
- **CORS**: if you add a new frontend domain, append it to `ALLOWED_ORIGINS` in the Railway backend env vars (comma-separated) and redeploy the backend. Current value: `https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online`
