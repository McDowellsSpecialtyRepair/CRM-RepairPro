# RepairPro Developer Handoff

Prepared for McDowells Specialty Repair on September 28, 2026. This is a portable source-and-documentation package for a developer taking over the CRM, estimating, scheduling, billing and accounting project. It is not a production-readiness certificate.

## Start here

1. Read `docs/KNOWN-ISSUES.md` before evaluating completion claims.
2. Follow `docs/SETUP.md` to install and run locally.
3. Run `node handoff/verify.mjs`, `node handoff/fresh-install-check.mjs`, `node handoff/security-check.mjs` and `npx tsx handoff/calculation-check.ts` from `app/` after building (CI runs them on every push).
4. Read `docs/ARCHITECTURE-AND-DATABASE.md` before changing financial logic or migrations.
5. Use `docs/ACCEPTANCE-AND-TESTS.md` to plan independent acceptance testing.
6. Follow `docs/BACKUP-AND-RECOVERY.md` for encrypted backups, key custody and restores.
7. To try the CRM in a browser with demo data only, create a GitHub Codespace (see `.devcontainer/HOW-TO-USE-THE-DEMO.md`).

## Package contents

- **app/**: Complete tracked source snapshot, dependency lockfile, existing test scripts, original database-invariant notes, and new handoff-only setup/verification utilities.
- **docs/**: Setup, architecture, database metadata, prioritized issues, business requirements, and acceptance criteria.
- **verification/**: Results of the clean-room verification run, source-file comparison, and packaging checks.
- **MANIFEST.sha256**: SHA-256 checksums for every other delivered file.

The source baseline is commit `92891fa448ac3125d85d086b4dcf01be1a2075e2`, including the latest legacy-breakdown display correction. Application source is unchanged from that commit. Handoff utilities and `.env.example` are additive and are listed separately in the provenance report.

## Privacy and transfer boundary

No operating database, customer-record export, live account password/hash, invitation code, session token, SMTP credential, environment secret, private email output, or Git history is included. Database metadata contains table/column/constraint definitions, not row data.

The original source contains built-in demonstration names, addresses, email literals, sample records, legacy dummy passwords and McDowells branding/test-recipient configuration. These are application source fixtures, not a fresh export of operating records; they must not be mistaken for approved business data or production credentials. The legacy `users` table is separate from the current `staff_accounts` authentication system.

Treat this package as confidential business software: it contains internal pricing logic, example matrices and workflow details. Do not publish it as an open-source repository merely because `package.json` contains a scaffold-generated MIT label; confirm ownership and dependency/license requirements with the owner.

## Verification actually performed

The exported copy was installed with `npm ci`, typechecked, and built in a separate directory using Node 20.20.1 on Linux. A fresh temporary database then passed 68 checks covering owner activation, nine service estimate-to-invoice-to-payment paths, labor allocation, internal costs/use tax, cross-service rejection, privacy of printed costs and physical database integrity.

A separate calculation regression run passed 54 assertions across nine summary cases, including the reported $230 legacy subtotal. These tests check reconciliation and warning labels; they do not establish the correct historical labor/material classification or tax treatment.

Those checks do not establish real-world usability, tax correctness for every job, external integration readiness, payroll accuracy, or 40-user operational capacity. Earlier reports cited 1,848 passing assertions yet missed the legacy summary display defect; that history is documented rather than hidden.

## Safe next step

Create a private repository from `app/`, retain this source baseline, and work on a separate stabilization branch. Do not point tests at the operating database or enable external messages/payments during onboarding.

An operating-data transfer, if needed, should be a separately authorized encrypted handoff after the developer and destination are chosen. The included database helper can create a consistent, AES-256-GCM encrypted backup (`BACKUP_ENCRYPTION_KEY`), but it does not authorize its transfer.
