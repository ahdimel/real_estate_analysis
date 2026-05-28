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

**Confirm DATABASE_URL is set in the backend service** (critical — absence = ephemeral SQLite, data loss on every deploy):
```bash
railway variables --service backend | grep DATABASE_URL
```
If missing, add it in the Railway dashboard → backend service → Variables:
```
DATABASE_URL=postgresql://postgres:<password>@postgres.railway.internal:5432/railway
```
Get the password from `railway variables --service Postgres | grep PGPASSWORD`.

---

## ONE-TIME: Stamp the existing production DB (first Alembic-aware deploy only)

**This step is only needed once** — the very first time you deploy after Alembic was added,
and ONLY if the DB already has the schema in place (created by a prior `create_all()` call or
manual SQL). Without it, `alembic upgrade head` will attempt to CREATE TABLE on tables that
already exist and crash before the app starts.

> **WARNING**: `alembic stamp` records a version number WITHOUT running any migration SQL.
> If you stamp an **empty** DB, Alembic will think the initial schema is already applied and
> skip creating `users`, `properties`, etc. Only stamp a DB that already has the correct tables.
> If the DB is empty, do NOT stamp — just run `alembic upgrade head` directly and it will
> create everything from scratch.

After this stamp, every future deploy runs migrations automatically via the Procfile.
You will never need to run this again.

**Step 1 — get the current public URL:**
```bash
railway variables --service Postgres
# Copy the value of DATABASE_PUBLIC_URL
```

**Step 2 — stamp the existing schema as the initial migration:**
```bash
DATABASE_URL="postgresql://postgres:<password>@kodama.proxy.rlwy.net:12560/railway" \
  /Users/ahdimel/Documents/vscode/REI/venv/bin/python -m alembic stamp head
```

Expected output: `INFO [alembic.runtime.migration] Running stamp_revision  -> 417e7440062a`

Verify the stamp landed:
```bash
DATABASE_URL="postgresql://postgres:<password>@kodama.proxy.rlwy.net:12560/railway" \
  /Users/ahdimel/Documents/vscode/REI/venv/bin/python -m alembic current
```
Expected: `417e7440062a (head)`

---

## Adding new columns (all future schema changes)

Create a migration file — never hand-write ALTER TABLE SQL again:
```bash
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -m alembic revision --autogenerate -m "describe_change"
```
Review the generated file in `alembic/versions/`, then deploy. The Procfile runs
`alembic upgrade head` before starting uvicorn, so migrations apply automatically on startup.

**For columns with NOT NULL and no default:** add the column as nullable first, backfill,
then tighten to NOT NULL in a second migration — otherwise `alembic upgrade head` will fail
on rows that already exist.

---

## Bumping the version (optional, before deploying)

The version displayed in the footer comes from two places — update both together:
1. `"version"` field in `frontend/package.json` (e.g. `"0.2.0"` → `"0.3.0"`)
2. `BUILD_DATE` constant in `frontend/components/Footer.tsx`

---

## Deploy backend

Run from the repo root `/Users/ahdimel/Documents/vscode/REI`.

```bash
railway service backend
railway up
```

**Verify backend health after deploy:**
```bash
until curl -s https://backend-production-8eb7.up.railway.app/health | grep -q '"ok"'; do sleep 5; done
curl -s https://backend-production-8eb7.up.railway.app/health
```
Expected: `{"status":"ok"}`. A 503 means the DB is unreachable — check Railway dashboard logs.
If it fails, check Railway dashboard logs for the backend service.

---

## Deploy frontend

Run from the repo root.

```bash
railway service frontend
railway up ./frontend --path-as-root
```

**Verify frontend after deploy:**
```bash
until curl -s -o /dev/null -w "%{http_code}" https://reianalyzer.online | grep -q "200"; do sleep 5; done
echo "Frontend up"
```
Expected: `200`.

---

## Post-deploy smoke checks

```bash
# Backend health (also confirms DB connectivity)
curl -s https://backend-production-8eb7.up.railway.app/health

# Mortgage rate endpoint (confirms DB + external fetch works)
curl -s https://backend-production-8eb7.up.railway.app/market/mortgage-rate

# Market CAGR (confirms app_settings cache)
curl -s https://backend-production-8eb7.up.railway.app/market/rate

# Reports count endpoint (confirms reports table migrated correctly — expects 401, not 500)
curl -s -o /dev/null -w "%{http_code}" https://backend-production-8eb7.up.railway.app/reports/count
# Expected: 401 (unauthenticated). A 500 means the reports table is missing.
```

Then open https://reianalyzer.online and confirm the landing page loads.

---

## Known gotchas

- **Two `railway.toml` files**: root is backend, `frontend/railway.toml` is frontend. Railway uses whichever is in scope for the `railway up` command — don't merge or move them.
- **`requirements.txt` at root must stay in sync with `backend/requirements.txt`**: Railpack reads from the project root. If you add a backend dependency, update both files.
- **Dashboard-triggered redeploys have no code**: Railway dashboard "Redeploy" button uses the last uploaded bundle, not GitHub. Always use `railway up` for code changes.
- **`railway run` does not inject DATABASE_URL locally**: the PostgreSQL addon URL is only available inside Railway's network. To run SQL or Alembic locally, fetch `DATABASE_PUBLIC_URL` from `railway variables --service Postgres` and set it as `DATABASE_URL` in the command prefix.
- **psql is not installed locally**: use the REI venv's `alembic` or `psycopg2` for any direct DB access.
- **CORS**: if you add a new frontend domain, append it to `ALLOWED_ORIGINS` in the Railway backend env vars (comma-separated) and redeploy the backend. Current value: `https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online`
