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

## Schema check before deploying

If this deploy adds new columns to the `Property` model (or any other model), you must decide whether the production DB needs a manual migration first.

**Check whether the production DB has been initialised at all:**
```bash
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -c "
import psycopg2
# Get DATABASE_PUBLIC_URL from: railway variables --service Postgres
url = 'PASTE_DATABASE_PUBLIC_URL_HERE'
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(\"SELECT tablename FROM pg_tables WHERE schemaname='public';\")
print(cur.fetchall())
conn.close()
"
```

- **Empty list `[]`** → DB is uninitialised. `create_tables()` will build the full current schema on first startup. No ALTER TABLE needed — just deploy.
- **Tables exist** → DB is live with real data. Any new column must be added via `ALTER TABLE` *before* deploying, or the backend will crash on startup.

### How to run ALTER TABLE on production

`railway run` does **not** inject `DATABASE_URL` into the local shell for this project. Use the public URL directly with the REI venv (which has `psycopg2-binary`):

```bash
# Step 1 — get the current public URL
railway variables --service Postgres
# Copy the value of DATABASE_PUBLIC_URL
```

```bash
# Step 2 — run the migration
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -c "
import psycopg2
url = 'postgresql://postgres:<password>@kodama.proxy.rlwy.net:12560/railway'
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
cur.execute('ALTER TABLE properties ADD COLUMN IF NOT EXISTS new_col TYPE NOT NULL DEFAULT value;')
print('Done:', cur.statusmessage)
conn.close()
"
```

`psql` is not installed locally — always use the psycopg2 approach above.

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
until curl -s -o /dev/null -w "%{http_code}" https://reianalyzer.online | grep -q "200"; do sleep 5; done
echo "Frontend up"
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

Then open https://reianalyzer.online and confirm the landing page loads.

---

## Known gotchas

- **Two `railway.toml` files**: root is backend, `frontend/railway.toml` is frontend. Railway uses whichever is in scope for the `railway up` command — don't merge or move them.
- **`requirements.txt` at root must stay in sync with `backend/requirements.txt`**: Railpack reads from the project root. If you add a backend dependency, update both files.
- **Dashboard-triggered redeploys have no code**: Railway dashboard "Redeploy" button uses the last uploaded bundle, not GitHub. Always use `railway up` for code changes.
- **`railway run` does not inject DATABASE_URL locally**: the PostgreSQL addon URL is only available inside Railway's network. To run SQL locally, fetch `DATABASE_PUBLIC_URL` from `railway variables --service Postgres` and connect directly with psycopg2.
- **psql is not installed locally**: use the REI venv's psycopg2 for any direct DB access (see schema check section above).
- **CORS**: if you add a new frontend domain, append it to `ALLOWED_ORIGINS` in the Railway backend env vars (comma-separated) and redeploy the backend. Current value: `https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online`
