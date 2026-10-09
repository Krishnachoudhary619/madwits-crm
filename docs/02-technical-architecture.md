# Madweb CRM — Technical Architecture

**Version:** 1.0  
**Status:** Proposed baseline; review before implementation

## 1. Architecture principles

- Single-shop CRM; no multi-tenant architecture.
- Modular monolith, not microservices.
- API and PostgreSQL run as separate Docker services.
- Backend-first; frontend is a later phase.
- Business rules live in backend services, not only in the UI.
- Database changes use Alembic migrations.
- Audit history and payment records must not be silently overwritten.
- Avoid unnecessary abstractions, dependencies and infrastructure.

## 2. Proposed stack

- Python 3.12 or later, compatible with selected dependencies.
- FastAPI.
- PostgreSQL.
- SQLAlchemy 2.x.
- Alembic.
- Pydantic.
- JWT-based API authentication with bcrypt password hashing, as approved in section 6.
- Pytest.
- Docker and Docker Compose.
- FastAPI OpenAPI/Swagger documentation.

If the repository already contains a compatible approved setup, inspect it and preserve it. Do not change the stack without approval.

## 3. Proposed project structure

Adapt to the repository if it already has a sound structure. A reasonable starting point is:

```text
.
├── AGENTS.md
├── docs/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── errors.py
│   ├── db/
│   │   ├── base.py
│   │   └── session.py
│   ├── models/
│   ├── schemas/
│   ├── api/
│   │   └── v1/
│   ├── services/
│   └── repositories/  # only if it adds real value
├── alembic/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── pyproject.toml or approved dependency file
├── .env.example
└── .gitignore
```

Do not create empty layers or repositories solely to match this example. Use the simplest structure consistent with maintainability.

## 4. Responsibilities

- **API/router layer:** HTTP input/output, dependency wiring and authorization dependencies.
- **Schema layer:** Request and response validation; do not expose password hashes.
- **Service layer:** Business rules, lifecycle transitions, workflow validation and transactional operations.
- **Data/model layer:** SQLAlchemy models, relationships and constraints.
- **Migration layer:** Version-controlled schema evolution.
- **Tests:** Unit and integration tests for rules and endpoints.

## 5. Database and transaction policy

- PostgreSQL is the supported database; do not substitute SQLite.
- Use SQLAlchemy 2.x and explicit transaction boundaries.
- Use Alembic for schema changes.
- Never call `drop_all`, recreate tables automatically, or reset data on startup.
- The job's current-stage update and corresponding history insert must commit or roll back together.
- Payment creation and any related consistency checks must use a transaction.
- Use appropriate indexes for foreign keys, common filters and search patterns.
- Use NUMERIC/DECIMAL for money.
- Use timezone-aware timestamps and document the timezone policy. Phase 6 uses `SHOP_TIMEZONE` (default `Asia/Kolkata`) for dashboard calendar days; values are still stored as `TIMESTAMPTZ`.

## 6. Authentication and session design (approved)

Approved 9 October 2026. This reconciles the shared shop-floor system with Admin-only staff creation.

### Two session kinds, one user directory

Shop-floor work uses a **shared operational STAFF session**. Administrative account management uses an **Admin session**. Attribution is a separate request field and is never used to authenticate or authorize.

**Shared operational session**
- One `STAFF` account (for example `shop` or `counter`) is used on the shared computer during the working day.
- That session has all operational CRM permissions (customers, jobs, payments, dashboard, attribution dropdown).
- It must not access staff-management endpoints. The server rejects `POST /users`, `GET /users` (directory listing) and `PATCH /users/{user_id}` with `403` for `STAFF`.
- Individual employees do not need personal logins to attribute work. They choose the person from the attribution dropdown.

**Admin management session**
- The owner authenticates with an Admin username and password.
- The session has the same operational permissions as Staff, plus staff management.
- Only this role may create, list (full directory) and update staff accounts.
- `POST /users` always creates `STAFF`. A client-supplied `role=ADMIN` is rejected. Role comes from the authenticated user's database row, not from the request body or attribution dropdown.

**Staff directory records**
- Created only by Admin.
- They may log in later, but daily shop-floor work does not require it.
- Inactive users cannot authenticate and are omitted from attribution options.
- History keeps their ID after deactivation.

### Tokens and passwords

- Clients send `Authorization: Bearer <jwt>`.
- JWT subject is the authenticated `users.id`. Tokens are signed with `JWT_SECRET` from the environment.
- Authorization loads the user from the database on each request (active status and role). A token for a deactivated user is rejected.
- Access tokens expire after 12 hours by default (shop-day). `POST /auth/logout` instructs the client to discard the token; this phase does not persist a server-side denylist.
- Passwords are hashed with bcrypt. No default Admin password is shipped.

### Initial Admin provisioning

- Documented CLI only: `docker compose exec api python -m app.cli create-admin --username … --display-name … --password …`
- Creates the first Admin and fails if an Admin already exists.
- Password is supplied on the command line or environment, never committed.

### Attribution

- `GET /users/attribution-options` is an operational endpoint for Admin and Staff. It returns active users (`id`, `display_name`, `username`, `role`) with no password hashes.
- Later stage-update APIs accept `updated_by_user_id` as the selected person. That value must not grant privileges or replace the authenticated caller.

Do not treat the attribution dropdown as authentication. Do not use the dropdown value to grant privileges. Do not require every employee to sign in solely to use the dropdown.

## 7. Configuration and secrets

- Read settings from environment variables.
- Provide `.env.example` with placeholder values only.
- Exclude `.env`, credentials, tokens, dumps and local database files from Git.
- Fail fast on missing required configuration.
- Do not ship a publicly accessible default Admin password.
- Document a secure initial Admin provisioning command or process.

## 8. Docker development

- Separate API and PostgreSQL containers.
- Use a named volume for PostgreSQL data.
- Include a database health check.
- Make API startup depend on database readiness, while still handling connection retries gracefully.
- Provide a lightweight API health endpoint and a database readiness endpoint.
- Avoid running PostgreSQL inside the API container.
- Document build, start, logs, migration, test and shutdown commands.
- Do not claim containers were tested unless commands were executed.

## 9. API conventions

- Use a versioned API prefix, proposed as `/api/v1`.
- Use Pydantic request and response schemas.
- Use consistent error responses and correct HTTP status codes.
- Apply pagination to collection endpoints.
- Keep API documentation aligned with implementation.
- Avoid returning secrets or internal ORM fields unintentionally.
- Use explicit filtering and sorting allowlists.

## 10. Testing

Use Pytest. Include unit and integration tests for:
- Authentication and authorization.
- Admin-only staff creation.
- Customer and job lifecycle.
- Dynamic category workflows.
- Valid and invalid stage transitions.
- Attribution validation.
- Atomic history writes.
- Payment calculations and duplicate submission protections.
- Dashboard calculations and date boundaries.
- Migrations and database persistence where practical.

Use an isolated test database and deterministic test data. Never run destructive tests against production data.

## 11. Operational logging and errors

- Log meaningful operational errors without passwords, tokens or unnecessary personal data.
- Return safe client-facing error messages.
- Do not expose stack traces or database credentials in production responses.
- Use transactions and handle integrity/concurrency failures explicitly.
- Include request IDs only if supported cleanly by the implementation.

## 12. Architecture approval gates

Before implementing business endpoints, approve the schema and API contract. If an implementation requires a material deviation, document it and request approval. Complete the backend acceptance report before frontend development.
