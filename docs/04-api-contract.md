# Madweb CRM — API Contract

**Version:** 1.0  
**Status:** Proposed contract; finalize during implementation planning

## 1. General conventions

- Base path: `/api/v1`.
- JSON request and response bodies.
- UUID identifiers.
- ISO 8601 timestamps with timezone offsets; store timestamps in PostgreSQL as `TIMESTAMPTZ`.
- Use Pydantic schemas for validation.
- Paginate collection endpoints.
- Do not return password hashes, secrets or internal ORM-only fields.
- Keep OpenAPI/Swagger documentation synchronized with implementation.
- Authentication/session requirements follow `docs/05-authorization-and-audit.md`.

A consistent error shape is recommended:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The requested operation is invalid.",
    "details": []
  }
}
```

Do not expose stack traces or sensitive database details in client errors.

## 2. Authentication and users

Proposed endpoints, subject to the approved session design:
- `POST /auth/login`
- `POST /auth/logout` (if supported by the chosen session/token model)
- `GET /auth/me`
- `GET /users/attribution-options`
- `GET /users`
- `POST /users` — Admin only; create Staff accounts.
- `PATCH /users/{user_id}` — update approved user fields and active state.

`GET /users/attribution-options` returns active owner/Admin and staff entries suitable for the status attribution dropdown. It must not expose passwords or security-sensitive fields.

The attribution endpoint is not an authorization mechanism. Staff creation must remain protected server-side.

## 3. Customers

- `POST /customers` — create customer.
- `GET /customers` — list/search customers; support `q`, pagination and sorting.
- `GET /customers/{customer_id}` — customer details.
- `PATCH /customers/{customer_id}` — update customer.
- `GET /customers/{customer_id}/jobs` — customer job history.

Search by name and phone. Do not assume phone number uniqueness unless approved. Avoid hard deletion when jobs reference the customer.

## 4. Printing categories and stages

Categories:
- `GET /print-categories`
- `POST /print-categories`
- `GET /print-categories/{category_id}`
- `PATCH /print-categories/{category_id}`

Stages:
- `GET /print-categories/{category_id}/stages`
- `POST /print-categories/{category_id}/stages`
- `PATCH /workflow-stages/{stage_id}`
- `POST /workflow-stages/{stage_id}/deactivate` (or an equivalent documented PATCH)

The API must validate sequence, initial/final stage configuration and stage references. Do not hard-delete referenced stages. Permissions must match the approved authorization document; do not invent Admin-only restrictions for operational configuration.

## 5. Jobs

- `POST /jobs` — create an inquiry.
- `GET /jobs` — list/search/filter jobs.
- `GET /jobs/{job_id}` — job detail.
- `PATCH /jobs/{job_id}` — update permitted job fields.
- `POST /jobs/{job_id}/quotation` — create/update quotation details if separate action is useful.
- `POST /jobs/{job_id}/confirm` — confirm the existing job and assign its category's initial production stage.
- `POST /jobs/{job_id}/mark-lost` — mark lost with optional reason/notes.
- `POST /jobs/{job_id}/cancel` — cancel according to the lifecycle rules.
- `POST /jobs/{job_id}/stage` — update production stage and append status history.
- `GET /jobs/{job_id}/history` — chronological stage history.

`GET /jobs` should support documented filters including:
- customer ID or search term.
- category ID.
- inquiry lifecycle status.
- current stage.
- created date range.
- due date range.
- follow-up due/overdue.
- completed date range where supported.
- pagination and allowlisted sorting.

### Stage update request example

```json
{
  "to_stage_id": "UUID",
  "updated_by_user_id": "UUID",
  "notes": "Artwork approved by customer"
}
```

`updated_by_user_id` intentionally represents the selected attribution person. It is not a substitute for the authenticated operator. The backend validates that the selected user is active and that the target stage belongs to the job's category. The job's current stage and history entry must be committed atomically.

The API must reject invalid transitions and return a clear conflict/validation error. Define concurrency behavior, preferably using a version or expected-current-stage check.

## 6. Payments

- `POST /jobs/{job_id}/payments` — record a payment.
- `GET /jobs/{job_id}/payments` — payment history.
- `GET /payments` — filtered payment list if required for reporting.
- `GET /jobs/{job_id}/balance` — optional endpoint returning amount due, total paid, balance and derived status.

Use decimal amounts. Do not accept client-supplied payment totals or payment status as authoritative values. The backend calculates them from payment records.

Idempotency and overpayment/refund behavior must be defined before those cases are implemented.

## 7. Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/jobs-by-stage`
- `GET /dashboard/jobs-by-category`
- `GET /dashboard/payments-summary`

Where appropriate, these may be consolidated into a small number of endpoints. Avoid unnecessary endpoints if one response can cleanly serve the use case.

Dashboard definitions:
- Open inquiries: jobs in the defined pre-confirmation lifecycle states, excluding lost/cancelled/confirmed.
- Open quotation pipeline value: only eligible unconfirmed quotation jobs; do not count confirmed jobs.
- In production: confirmed jobs not at their final production stage, subject to the approved cancelled/reopened policy.
- Outstanding balance: final agreed amount minus valid payments on confirmed jobs.
- Payment received: sum of valid payments within the requested period.
- Follow-ups due/overdue: based on `next_follow_up_at` and the documented shop timezone.

## 8. HTTP behavior

Use consistent status codes:
- `200` successful read/update.
- `201` successful creation.
- `204` successful operation with no response body where appropriate.
- `400` malformed or invalid operation.
- `401` unauthenticated request.
- `403` authenticated but not authorized.
- `404` missing resource.
- `409` state/concurrency conflict.
- `422` schema validation error if consistent with FastAPI conventions.

Do not leak whether protected resources exist when that would violate the security policy.

## 9. API contract approval

Before implementing each module, verify its endpoints and schemas against this document and the database design. If an endpoint needs a business rule not specified in the requirements, ask before guessing. Update this contract when approved changes are made.
