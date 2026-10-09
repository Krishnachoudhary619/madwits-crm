# Madweb CRM — Backend Acceptance Report

**Status:** Not yet executed  
**Date:** To be filled after verification  
**Commit/revision:** To be filled

> This is a template. Do not mark checks as passed unless they were actually executed and verified.

## 1. Environment

- Operating system:
- Docker version:
- Python version:
- PostgreSQL version:
- Commit/revision:

## 2. Commands executed

| Command | Result | Notes |
|---|---|---|
| | Not run | |
| | Not run | |

## 3. Acceptance checklist

### Docker and database
- [ ] API and PostgreSQL start successfully.
- [ ] PostgreSQL data persists across container restarts.
- [ ] Health and readiness endpoints work.
- [ ] Fresh-database migration succeeds.
- [ ] Migration against representative existing data succeeds.
- [ ] No secrets are committed.

### Authentication and authorization
- [ ] Initial Admin provisioning is documented and secure.
- [ ] Admin can create Staff.
- [ ] Staff cannot create Staff.
- [ ] Admin and Staff share the required operational permissions.
- [ ] Attribution dropdown lists active users.
- [ ] Attribution selection does not grant privileges.
- [ ] Selected attribution identity is stored correctly.

### Customers and jobs
- [ ] Customer search works.
- [ ] A customer can have multiple jobs.
- [ ] Inquiry and quotation lifecycle works.
- [ ] Confirmation preserves the existing job record.
- [ ] Search, filters and pagination work.

### Dynamic workflows and history
- [ ] Categories can be configured without hardcoded product types.
- [ ] Categories have independent workflows.
- [ ] Invalid transitions are rejected.
- [ ] Stage/category compatibility is enforced.
- [ ] Every successful stage change records history.
- [ ] Job stage update and history insertion are atomic.
- [ ] Deactivated stages/users do not destroy history.
- [ ] Concurrent updates are handled safely.

### Payments and dashboard
- [ ] Multiple payments per job work.
- [ ] Partial and fully paid balances are correct.
- [ ] Production completion is independent of payment status.
- [ ] Dashboard figures use real database data.
- [ ] Date boundaries and timezone rules are tested.

### Quality and documentation
- [ ] Full automated test suite passes.
- [ ] API docs match actual behavior.
- [ ] Setup instructions are accurate.
- [ ] No unrequested frontend or features were added.

## 4. Test results

- Total tests:
- Passed:
- Failed:
- Skipped:
- Coverage (if measured):
- Relevant test output:

## 5. Known issues

List each issue, severity, impact and next action. Write `None verified` only if a review was actually performed.

## 6. Deviations from approved documents

List any approved deviations and references to updated documentation. Do not hide unapproved deviations.

## 7. Backend readiness decision

- [ ] Ready for frontend development.
- [ ] Not ready; critical criteria remain incomplete.

Rationale:

## 8. Startup and maintenance instructions

Document verified commands for:
- Starting Docker services.
- Applying migrations.
- Provisioning the initial Admin.
- Running tests.
- Viewing logs.
- Stopping services without deleting persistent data.
- Backing up and restoring PostgreSQL data, if implemented.
