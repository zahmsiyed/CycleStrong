# CycleStrong – Expo (React Native) + FastAPI + Postgres (starter)

This repo is a starter skeleton for an iOS-first MVP:
- **Mobile:** Expo / React Native (TypeScript)
- **Backend:** Python FastAPI
- **DB:** Postgres (via Docker)

## Prereqs
- Node.js 18+
- Docker Desktop
- Python 3.11+
- (Recommended) Poetry: https://python-poetry.org/

## Quickstart (local)

### 1) Start Postgres
```bash
docker compose up -d db
```

### 2) Start backend (FastAPI)
```bash
cd apps/backend
cp .env.example .env
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

Backend health check:
- GET http://localhost:8000/health

### 3) Start mobile (Expo)
```bash
cd apps/mobile
npm install
npm run start
```

Update the API base URL if needed:
- `apps/mobile/src/services/api.ts`

## Repo layout
- `apps/mobile` – Expo app
- `apps/backend` – FastAPI app
- `.vscode` – VS Code defaults (extensions + settings)
- `docker-compose.yml` – Postgres service

## Next steps you can add
- Auth (Supabase, Clerk, or custom JWT)
- Migrations (Alembic) + SQLAlchemy models
- Offline-first workout logging (SQLite on device) + sync endpoints
- RevenueCat billing, analytics (PostHog/Amplitude), crash reporting (Sentry)

