# Madweb CRM — Production deployment

**Version:** 1.0  
**Purpose:** Deploy the accepted Docker stack to a single-shop host without changing business rules.

Use this on the production server only. Do not point these commands at a database you are still using for local development.

## 1. What production includes

- PostgreSQL 16 with a dedicated named volume `madweb_crm_prod_postgres_data`
- FastAPI image without test extras (`runtime` target)
- Next.js standalone web image; the browser never receives the JWT
- `APP_ENV=production` (Swagger/OpenAPI disabled)
- Migrations applied with Alembic on API startup (`alembic upgrade head` only; no table drop)
- Restart unless the operator stops the services
- API and PostgreSQL are not published to the host; only the web UI is

## 2. Host requirements

- Docker and Docker Compose
- A copied environment file that is never committed
- HTTPS in front of the UI for shop use on the public internet

Recommended: a reverse proxy (Caddy, nginx, or the host firewall + TLS) that forwards to `127.0.0.1:3000`. Do not publish port 8000.

## 3. First deploy

On the production host, from the repository root:

```bash
cp .env.production.example .env
```

If this machine already has a development `.env`, keep that file and pass the production file explicitly:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Edit `.env` and set unique values for:

- `POSTGRES_PASSWORD`
- `JWT_SECRET` (at least 32 characters, not a placeholder)
- `COOKIE_SECURE=true` when the UI is served over HTTPS
- `COOKIE_SECURE=false` only if the shop opens the CRM over plain HTTP on a private network
- `WEB_PORT` if 3000 is already in use

Then:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

The API container applies pending Alembic migrations before it accepts traffic. Existing data is not reset.

## 4. First Admin and shop-floor Staff

There is no default Admin password.

```bash
docker compose -f docker-compose.prod.yml exec api python -m app.cli create-admin \
  --username owner \
  --display-name "Shop Owner" \
  --password 'choose-a-strong-password'
```

The command fails if an Admin already exists. Sign in as Admin in the UI and create the shared shop-floor Staff account from Staff management.

Do not reuse development passwords such as `phase3-admin-pass`.

## 5. Health checks

- Web: `http://127.0.0.1:3000/api/health`
- API (from inside the compose network only): `docker compose -f docker-compose.prod.yml exec api curl -fsS http://127.0.0.1:8000/health`
- Database readiness: `docker compose -f docker-compose.prod.yml exec api curl -fsS http://127.0.0.1:8000/health/ready`

`/docs` and `/openapi.json` are disabled when `APP_ENV=production`.

## 6. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Pending migrations run automatically on API start. Never use `docker compose down -v` on production. That deletes the PostgreSQL volume.

## 7. Backup and restore

Backup (custom PostgreSQL format, no data reset):

```bash
./scripts/backup-postgres.sh
```

Files are written to `backups/` on the host. Keep copies off the server.

Restore into the **running** production database (destroys current data in that database; take a fresh backup first):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/madweb-crm-YYYYMMDD-HHMMSS.dump
```

Do not restore a dump onto a machine that still holds data you need.

## 8. Logs and stop

```bash
docker compose -f docker-compose.prod.yml logs -f api web postgres
docker compose -f docker-compose.prod.yml down
```

`down` without `-v` keeps `madweb_crm_prod_postgres_data`.

## 9. Secrets and safety

- Never commit `.env`, dumps, or production data
- The API rejects placeholder `JWT_SECRET` and `POSTGRES_PASSWORD` values when `APP_ENV=production`
- Staff-management remains Admin-only; attribution is not authorization
- Test suites must not be run against the production database
