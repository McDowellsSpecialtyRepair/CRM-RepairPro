# Database invariants

`shared/integrity.ts` is the relationship catalog. `integrity-migration.ts` is the
authoritative, versioned physical schema upgrade. It runs as one ordered step of
`server/migrations.ts`, the single migration entry point used by server startup and
`npm run db:migrate`.
Do not run generic Drizzle schema push against this database: it does not model
the deferred ownership constraints or financial triggers.

All application SQLite connections enable foreign keys and a busy timeout.
Customer-owned records have simple reference constraints and, when both records
carry customer IDs, composite ownership constraints. Constraints are deferred
until commit so customer graph merges are atomic. Hard deletes cannot orphan
children. Relation IDs are indexed.

Payment rows are immutable. Posting runs inside an immediate transaction with
its activity entry; database triggers validate the invoice and amount and update
invoice paid/balance/status fields. A unique payment retry key allows identical
retries but rejects changed payloads. The invoice-to-estimate key is unique.
Invoice financial fields and existing invoice lines cannot be edited in place.
Refunds, reversals, credit notes, and card processing are not implemented here.

The migration backs up the database first, logs historical reconciliations, and
rolls back on violations. Existing negative discount lines are preserved, but
cannot be converted into invoices until reviewed. Future negative service lines
are rejected. Existing schedule ownership is derived from its linked work order
and any correction is recorded in `integrity_audit`.

Merge requires an up-to-date preview fingerprint, explicit confirmation, and
one validated answer per contact difference. All moves, preserved contact data,
audit records, source deletion, and activity records share one transaction.
No update exception may be swallowed.

This is not a security boundary against someone with raw database/file access.
App authentication and role enforcement remain a separate required workstream.
