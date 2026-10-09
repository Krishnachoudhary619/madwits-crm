# Madweb CRM — Authorization and Audit Rules

**Version:** 1.1  
**Status:** Required behavior; session design approved (see `docs/02-technical-architecture.md` section 6)

## 1. Single-shop model

Madweb CRM initially serves one printing shop. Multi-tenant shop support is out of scope.

## 2. Roles

### Admin
- All operational CRM permissions.
- Can create staff accounts.
- Can use customer, category, workflow, job, quotation, production, payment and dashboard functionality.

### Staff
- Same operational CRM permissions as Admin.
- Cannot create staff accounts.
- No other operational restrictions in the initial release.

Enforce authorization on the server, not just by hiding frontend controls.

## 3. Shared-system attribution dropdown

The production update UI must offer a dropdown of:
- The shop owner/Admin.
- All active staff members.

The operator deliberately chooses the person to attribute the update to. This is an explicit business requirement.

For each successful stage change:
- Store the selected person's `users.id` in `job_status_history.updated_by_user_id`.
- Validate that the user exists and is active.
- Preserve the history reference if the person is later deactivated.
- Do not replace the selection with the currently authenticated operator.
- Do not use the selected value to establish a session, determine a role or grant permissions.

The API should provide active attribution choices without exposing credentials or sensitive account data.

## 4. Authentication and Admin-only staff creation

The approved model is a shared operational STAFF session plus a separate Admin session. See `docs/02-technical-architecture.md` section 6.

Shop-floor operators authenticate as the shared `STAFF` account (or any active Staff account). The authenticated identity is used only for authorization. Production attribution remains the selected dropdown user.

Staff-management endpoints are Admin-only and must be enforced server-side. Shop-floor STAFF sessions must never succeed against:
- `POST /api/v1/users`
- `GET /api/v1/users`
- `PATCH /api/v1/users/{user_id}`

Operational endpoints that exist in this phase, including `GET /api/v1/users/attribution-options`, are allowed for both Admin and Staff.

Do not:
- Treat the attribution dropdown as authentication.
- Let a client submit `role=ADMIN` to create an Admin.
- Allow Staff to create staff accounts by calling the API directly.
- Use a hardcoded or publicly accessible default Admin credential.
- Silently require every employee to have a personal login solely to make attribution work.
- Claim that a role dropdown alone is secure authorization.
- Trust a JWT role claim without loading the current user from the database.

## 5. Status history

Every successful production-stage change must create a record containing:
- Job ID.
- Previous stage ID, nullable for initial assignment.
- New stage ID.
- Selected attribution user ID.
- Timestamp.
- Optional notes.

Rules:
- Append a history record; do not overwrite previous entries.
- Update `jobs.current_stage_id` and insert history in one transaction.
- Failed transitions create no history record.
- Validate target stage belongs to the job's category.
- Validate the selected attribution user is active at the time of the update.
- Protect against concurrent stage updates overwriting each other.
- History is read-only through normal operational APIs; corrections require a documented, authorized administrative process if ever needed.

## 6. User lifecycle

- Passwords must be securely hashed.
- Inactive users cannot authenticate.
- Inactive users do not appear in the attribution dropdown for new changes.
- Existing history continues to display the original user's name/identity.
- Avoid hard deletion of referenced users.
- Staff creation is Admin-only.
- The initial Admin must be provisioned securely through a documented command/process.

## 7. Authorization tests

At minimum, test:
- Admin can create staff.
- Staff cannot create staff.
- Both roles can use the same approved operational features.
- Unauthenticated requests are handled according to the chosen session model.
- A selected attribution user cannot grant privileges.
- Inactive attribution users are rejected.
- Attribution is saved as selected, even when different from the authenticated actor.
- History is written only after a valid transition.
- No client-controlled field can elevate role or bypass authorization.
