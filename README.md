# MadWits CRM

CRM for a single retail printing, stationery, and graphic-design shop.

## Current phase

Phase 8 — Next.js frontend against the accepted FastAPI backend.

## Prerequisites

- Docker and Docker Compose
- A copied environment file (never commit `.env`)

```bash
cp .env.example .env
```

Change `POSTGRES_PASSWORD` and `JWT_SECRET` before using anything other than a local disposable environment.

## Start services

```bash
docker compose up -d --build
```

- Web UI: http://localhost:3000
- API: http://localhost:8000
- Health: http://localhost:8000/health
- Database readiness: http://localhost:8000/health/ready
- OpenAPI: http://localhost:8000/docs

## Logs

```bash
docker compose logs -f api
docker compose logs -f postgres
```

## Migrations

Apply schema migrations (does not reset data):

```bash
docker compose exec api alembic upgrade head
docker compose exec api alembic current
```

## Tests

```bash
docker compose exec api pytest
```

## Stop without deleting data

```bash
docker compose down
```

PostgreSQL is reachable from the API container on host `postgres`. It is not published to the host by default, so a local PostgreSQL installation can keep port 5432. Data is stored in the named Docker volume `madweb_crm_postgres_data`.

To remove containers **and** the volume (destroys data):

```bash
docker compose down -v
```

Do not use that command against a database you need to keep.

## Initial Admin

There is no default Admin password. After migrations, create the first Admin:

```bash
docker compose exec api python -m app.cli create-admin \
  --username owner \
  --display-name "Shop Owner" \
  --password 'choose-a-strong-password'
```

The command fails if an Admin already exists. Create the shared shop-floor Staff account afterwards by logging in as Admin and calling `POST /api/v1/users`. Shop-floor STAFF sessions cannot access staff-management endpoints.

## Frontend (local, without the web Docker service)

The Next.js app lives in `web/`. It talks to FastAPI through a server-side BFF proxy and stores the JWT in an httpOnly cookie. The browser never receives the access token.

```bash
cp web/.env.example web/.env.local
cd web
npm install
npm run dev
```

Open http://localhost:3000. The API must already be running on http://127.0.0.1:8000 (or set `API_INTERNAL_URL` in `web/.env.local`).

```bash
cd web
npm test
npm run build
```

`API_INTERNAL_URL` is a server-only origin. Do not put JWT secrets or database passwords in frontend environment variables.

Logout deletes the browser cookie and calls `POST /api/v1/auth/logout`. That does not revoke a JWT server-side; the token remains valid until it expires.

## Stack

- Python 3.12
- FastAPI
- PostgreSQL 16
- SQLAlchemy 2.x
- Alembic
- Pytest
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Docker Compose
