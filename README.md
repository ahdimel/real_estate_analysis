# REI — Real Estate Investment Analyzer

A web app for deterministic rental property investment analysis. Users can create accounts, save properties, scrape metadata from Zillow/Redfin URLs, and run rental investment analysis with exportable tables and charts.

## Prerequisites

- Python 3.13+
- Node.js 24+ (via nvm)

## Stack

- **Backend:** FastAPI (Python) on port 8000
- **Frontend:** Next.js on port 3000
- **Database:** SQLite (dev) → PostgreSQL (prod)

## Getting Started

### Backend

From the project root (`/REI`):

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies (first time only)
pip install -r backend/requirements.txt

# Start the server (with hot reload)
uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### Frontend

From `/REI/frontend`:

```bash
npm install   # first time only
npm run dev
```

App available at: http://localhost:3000

## Project Structure

```
REI/
├── venv/                  # Python virtual environment (not committed)
├── backend/
│   ├── main.py            # FastAPI app entry point
│   ├── requirements.txt
│   ├── models/            # SQLAlchemy database models
│   ├── routes/            # API route handlers
│   ├── analysis/          # Rental investment analysis logic
│   └── scraper/           # Zillow/Redfin scraper
└── frontend/
    ├── app/               # Next.js App Router pages
    └── components/        # Reusable UI components
```
