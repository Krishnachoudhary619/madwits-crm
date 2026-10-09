# Madweb CRM — Business Requirements

**Version:** 1.0  
**Status:** Baseline for implementation  
**Business model:** One retail printing shop using one shared CRM system

## 1. Purpose and problem

The shop provides multiple printing services, such as visiting cards, banners, stickers, labels, printed cups, brochures and custom printing. Customer requests are currently recorded in Google Sheets with limited details and a simple done/not-done indicator.

The shop loses track of inquiries, does not reliably follow up with customers comparing prices, has limited visibility into production progress, and needs a simple way to track payments.

Madweb CRM centralizes customer records, inquiries, quotations, confirmed jobs, configurable production stages, status history and payments. It must remain a lightweight CRM, not an ERP.

## 2. Business objectives

The system must let the shop:
1. Record customer inquiries, including those that never become orders.
2. Search customers and see their job history.
3. Track quotations awaiting a customer decision.
4. Identify follow-ups due and overdue.
5. Convert an accepted quotation into a confirmed order without duplicating the job.
6. Track production using category-specific configurable stages.
7. Record which owner/staff member was selected as responsible for a stage update.
8. Record advances and partial payments.
9. Calculate paid amounts and outstanding balances.
10. See dashboard summaries for inquiries, orders, stages, categories and payments.

## 3. Users and permissions

There are two roles: `ADMIN` and `STAFF`.

- Admin can use all operational CRM features and create staff accounts.
- Staff can use the same operational CRM features, but cannot create staff accounts.
- No other role differences are required in the initial release.
- The application is for one shop; multi-tenant shop support is out of scope.

### Attribution dropdown

When a production stage is updated, the UI must provide a dropdown listing the shop owner/Admin and all active staff members. The operator intentionally chooses the person to attribute the update to.

The selected person is stored in the job status history. The selected attribution person does not have to be the authenticated operator. The selected person must not be used to grant permissions or to impersonate an account.

The initial release must not require each employee to personally authenticate solely to use the attribution dropdown. The authentication/session approach and how Admin-only staff creation is protected must be specified in the technical architecture. Do not silently weaken Admin-only staff creation.

## 4. Customer management

A customer record supports:
- UUID identifier.
- Name.
- Phone number stored as text, preserving leading zeros and country codes.
- Optional business name.
- Optional address.
- Optional general notes.
- Created and updated timestamps.
- Active/archived state if needed by the approved design.

A customer can have multiple jobs. Search customers by name and phone. Do not automatically create a duplicate customer for every new inquiry.

## 5. Printing categories

Categories are database records, not hardcoded application branches. Examples:
- Visiting Cards
- Banners
- Stickers
- Labels
- Printed Cups
- Brochures
- Other / Custom Printing

Categories can be created and deactivated. Historical jobs must retain their category reference. Category/workflow administration permissions must be consistent with the approved authorization document; do not invent Admin-only restrictions.

## 6. Jobs: inquiry through order

One job record represents an inquiry and, if accepted, its resulting order. Do not duplicate the record when the inquiry becomes an order.

A job supports:
- UUID and human-readable job number.
- Customer and printing category references.
- Short title and detailed requirement description.
- Quantity.
- Category-specific specifications, using JSONB where appropriate.
- Inquiry lifecycle status.
- Current production stage when applicable.
- Quoted amount and final agreed amount.
- Optional advance requirement.
- Due date and next follow-up date/time.
- Internal notes.
- Created and updated timestamps.

Common fields should remain typed database columns. Use JSONB only for varying product-specific details such as dimensions, paper/material, finish, colors, printing sides, eyelets or mounting requirements.

## 7. Inquiry lifecycle

The lifecycle is distinct from the production stage. The initial status set should support:
- `NEW_INQUIRY`
- `QUOTATION_PREPARED`
- `AWAITING_CONFIRMATION`
- `CONFIRMED`
- `LOST`
- `CANCELLED`

The allowed transitions must be implemented and documented in the API contract. A quotation not accepted by the customer must not enter production.

When confirmed, the existing job becomes an order and is assigned the configured initial production stage for its category. Lost and cancelled jobs remain available for historical reporting. Notes/reasons for lost inquiries should be recordable.

## 8. Dynamic production workflows

Each printing category has its own configurable ordered workflow. Examples only:

Visiting Cards: Designing → Printing → Completed  
Banners: Designing → Printing → Finishing → Ready for Delivery → Completed

These are examples, not hardcoded workflow requirements.

A workflow stage includes:
- UUID.
- Category reference.
- Name.
- Sequence/order.
- Initial-stage indicator.
- Final-stage indicator.
- Active/inactive status.

The system must allow authorized operational users to configure stages through the application unless the authorization document explicitly limits an action. Each active workflow must have exactly one initial and one final stage. Stage changes must validate category membership and allowed transitions. Referenced stages must not be hard-deleted; deactivation is preferred.

The initial implementation may support moving to the next or previous active stage in sequence, with a deliberate transition to the final stage. More complex conditional workflows are out of scope unless approved.

## 9. Job status history

Every successful production-stage change creates a history record containing:
- Job reference.
- Previous stage (nullable for initial assignment).
- New stage.
- Selected attribution user.
- Timestamp.
- Optional notes.

Validate that the selected attribution user exists and is active. The current job stage and history row must be updated in one database transaction. Failed updates must not create misleading history. History must be retained and presented chronologically.

## 10. Payments

A job may have multiple payment records. Each payment includes amount, payment method (cash, UPI, bank transfer or another configured value), paid timestamp, optional transaction reference and notes.

Calculate from valid payment records:
- Total paid.
- Outstanding balance.
- Payment status: `UNPAID`, `PARTIALLY_PAID`, or `PAID`.

Outstanding balance is final agreed amount minus valid payments received. Use decimal/numeric database types, never floating point for money. Define overpayment/refund handling before implementing those cases; do not invent the policy. Production completion is independent of payment completion.

Payment gateway integration, bank reconciliation, GST accounting and a full accounting ledger are out of scope.

## 11. Dashboard and reporting

Support:
- Open inquiries.
- Quotations awaiting confirmation.
- Follow-ups due today and overdue.
- Confirmed jobs in production.
- Jobs grouped by current production stage.
- Completed jobs in a selected period.
- Inquiry-to-order conversion rate.
- Open quotation pipeline value.
- Payments received in a selected period.
- Outstanding balances on confirmed jobs.
- Job counts grouped by printing category.

All figures must be calculated from real database records with documented definitions and consistent timezone/date boundaries. Do not hardcode dashboard figures.

## 12. Initial scope

- Customer management.
- Inquiry/job lifecycle and quotations.
- Dynamic printing categories and workflows.
- Job status history and selected-person attribution.
- Payments and balance calculation.
- Admin/Staff roles and Admin-only staff creation.
- Search, filters, sorting and pagination.
- Dashboard summary APIs.
- Dockerized backend and PostgreSQL.
- Version-controlled database migrations.
- Automated tests and API documentation.

## 13. Out of scope unless separately approved

- Inventory/raw materials.
- Supplier management.
- Payroll or attendance.
- GST/full accounting.
- Automated messaging or WhatsApp.
- Online payment collection.
- Customer self-service portal.
- Multi-shop tenancy.
- Advanced production scheduling.
- AI-generated quotations.
- Any other unrequested feature.

## 14. Delivery requirements

Backend and database must be completed before frontend development. PostgreSQL runs in Docker with persistent storage. Schema changes use version-controlled migrations. Application startup must not reset or recreate existing tables. Secrets are kept out of source control. APIs validate data and enforce rules server-side.

## 15. Backend definition of done

1. Docker API and PostgreSQL start reliably.
2. Database persists across container restarts.
3. Migrations create the schema on an empty database.
4. Admin/Staff permissions work as specified.
5. Admin can create staff; Staff cannot.
6. Customers and jobs can be created, searched and updated.
7. Confirmation preserves the existing job record.
8. Category workflows are configurable and enforced.
9. Successful stage changes write correct history atomically.
10. Selected attribution person is saved and validated.
11. Multiple payments and balances work correctly.
12. Dashboard metrics use real data.
13. Critical business rules have automated tests.
14. API docs and setup instructions are accurate.
15. Frontend work has not begun until acceptance criteria pass.

## 16. Change control

This document is the business source of truth. If requirements are ambiguous or documents conflict, report the issue and ask for clarification before making a business-critical decision. Distinguish confirmed requirements from recommendations and unresolved decisions. Update this document and related technical documents only for approved changes.
