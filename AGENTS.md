# Madweb CRM — AI Coding Agent Rules

## Source of truth
- Read this file and all relevant files in `docs/` before making changes.
- `docs/01-business-requirements.md` is the source of truth for business behavior.
- `docs/02-technical-architecture.md` defines the approved technical approach.
- `docs/03-database-design.md` defines the approved initial data model.
- `docs/04-api-contract.md` defines API behavior and contracts.
- `docs/05-authorization-and-audit.md` defines authentication, authorization and attribution rules.
- `docs/06-development-roadmap.md` defines implementation order and acceptance gates.
- `docs/07-backend-acceptance-report.md` is the final verification report template.

## Change control
1. Do not invent features or expand scope without approval.
2. Do not change approved technology, schema, API contracts, permissions or business rules without documenting the reason and obtaining approval where material.
3. If documents conflict or a business-critical requirement is ambiguous, stop and ask a focused question before implementing that behavior.
4. Keep changes limited to the current phase. Do not rewrite unrelated working code.
5. Inspect the repository before creating, replacing or deleting files.
6. Never claim a command, test, migration or deployment succeeded unless it was actually executed and verified.
7. Report files changed, commands run, actual test results, unresolved issues and the next phase after each phase.

## Engineering rules
- Backend and database first. Do not build the frontend until backend acceptance criteria pass.
- Use the approved stack in `docs/02-technical-architecture.md`.
- Use Alembic for all schema changes. Do not use automatic table creation as a replacement for migrations.
- Never drop/reset existing data or rewrite an applied migration without explicit approval.
- Use environment variables for secrets. Do not commit `.env`, passwords, tokens, production data or database dumps.
- Keep PostgreSQL data in a persistent Docker volume.
- Validate inputs and enforce business rules server-side.
- Use database transactions for operations that update related records.
- Add tests for changed behavior, especially permissions, workflow transitions, history and payment calculations.
- Do not add unnecessary tables, dependencies, abstractions, microservices or integrations.
- Keep API documentation aligned with actual implementation.
- Preserve audit history. Prefer deactivation/soft-delete where referenced records must remain historically meaningful.

## Attribution and RBAC
- Admin and Staff have the same operational permissions initially, except only Admin can create staff accounts.
- The selected person in the status attribution dropdown is an intentional attribution choice.
- The selected attribution user is not necessarily the authenticated operator.
- Never use the dropdown value to grant authorization or to impersonate a user.
- Validate that the selected attribution user exists and is active.
- Enforce permissions independently on the server.
- The exact authentication/session approach must follow the approved architecture and must not force every shop-floor action to be attributed to the currently authenticated identity.

## Phase workflow
For each phase:
1. Read relevant documentation and inspect current state.
2. Implement only the current phase.
3. Run relevant tests and verification.
4. Fix failures within scope.
5. Update docs if implementation details change with approval.
6. Report verified results and wait before moving to the next phase if the phase gate has not passed.
