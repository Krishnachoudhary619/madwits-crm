# Madweb CRM

Backend-first CRM for a single retail printing shop. Frontend development starts only after backend acceptance criteria pass.

## Current phase

Phase 7 — Backend integration and acceptance.

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

## Stack

- Python 3.12
- FastAPI
- PostgreSQL 16
- SQLAlchemy 2.x
- Alembic
- Pytest
- Docker Compose
