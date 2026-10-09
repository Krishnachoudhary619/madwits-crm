# Madweb CRM — Development Roadmap

**Version:** 1.0  
**Purpose:** Sequential backend implementation with acceptance gates

## Phase 0 — Documentation and repository inspection

Tasks:
- Read `AGENTS.md` and all documents in `docs/`.
- Inspect the existing repository before changing anything.
- Identify existing code, tools and constraints.
- Resolve document conflicts and material open decisions.

Acceptance:
- Repository state and first incomplete phase are reported.
- No code is changed before requirements and architecture are understood.

## Phase 1 — Docker/backend foundation

Tasks:
- FastAPI app.
- Configuration and environment variables.
- PostgreSQL Docker service and persistent volume.
- SQLAlchemy session management.
- Health and database readiness endpoints.
- Alembic setup.
- Dependency management and `.env.example`.
- Initial tests.

Acceptance:
- API and PostgreSQL start with Docker Compose.
- Database persists across restarts.
- Health endpoints work.
- Secrets are not committed.
- No CRM business endpoints are added prematurely.

## Phase 2 — Schema and migrations

Tasks:
- Implement the seven core tables from the approved database design.
- Add foreign keys, constraints and indexes.
- Generate and review Alembic migration.
- Test migration on an empty database.
- Test migration against representative data in a disposable database.

Acceptance:
- Schema matches the approved design.
- Migrations apply cleanly.
- Existing data is not reset or destroyed.

## Phase 3 — Authentication, sessions and RBAC

Tasks:
- Implement the approved session/authentication design.
- Secure initial Admin provisioning.
- Implement Admin and Staff roles.
- Implement Admin-only staff creation.
- Implement active-user attribution options.
- Add authorization tests.

Acceptance:
- Role permissions match requirements.
- Attribution dropdown is not used for authentication/authorization.
- Shared-system workflow and Admin-only staff creation are reconciled securely.

## Phase 4 — Customers, categories and workflows

Tasks:
- Customer CRUD/search.
- Category CRUD/deactivation.
- Stage configuration, ordering and activation/deactivation.
- Validate initial/final stage configuration.
- Add tests.

Acceptance:
- Customers support multiple jobs.
- Categories and stages are dynamic.
- Historical references are preserved.
- No category-specific hardcoded workflow is required.

## Phase 5 — Jobs, quotations and status history

Tasks:
- Inquiry creation and search.
- Quotation preparation and updates.
- Lifecycle transitions.
- Confirmation of existing job.
- Production-stage update.
- Attribution and append-only history.
- Filtering, sorting and pagination.
- Concurrency protection.
- Add tests.

Acceptance:
- Confirmation does not duplicate jobs.
- Category workflow is enforced.
- History is correct and atomic.
- Invalid transitions are rejected.
- Selected attribution person is recorded.

## Phase 6 — Payments and dashboard

Tasks:
- Payment creation and history.
- Derived paid amount, balance and payment status.
- Dashboard aggregations.
- Date/timezone definitions.
- Tests.

Acceptance:
- Partial payments and balances are correct.
- Production and payment statuses remain independent.
- Dashboard values are derived from database data.
- Unresolved refund/overpayment policy is not guessed.

## Phase 7 — Backend integration and acceptance

Tasks:
- Run full test suite.
- Verify migrations, permissions, lifecycle, workflows, history, payments and dashboard.
- Verify Docker startup and data persistence.
- Review API documentation and setup instructions.
- Create `docs/07-backend-acceptance-report.md`.

Acceptance:
- Every critical criterion in the business requirements passes.
- Failures are fixed before declaring the backend complete.
- Deviations and unresolved issues are documented.
- No frontend implementation has started.

## Phase 8 — Frontend (future phase)

Do not begin until Phase 7 passes and the user approves frontend development. The frontend will consume the documented, tested API rather than redefining backend rules.

## Working protocol

- Implement one phase at a time.
- At the end of a phase, report files changed, commands run, actual test results, known issues and the next phase.
- Do not proceed past failed acceptance criteria.
- Stop for approval when a material business or schema decision is unresolved.
- Keep changes focused and avoid unrelated refactors.
