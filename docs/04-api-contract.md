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

Approved endpoints under the session design in `docs/02-technical-architecture.md` section 6:
- `POST /auth/login` — public; returns a Bearer JWT.
- `POST /auth/logout` — authenticated; client must discard the token.
- `GET /auth/me` — authenticated Admin or Staff.
- `GET /users/attribution-options` — authenticated Admin or Staff; active users only.
- `GET /users` — Admin only; paginated directory listing.
- `POST /users` — Admin only; always creates Staff. `role` is not accepted.
- `PATCH /users/{user_id}` — Admin only; `display_name`, `password`, `is_active`. Role cannot be changed.

`GET /users/attribution-options` returns active owner/Admin and staff entries suitable for the status attribution dropdown. It must not expose passwords or security-sensitive fields.

The attribution endpoint is not an authorization mechanism. Staff creation must remain protected server-side.

## 3. Customers

- `POST /customers` — create customer.
- `GET /customers` — list/search customers; support `q`, pagination (`page`, `page_size`) and allowlisted sorting (`sort=name|phone|created_at`, `order=asc|desc`).
- `GET /customers/{customer_id}` — customer details.
- `PATCH /customers/{customer_id}` — update customer, including `is_active`.
- `GET /customers/{customer_id}/jobs` — customer job history (read-only).

Search by name and phone. Phone numbers are not unique. Customers are archived with `is_active=false`; there is no hard-delete endpoint.

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

The API must validate sequence, initial/final stage configuration and stage references. Do not hard-delete referenced stages; deactivate them. Admin and Staff may configure customers, categories and stages. An active category with any active stages must have exactly one active initial stage and one active final stage. Activating a category requires that complete workflow. The first stage of an active category should be both initial and final; later stages can be inserted and the final/initial flags transferred by PATCH.

## 5. Jobs

Admin and Staff may use all job endpoints. Staff still cannot access staff-management endpoints.

- `POST /jobs` — create an inquiry (`NEW_INQUIRY`). The server assigns a unique job number; clients cannot supply one.
- `GET /jobs` — list/search/filter jobs.
- `GET /jobs/{job_id}` — job detail.
- `PATCH /jobs/{job_id}` — update permitted job fields. Does not change `lead_status`, `customer_id`, `category_id` or `job_number`.
- `POST /jobs/{job_id}/quotation` — save quotation details and move the existing job to `QUOTATION_PREPARED`, or to `AWAITING_CONFIRMATION` when `awaiting_confirmation` is true.
- `POST /jobs/{job_id}/confirm` — confirm the existing job, copy `quoted_amount` into `final_amount` when final amount is omitted, assign the category's active initial production stage, and append history. Requires `updated_by_user_id`.
- `POST /jobs/{job_id}/mark-lost` — mark lost with optional reason/notes.
- `POST /jobs/{job_id}/cancel` — cancel according to the lifecycle rules.
- `POST /jobs/{job_id}/stage` — update production stage and append status history.
- `GET /jobs/{job_id}/history` — chronological stage history.

Job numbers use the unique scheme `MW-YYYYMMDD-XXXXXXXX` (UTC date plus eight hex characters). Sequential `MAX(job_number) + 1` is not used.

There is no completed-at column in the approved schema, so completed-date filtering is not implemented.

### Inquiry lifecycle transitions

| From | Allowed targets |
| --- | --- |
| `NEW_INQUIRY` | `QUOTATION_PREPARED`, `AWAITING_CONFIRMATION`, `LOST`, `CANCELLED` |
| `QUOTATION_PREPARED` | `AWAITING_CONFIRMATION`, `CONFIRMED`, `LOST`, `CANCELLED` |
| `AWAITING_CONFIRMATION` | `QUOTATION_PREPARED` (quotation revised), `CONFIRMED`, `LOST`, `CANCELLED` |
| `CONFIRMED` | `CANCELLED` |
| `LOST` | none |
| `CANCELLED` | none |

Reopening `LOST`, `CANCELLED` or `CONFIRMED` is not implemented. A quotation that has not been confirmed must not receive a production stage.

### Production-stage rules

Confirmed jobs may move to the previous or next *active* stage in the job's category workflow, or directly to that category's active final stage. Cross-category stages, inactive stages, unconfirmed jobs and skipped intermediate non-final stages are rejected with `409`.

`updated_by_user_id` is the selected attribution person, not the authenticated operator. The backend validates that the selected user exists and is active. Invalid attribution returns `400` and writes no history. Job stage and history are committed in one transaction.

Concurrency: `POST /jobs/{job_id}/stage` accepts optional `expected_current_stage_id`. When provided and it does not match the job's current stage, the API returns `409` and makes no change.

### Stage update request example

```json
{
  "to_stage_id": "UUID",
  "updated_by_user_id": "UUID",
  "expected_current_stage_id": "UUID",
  "notes": "Artwork approved by customer"
}
```

`GET /jobs` filters:
- `q` — job number, title, customer name or phone.
- `customer_id`, `category_id`, `lead_status` (repeatable), `current_stage_id`.
- `created_from`, `created_to`, `due_from`, `due_to`.
- `follow_up_overdue=true` — `next_follow_up_at` is set and not after now.
- pagination (`page`, `page_size`) and allowlisted sorting (`sort=created_at|updated_at|due_date|next_follow_up_at|job_number|title`, `order=asc|desc`).

## 6. Payments

Admin and Staff may use all payment endpoints. There is no payment delete, void, refund or correction endpoint.

- `POST /jobs/{job_id}/payments` — record a payment against a **confirmed** job.
- `GET /jobs/{job_id}/payments` — payment history plus the derived balance snapshot.
- `GET /jobs/{job_id}/balance` — amount due, total paid, outstanding balance and derived payment status.
- `GET /payments` — filtered payment list (`job_id`, `payment_method`, `paid_from`, `paid_to`, pagination).

Request fields for `POST /jobs/{job_id}/payments`:
- `amount` — positive `NUMERIC(12,2)` decimal string/number. Greater than zero.
- `payment_method` — `CASH`, `UPI` or `BANK_TRANSFER`.
- `paid_at` — timezone-aware timestamp.
- `reference_number` — optional.
- `notes` — optional.

Amount due is the job's `final_amount`. Total paid is the sum of payment rows. Outstanding balance is amount due minus total paid. Derived status:
- `UNPAID` when total paid is zero and amount due is greater than zero.
- `PARTIALLY_PAID` when total paid is greater than zero and less than amount due.
- `PAID` when total paid equals amount due.

The client cannot submit payment totals or payment status; the backend calculates them. Payments are append-only.

A payment that would make total paid exceed amount due is rejected with `409`. Refunds, voids, overpayments and payment-idempotency keys are not implemented; those policies are still unresolved.

## 7. Dashboard

Admin and Staff may use all dashboard endpoints. Calendar dates and "today" use `SHOP_TIMEZONE` (default `Asia/Kolkata`). Stored timestamps remain `TIMESTAMPTZ`. A requested date range is inclusive of both calendar dates in that timezone and is applied as `[start_at, end_at)`. When `from_date` and `to_date` are omitted, the period is the current shop-local month through today.

- `GET /dashboard/summary` — snapshot pipeline metrics plus period metrics.
- `GET /dashboard/jobs-by-stage` — confirmed jobs grouped by current active production stage (zero counts included).
- `GET /dashboard/jobs-by-category` — job counts per print category, including confirmed / in-production / completed split.
- `GET /dashboard/payments-summary` — payment totals in the requested period, including per-method breakdown.

`GET /dashboard/summary` and `GET /dashboard/payments-summary` accept `from_date` and `to_date` (`YYYY-MM-DD`).

Definitions:
- Open inquiries: current jobs in `NEW_INQUIRY`, `QUOTATION_PREPARED` or `AWAITING_CONFIRMATION`.
- Quotations awaiting confirmation: current jobs in `AWAITING_CONFIRMATION`.
- Open quotation pipeline value: sum of `quoted_amount` for current `QUOTATION_PREPARED` and `AWAITING_CONFIRMATION` jobs. Confirmed, lost and cancelled jobs are excluded.
- Follow-ups due today: non-lost, non-cancelled jobs whose `next_follow_up_at` falls on the shop-local current date.
- Follow-ups overdue: non-lost, non-cancelled jobs whose `next_follow_up_at` is before shop-local today.
- In production: current `CONFIRMED` jobs whose current stage is missing or is not the category's final stage. Cancelled jobs are not counted (`CANCELLED` is a lifecycle status; reopen is not implemented).
- Completed jobs in period: current `CONFIRMED` jobs on their category's final stage whose latest history row onto that stage falls in the requested period. There is no `completed_at` column.
- Inquiry-to-confirmation conversion: jobs **created** in the requested period that are currently `CONFIRMED`, divided by jobs created in that period. The rate is a four-decimal decimal string. Jobs still open in the period remain in the denominator.
- Payments received: sum of `payments.amount` whose `paid_at` is in the requested period.
- Outstanding balance: sum of `final_amount - total paid` for current `CONFIRMED` jobs.

Empty datasets return zeros and empty lists, not errors. Production status and payment status are independent.

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
