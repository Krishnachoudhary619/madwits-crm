# Madweb CRM — Backend Acceptance Report

**Status:** Executed  
**Date:** 9 October 2026  
**Commit/revision:** `182e35840e937c0b9faaefd6a9c4ccb03ab9ed9d` (Phases 1–6 on `main`). Phase 7 added uncommitted acceptance tests and this report on top of that revision.

> Checks marked **PASS** were executed in this audit. **NOT VERIFIED** means the behavior was not exercised here (or is not implemented). **Code review** is called out separately from runtime checks.

## 1. Environment

- Operating system: Darwin 25.4.0 arm64 (macOS)
- Docker version: Server 29.5.2, Client 29.4.1
- Docker Compose: v5.1.3
- Python version (API container): Python 3.12.15
- PostgreSQL version (Postgres container): PostgreSQL 16.15
- Commit/revision: `182e358` plus Phase 7 working-tree files listed in section 9

## 2. Commands executed

| Command | Result | Notes |
|---|---|---|
| `uname -srm` | PASS | Darwin 25.4.0 arm64 |
| `docker version` / `docker compose version` | PASS | See environment |
| `git check-ignore -v .env` / `git ls-files` secret scan | PASS | `.env` ignored and not tracked |
| `docker compose run --rm -v "$(pwd):/app" api pytest -q` | PASS | **78 passed**, 1 Starlette TestClient deprecation warning, 21.70s |
| `docker compose up -d --build api` | PASS | Image rebuilt; API recreated; Postgres volume kept |
| `docker compose exec api python --version` | PASS | Python 3.12.15 |
| `docker compose exec postgres postgres --version` | PASS | PostgreSQL 16.15 |
| `curl http://localhost:8000/health` | PASS | `{"status":"ok"}` HTTP 200 |
| `curl http://localhost:8000/health/ready` | PASS | `{"status":"ok","database":"ready"}` HTTP 200 |
| `curl http://localhost:8000/api/v1/customers` | PASS | HTTP 401, error envelope `UNAUTHENTICATED` |
| `curl http://localhost:8000/openapi.json` | PASS | Paths match implemented Phase 1–6 routes |
| `docker compose exec api alembic current` then `upgrade head` | PASS | Existing `madweb_crm` already at `08f9bccd529b (head)`; upgrade was a no-op |
| Fresh DB `madweb_crm_phase7_fresh` + `alembic upgrade head` | PASS | Created inside the existing Postgres instance; **did not** drop volume `madweb_crm_postgres_data` or database `madweb_crm` |
| `DROP DATABASE madweb_crm_phase7_fresh` | PASS | Disposable DB only |
| Insert persist marker, `docker compose restart postgres`, re-select | PASS | Marker row survived; API `/health/ready` 200 afterwards |
| `python -m app.cli create-admin ...` (second Admin) | PASS | Exit 1: `An Admin account already exists.` |
| `docker compose exec api pytest -q` | PASS | Documented README command; **78 passed**, 21.69s |
| PostgreSQL backup/restore | NOT VERIFIED | No backup/restore procedure is implemented |

## 3. Acceptance checklist

### Docker and database

- [x] **PASS** API and PostgreSQL start successfully (`docker compose up -d --build api`; both containers running; API healthcheck present in Dockerfile).
- [x] **PASS** PostgreSQL data persists across container restarts (customer marker `phase7-persist-check` remained after `docker compose restart postgres`; named volume `madweb_crm_postgres_data` was not removed). Marker row was deleted afterwards.
- [x] **PASS** Health and readiness endpoints work (`/health`, `/health/ready`).
- [x] **PASS** Fresh-database migration succeeds (`madweb_crm_phase7_fresh` upgraded to `08f9bccd529b`; tables: `users`, `customers`, `print_categories`, `workflow_stages`, `jobs`, `payments`, `job_status_history`, `alembic_version`). Also covered by `test_upgrade_from_empty_disposable_database`.
- [x] **PASS** Migration against representative existing data succeeds. Runtime: existing `madweb_crm` `alembic upgrade head` was a no-op at head. Automated: `test_upgrade_preserves_representative_rows`.
- [x] **PASS** No secrets are committed (`.env` gitignored and untracked; `.env.example` has placeholders only). **Code review:** application logs do not print passwords, tokens or `password_hash`.

### Authentication and authorization

- [x] **PASS** Initial Admin provisioning is documented and secure (README CLI; no default password; second Admin rejected on the live database). Automated: `test_second_admin_provisioning_fails`.
- [x] **PASS** Admin can create Staff (`test_admin_can_create_staff`).
- [x] **PASS** Staff cannot create Staff (`test_staff_cannot_create_staff` and related 403 tests).
- [x] **PASS** Admin and Staff share operational permissions (customers, categories, jobs, payments, dashboard tests for both roles).
- [x] **PASS** Attribution dropdown lists active users (`test_staff_and_admin_can_read_attribution_options`).
- [x] **PASS** Attribution selection does not grant privileges (`test_attribution_header_does_not_grant_admin`).
- [x] **PASS** Selected attribution identity is stored correctly (`test_quotation_and_confirm_keep_the_same_job`, stage history tests).
- [x] **PASS** Inactive users cannot log in; deactivated tokens are rejected (`test_inactive_user_cannot_login`, `test_deactivated_user_token_is_rejected`).

### Customers and jobs

- [x] **PASS** Customer search works (`test_staff_can_create_search_and_update_customers`).
- [x] **PASS** A customer can have multiple jobs (`test_customer_jobs_list_supports_multiple_jobs`).
- [x] **PASS** Inquiry and quotation lifecycle works (`tests/test_jobs.py`).
- [x] **PASS** Confirmation preserves the existing job record (`test_quotation_and_confirm_keep_the_same_job`).
- [x] **PASS** Search, filters and pagination work (customer and job list tests, including follow-up overdue).

### Dynamic workflows and history

- [x] **PASS** Categories can be configured without hardcoded product types (`tests/test_workflows.py`).
- [x] **PASS** Categories have independent workflows (cross-category stage assignment rejected).
- [x] **PASS** Invalid transitions are rejected (lifecycle and stage tests; error code `CONFLICT`).
- [x] **PASS** Stage/category compatibility is enforced (composite FK plus service checks).
- [x] **PASS** Every successful stage change records history (confirm + subsequent moves).
- [x] **PASS** Job stage update and history insertion are atomic (`test_rejected_stage_and_payment_leave_history_and_rows_unchanged`; failed confirm/attribution tests leave no history).
- [x] **PASS** Deactivated stages/users do not destroy history (`test_referenced_stage_is_not_hard_deleted`; history keeps attribution user id).
- [x] **PASS** Concurrent updates are handled safely via optional `expected_current_stage_id` (`test_stage_moves_follow_category_workflow` stale-stage 409). Not a multi-client load test.

### Payments and dashboard

- [x] **PASS** Multiple payments per job work (`test_partial_payments_and_derived_balance`).
- [x] **PASS** Partial and fully paid balances are correct (Decimal `40.10 + 25.15 + 34.75 = 100.00`).
- [x] **PASS** Production completion is independent of payment status (`test_production_completion_is_independent_of_payment`).
- [x] **PASS** Dashboard figures use real database data (delta assertions in `tests/test_dashboard.py`).
- [x] **PASS** Date boundaries and timezone rules are tested (shop-local `Asia/Kolkata` inclusive dates, `[start_at, end_at)`).

### Quality and documentation

- [x] **PASS** Full automated test suite passes (**78 passed** twice: volume-mounted `compose run` and README `compose exec`).
- [x] **PASS** API docs match actual behavior (live OpenAPI paths listed in section 2; contract updated in Phases 4–6).
- [x] **PASS** Setup instructions are accurate (start, health, migrate, create-admin, pytest, down-without-`-v` verified).
- [x] **PASS** No unrequested frontend or features were added (no HTML/JS/TS frontend files; no payment-gateway or inventory modules).

## 4. Test results

- Total tests: 78
- Passed: 78
- Failed: 0
- Skipped: 0
- Coverage: not measured
- Relevant test output:

```text
docker compose run --rm -v "$(pwd):/app" api pytest -q
78 passed, 1 warning in 21.70s

docker compose exec api pytest -q
78 passed, 1 warning in 21.69s
```

Warning: Starlette `TestClient` deprecation (`httpx` / `httpx2`). Does not fail tests.

Live OpenAPI paths verified:

`/health`, `/health/ready`, `/api/v1/auth/*`, `/api/v1/users*`, `/api/v1/customers*`, `/api/v1/print-categories*`, `/api/v1/workflow-stages*`, `/api/v1/jobs*` (quotation, confirm, mark-lost, cancel, stage, history, payments, balance), `/api/v1/payments`, `/api/v1/dashboard/*`.

## 5. Known issues

1. **Unresolved product policies (documented, not invented)**  
   Severity: product, not a code defect.  
   Impact: frontend must not implement reopen-after-`LOST`/`CANCELLED`, refunds, overpayments, payment voids/corrections, or sequential job numbers. Overpayment is rejected with `409`.  
   Next action: owner decision before those features.

2. **No `completed_at` column**  
   Severity: documentation.  
   Impact: “completed in period” uses the latest history row onto the current final stage.  
   Next action: none unless the business wants a dedicated timestamp.

3. **Logout is client-side token discard**  
   Severity: accepted Phase 3 design.  
   Impact: no server denylist; a stolen token remains valid until expiry.  
   Next action: none unless a denylist is approved.

4. **PostgreSQL backup/restore is not implemented**  
   Severity: operational.  
   Impact: operators must use `pg_dump`/`pg_restore` themselves.  
   Next action: document an approved backup process if required.

5. **Starlette TestClient deprecation warning**  
   Severity: low.  
   Impact: noise in pytest output.  
   Next action: optional later dependency bump; out of Phase 7 scope.

None of the above failed a critical backend acceptance check that was in scope for Phases 1–6.

## 6. Deviations from approved documents

Documented in `docs/04-api-contract.md` and related notes during implementation (not hidden):

- Job numbers use unique `MW-YYYYMMDD-XXXXXXXX` rather than sequential `MAX + 1`.
- Shop dashboard calendar uses `SHOP_TIMEZONE` (default `Asia/Kolkata`).
- Payments allowed only on `CONFIRMED` jobs; amount due is `final_amount`.
- Reopen after `LOST`/`CANCELLED` is not implemented.
- Overpayments and refunds are not accepted.

No additional unapproved deviations were found in this audit.

## 7. Backend readiness decision

- [x] Ready for frontend development.
- [ ] Not ready; critical criteria remain incomplete.

Rationale: Docker, migrations, health, auth/RBAC, customers, workflows, jobs, payments, dashboard, error envelopes, and the full suite were executed and passed. Remaining items are documented product policies and operational backup, not missing Phase 1–6 backend behavior. Frontend work must consume the API as documented and must not invent the unresolved policies.

## 8. Startup and maintenance instructions

Verified in this audit unless noted.

Starting Docker services:

```bash
cp .env.example .env   # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up -d --build
```

Health: `http://localhost:8000/health` and `http://localhost:8000/health/ready`  
OpenAPI: `http://localhost:8000/docs`

Applying migrations (does not reset data):

```bash
docker compose exec api alembic upgrade head
docker compose exec api alembic current
```

Provisioning the initial Admin (fails if an Admin already exists):

```bash
docker compose exec api python -m app.cli create-admin \
  --username owner \
  --display-name "Shop Owner" \
  --password 'choose-a-strong-password'
```

Running tests:

```bash
docker compose exec api pytest
# or, using host source:
docker compose run --rm -v "$(pwd):/app" api pytest
```

Logs:

```bash
docker compose logs -f api
docker compose logs -f postgres
```

Stopping without deleting persistent data:

```bash
docker compose down
```

Destroying the Postgres volume (**destroys data**; not run in this audit):

```bash
docker compose down -v
```

Backing up and restoring PostgreSQL: **not implemented** in-repo. Use `pg_dump`/`pg_restore` against the `postgres` service if needed.

## 9. Phase 7 files changed

- `docs/07-backend-acceptance-report.md` — this report
- `tests/test_acceptance.py` — production-vs-payment independence; rejected stage/payment leave no extra history or payment rows
- `tests/test_health.py` — renamed stale “no business routes” check to unknown-path error envelope
- `README.md` — current phase set to Phase 7
