# MadWits CRM — Temporary Render demo

Use this only for a client demo. Do not deploy to Hetzner or `www.madwits.com` from these steps. Do not put real production secrets in the repo.

Create services in this order: PostgreSQL, then API, then Web. Give the client the **web** URL only.

## 1. PostgreSQL

Dashboard: **New + → PostgreSQL**

- Name: `madwits-crm-db`
- Database: `madweb_crm`
- User: `madweb`
- Region: the same region you will use for the web services
- Plan: the cheapest paid plan that stays up for the demo (free databases expire)

Leave the database creating while you add the API.

## 2. API (FastAPI Docker)

Dashboard: **New + → Web Service → this Git repository**

| Setting | Value |
| --- | --- |
| Name | `madwits-crm-api` |
| Language / Runtime | Docker |
| Root Directory | leave empty (repository root) |
| Dockerfile Path | `Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | leave empty (entrypoint starts uvicorn on `$PORT`) |
| Instance type | Starter or higher (1 GB RAM) |
| Health Check Path | `/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `APP_NAME` | `Madweb CRM` |
| `APP_ENV` | `production` |
| `JWT_SECRET` | Generate → at least 32 characters, not a placeholder |
| `JWT_EXPIRE_MINUTES` | `720` |
| `SHOP_TIMEZONE` | `Asia/Kolkata` |
| `RUN_MIGRATIONS` | `1` |
| `DATABASE_URL` | **Add from database** → `madwits-crm-db` → `DATABASE_URL` |

Do not set the example `JWT_SECRET` or `POSTGRES_PASSWORD` placeholders. The API rejects those when `APP_ENV=production`.

Render injects `PORT`. The entrypoint is `scripts/api-entrypoint.sh`, which runs:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

when `RUN_MIGRATIONS=1`. That applies pending Alembic revisions only. It does not drop data.

Wait until the API is Live, then open `https://<api-service>.onrender.com/health` and confirm `{"status":"ok"}`. `/docs` is disabled in production.

## 3. First Admin

On the API service: **Shell**

```bash
python -m app.cli create-admin \
  --username owner \
  --display-name "Shop Owner" \
  --password 'choose-a-strong-demo-password'
```

The command fails if an Admin already exists. Then sign in as Admin in the UI and create the shared shop-floor Staff account.

Do not reuse local passwords such as `phase3-admin-pass`.

## 4. Web (Next.js Docker)

Dashboard: **New + → Web Service → the same Git repository**

| Setting | Value |
| --- | --- |
| Name | `madwits-crm-web` |
| Language / Runtime | Docker |
| Root Directory | `web` |
| Dockerfile Path | `Dockerfile` |
| Docker Build Context | `.` (relative to `web`) |
| Docker Command | leave empty (`node server.js`) |
| Instance type | Standard or higher (Next.js image build needs memory) |
| Health Check Path | `/api/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `API_INTERNAL_URL` | `https://<api-service>.onrender.com` (no trailing slash) |

`API_INTERNAL_URL` is server-only. Do not put `JWT_SECRET` or database passwords on the web service.

Give the client `https://<web-service>.onrender.com`.

## 5. After deploy

1. Open the web URL and sign in as the Admin you created.
2. Create one Staff account for the shop-floor demo session.
3. Add a category with stages if the demo database is empty.
4. If a service slept on a free instance, open the API URL once, then the web URL.

## 6. Do not

- Commit `.env`, Render API keys, or the Admin password
- Run `docker compose down -v` or drop the Render database
- Point these services at Hetzner or `www.madwits.com`
- Run the test suite against the Render database
