# Architecture and Database

This document describes the source snapshot, not a proposed rewrite. The most important maintenance constraint is preserving the difference between a mutable estimate, an issued financial document, and an internal reporting projection.

## Code map

| Area | Primary files |
|---|---|
| App shell and routing | `client/src/App.tsx`, `client/src/components/layout.tsx`; hash-based routes |
| Authentication and roles | `server/security.ts`, `server/security-context.ts`, `shared/security.ts`, `auth-provider.tsx`, `staff.tsx` |
| Database definition and CRUD | `shared/schema.ts`, `server/storage-db.ts`, `server/storage.ts` |
| Relationship integrity and customer merge | `shared/integrity.ts`, `server/integrity-migration.ts`, merge routes in `server/routes.ts` |
| Estimate builder and service isolation | `estimate-builder.tsx`, `new-estimate-dialog.tsx`, `shared/services.ts`, `shared/estimate-rules.ts` |
| Prices and diagrams | `estimate-damage-map.tsx`, `hail-estimator.tsx`, furniture/vehicle splats, `shared/hail-reference.ts`, `server/pricing-catalog.ts` |
| Invoice and payments | `server/billing.ts`, `invoice-detail.tsx`, `server/routes.ts` |
| Technician allocation | `server/labor.ts`, `client/src/components/labor-sales.tsx` |
| Sales-team and estimated cost snapshots | `server/estimate-sales.ts`, `client/src/components/estimate-commercial.tsx` |
| Legacy summary display | `documentBreakdown` in `shared/estimate-rules.ts`, `document-breakdown.tsx`, `server/print-safety.ts` |
| Work-order planning | `server/work-orders.ts`, `work-planning.tsx`, `job-detail.tsx` |
| Production and capacity | `server/operations.ts`, `server/capacity.ts`, `shared/operations.ts` |
| Reporting | `shared/reporting.ts`, `server/reporting.ts`, `reports.tsx`, `accounting.tsx` |
| VIN decoding/history | `server/vin.ts`, `shared/vin.ts`, `vin-lookup.tsx` |

All frontend files in this table are under `client/src/pages`, `client/src/components` or `client/src/lib` as appropriate. The backend is an Express application with synchronous SQLite access through `better-sqlite3`, with Drizzle used for application schemas and CRUD.

## Database metadata delivered

`database/schema.sql` and `database/schema.json` were exported read-only from the operating schema after the latest release. They contain table, column, index, foreign-key and trigger definitions, not table rows. The JSON is suitable for generating a data dictionary.

Do not treat `schema.sql` as an alternative installer. Audit triggers depend on application-registered SQLite functions, and startup migration ordering matters.

## Startup and migration ordering

`server/storage-db.ts` opens the selected file, enables WAL and foreign keys, sets a busy timeout, creates base tables and adds commercial line fields. `runMigrations()` in `server/migrations.ts` is the single migration entry point. Server startup (`registerRoutes`), `npm run db:migrate` and `npm run db:seed-demo` all call it, before any route is registered. It performs these steps in order:

1. Add early labor columns.
2. On a brand-new database only, load the reference catalog (service templates, pricing matrices, tax jurisdictions) once and record `reference-catalog-v1`. An existing database is only marked. Demonstration records load here only when `db:seed-demo` explicitly requests them (`demo-data-v1`); server startup never does.
3. Apply the integrity migration (`integrity-v1`).
4. Initialize labor tables and staff security.
5. Initialize sales attribution, operations, capacity, work-order planning and report-definition tables.
6. Recreate/extend audit triggers.
7. Apply the narrowly gated historic false-sent correction.

Schema steps are idempotent and run on every start. One-time steps are recorded in `app_migrations` (the historic correction uses `commerce_migrations`).

Never run generic `drizzle-kit push` against the operating database. The schema includes custom deferred ownership constraints, immutable financial triggers and audit behavior that are not fully represented by the ORM schema.

## Core relationships and financial rules

- **Ownership:** Customers own linked vehicles, assets, estimates, jobs, invoices and related records. Composite constraints enforce ownership where configured. Customer merge moves the graph in a transaction with a preview fingerprint and explicit contact-resolution choices.
- **Invoice issue:** Estimate conversion requires approval, classified lines and complete active-technician labor allocations. Repeating conversion returns the same invoice rather than creating another.
- **Money:** Storage uses numeric fields; financial operations round and allocate integer cents. Discounts are apportioned before tax and staff-credit calculations. Review all boundary rounding independently.
- **Payments:** Retry keys prevent duplicate posting. Payment records and issued financial data have immutability controls. The existing code does not provide a complete refund/credit-note accounting lifecycle.
- **Labor:** Net labor credits are copied at issue and attributed per invoice line. They exclude non-labor charges and customer tax, and do not themselves calculate paychecks.
- **Sales:** Saved salesperson splits allocate net invoice sales excluding customer tax. They are attribution, not commission pay.
- **Internal purchases:** `unit_cost`, `use_tax_rate` and `tax_note` are estimates, not posted vendor bills or tax returns. They are snapshotted at issue and omitted from customer print documents.
- **Legacy:** Historical `line_type='legacy'` is neither verified labor nor verified parts. Showing it as unclassified reconciles the displayed subtotal; it does not resolve its tax basis or eligibility for compensation.

## Security model

Current staff roles are owner, administrator, manager, service advisor, technician, support/dispatcher, accountant and read-only auditor. Exact permissions and route allowlists are in `shared/security.ts`; they are authoritative over prose descriptions.

Passwords use scrypt hashing in `staff_accounts`; bearer session tokens are hashed in `staff_sessions`. Client auth is held in memory, not browser local storage. A reload may require signing in again. Audit events and selected row before/after snapshots are recorded in SQLite.

Phase 1 hardening (see `server/http-security.ts`, `server/input-guard.ts`, `server/security.ts`):

- **Headers:** CSP (production), frame and MIME-sniffing protection, no-referrer, HSTS when HTTPS is detected through a trusted proxy (`TRUST_PROXY`).
- **Network:** listens on `127.0.0.1` by default (`HOST`).
- **Sign-in:** five failures lock an email from that client address for 15 minutes; a per-email ceiling (100) and per-address ceiling (60) slow distributed guessing without letting one client lock out staff. Activation is limited the same way.
- **Anonymous requests:** requests without a session token are throttled per address (120 rejections per 15-minute window, in memory, at most 50,000 addresses tracked) and are no longer written to the audit table one by one. Requests carrying a stale token always get 401 so the app returns to sign-in. Rate-limit keys are structured so a crafted email cannot collide with another account's key.
- **Data-entry routes:** only real columns are accepted; ids, record numbers, timestamps and ownership fields are server-controlled; tax-exempt status and credit limit require billing permission; activity authors are always the signed-in user.
- **Purchase costs:** any response key that looks like a cost, use-tax or tax-note field is removed for roles without cost access, except the explicitly listed non-cost keys.

Someone with raw database/file access can bypass application permissions. Protect filesystem access and backups; these controls are not a substitute for an independent security review, hardened hosting, or an incident-recovery procedure.

## Database backup and transfer

From `app/`, check or back up an explicitly selected existing database:

```sh
node handoff/database.mjs keygen                      # once; store the key securely
node handoff/database.mjs check /private/path/to/data.db
BACKUP_ENCRYPTION_KEY=... node handoff/database.mjs backup /private/path/to/data.db /private/path/to/backup.enc
BACKUP_ENCRYPTION_KEY=... node handoff/database.mjs decrypt /private/path/to/backup.enc /isolated/restore.db
```

The helper opens the source read-only, uses SQLite's consistent backup API, refuses to overwrite a destination, and limits file permissions. Backups are encrypted with AES-256-GCM; without a key it refuses unless `--allow-unencrypted` is passed deliberately. `decrypt` only produces a file after the authentication tag verifies, then runs integrity and foreign-key checks. Losing the key means losing the ability to restore. Do not copy only a live `.db` file while ignoring active WAL contents.

Before transfer, agree on the recipient, encrypted transport and retention. A full database can include customers, audit-history copies of private data, password hashes, session hashes and invitation hashes; clearing current customer rows alone is not sufficient anonymization.

Restore into an isolated staging location, record pre/post counts and financial fingerprints, run physical and foreign-key checks, and independently reconcile invoices and payment ledgers. Startup may migrate the file, so keep the original backup immutable and test rollback.
