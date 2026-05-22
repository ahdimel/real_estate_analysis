# REI — Real Estate Investment Analyzer

Web frontend for the REI app. Built with Next.js and Tailwind CSS.

## Local development

```bash
npm install
npm run dev
```

Runs on http://localhost:3000. Requires the backend to be running on http://localhost:8000.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |

For local development, set these in `.env.local` (gitignored).
