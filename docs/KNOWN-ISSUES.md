# Known Issues and Production Blockers

This is the receiving developer's starting backlog. “Implemented” and “tested in one scenario” must not be read as “production-ready.” Prior broad passing-test claims were insufficient: the owner subsequently found an obvious subtotal breakdown error.

## Critical stabilization work

| ID | Status / priority | Problem and code area | Acceptance requirement |
|---|---|---|---|
| EST-01 | Open, P0 | Legacy invoice INV-2026-010 has $150 and $80 lines without a parts/labor split. The old summary displayed two $0 categories against a $230 subtotal. Latest code now shows $230 unclassified and $13.80 recorded tax, total $243.80. | The display correction is done; actual classification and historical tax remain unresolved. Build a reviewed adjustment/migration process with the owner/accountant. Never guess that descriptions prove the entire charge was labor, and never mutate issued amounts silently. |
| EST-02 | Open, P0 | Owner says the estimate workflow remains unworkable despite recent fixes. `estimate-builder.tsx` contains multiple independently saved sections, legacy editing and tax/classification logic. | Demonstrate representative real shop estimates on Android with the owner. Independently specify expected totals before running the app; test old and newly created records, not only API-created clean examples. |
| BILL-01 | Missing lifecycle, P0 | `server/billing.ts` protects issued records but the app has no complete credit-note, refund or reversal workflow. | Accountant-approved adjustment, payment reversal/refund and reissue design with immutable audit trail and downstream reconciliation. |
| DB-01 | Partly addressed (Phase 0), P1 | Done: single migration entry point (`server/migrations.ts`) shared by startup and `db:migrate`; demo data is explicit opt-in (`db:seed-demo`) and never loaded by startup; reference catalog separated from sample data; fresh-install check in CI. Remaining: restore drill and migration rollback tests. | Restore/migration rollback tests on a staging copy. |
| QA-01 | Coverage gap, P0 | Hundreds of generated assertions did not cover the reported legacy UI state. Many old tests depend on workspace paths and private fixtures. | Independent acceptance cases, regression of every reported defect, portable CI, browser coverage and no acceptance tests weakened just to pass implementation. |
| SEC-01 | Partly addressed (Phase 1), P0 before live launch | Done: field allowlists on data-entry routes, security headers/CSP, loopback bind and proxy trust settings, per-address login lockout, anonymous-request throttling, pattern-based purchase-cost privacy, self-hosted Inter/JetBrains Mono, encrypted backups, owner-only email copies with optional retention; regression suite `handoff/security-check.mjs` in CI. Remaining: independent security review, TLS reverse proxy and hosting hardening, row-level access (any advisor sees all customers), incident recovery and restore drill, Satoshi still loaded from Fontshare (FONT-01), the one-time `*.pre-integrity-v1.bak` on brand-new installs is owner-only but unencrypted, and PATCH on bookings/schedule slots/service history can still change linked job or customer ids (database ownership constraints still apply). | Independent review of role boundaries, sessions, reset/invite flows, auditing, TLS and incident recovery. |
| OPS-01 | Not demonstrated, P0 before 40-user use | SQLite with synchronous access and a busy timeout is not a demonstrated 40-user capacity plan. | Concurrent estimate edits, duplicate conversion/payment retry tests, sustained realistic load, latency/error budgets, backup under load and restore drill; decide whether to retain SQLite or migrate. |

## Incomplete integrations and product areas

| ID | Area | Current boundary / required work |
|---|---|---|
| INT-01 | QuickBooks Desktop Enterprise | Sync endpoints intentionally reject fake success. No approved Desktop bridge is connected. Define customer/item/tax/account mapping, idempotency, returned IDs, errors, reconciliation and recovery before transferring anything. Historical simulated sync references are not evidence of posting. |
| INT-02 | Customer payment portal | A secure remote-payment portal through Mcdowellsrepair.com is a requirement, not a delivered integration. Implement scoped access, processor checkout, authenticated webhooks, retries, receipts, refunds and ledger reconciliation. |
| INT-03 | Dealer approvals | Dealer login, dealer-only vehicle access and recorded repair authorization remain required. Staff booking UI is not a dealer portal. |
| INT-04 | Email/SMS/WhatsApp | SMTP credentials are not supplied; test recipient is hardcoded to service@mcdowellsrepair.com. SMS is not connected and WhatsApp setup was paused after account lockout. Do not send real messages while onboarding. |
| INT-05 | Website booking | Existing booking UI is behind staff authentication and uses a shorter, inconsistent service list and random display numbering. It is not a production public intake integration. |
| FIN-01 | Payroll | Technician net-labor production is available; pay rules, rates, adjustments and payroll export are not a validated payroll engine. |
| FIN-02 | Purchasing/use tax | Estimated purchase costs/use tax do not create vendor bills, inventory movements or tax filings. Use-tax entry currently supports shop-consumed supplies only. Confirm partial vendor tax, exemptions, freight basis, credits and jurisdiction rules. |
| MKT-01 | Marketing | Counters are manually maintained, not verified campaign delivery, attributed sales, actual spend or ROI. Campaign creation UI is disabled. |
| CFG-01 | Settings | Business/service/tax settings include preview placeholders and disabled saves. Confirm legal business identity, document wording and configurable tax policy. |
| PRICE-01 | Pricing provenance — owner decision 2026-10-06: all existing pricing is unverified and not approved for production use | The reference catalog (templates and pricing matrices) still loads into a brand-new database as before, pending a later pricing review. Source-backed State Farm cells coexist with unverified legacy insurer data. Other carriers must not inherit State Farm values. Obtain current applicable agreements and record provenance/approval; review Quick Add labor-only assumptions. |
| UI-01 | Role and workflow consistency | Some UI controls rely on backend denial rather than clear disabled/read-only states. Verify all roles and unsaved edits across every editor. |
| MAINT-01 | Dependencies / bundles | Phase 0: unused packages removed, non-breaking audit fixes applied (critical `proxy-addr` fixed), Node 22 LTS pinned. Remaining: build-time Tailwind CSS 3 audit findings with no non-breaking fix, deprecated `prebuild-install`/Recharts 2 warnings, large client bundle, and a `better-sqlite3` major upgrade before Node 24. A successful build is not a security audit. |

## Deferred upgrade projects (owner decision 2026-10-06)

These are tracked as separate future projects and are excluded from current stabilization work.

| ID | Upgrade | Why deferred / what it requires |
|---|---|---|
| UPG-01 | Node 24 LTS + `better-sqlite3` 12 | `better-sqlite3` 11.x crashes the server on Node 24. Requires a major native-module upgrade with full regression, restore and load testing. Node 22 LTS (supported to April 2027) remains pinned until then. |
| UPG-02 | Tailwind CSS 4 | Removes the remaining build-time `npm audit` findings (braces, micromatch, postcss-selector-parser) that have no non-breaking fix. Breaking styling/config migration; requires visual regression review on desktop and Android. |

CI policy: the dependency audit gate fails on critical findings only; high and moderate findings continue to be reported on every run.

## Owner decisions 2026-10-10 (Phase 1)

| ID | Decision / status | Details |
|---|---|---|
| PERM-01 | Implemented | Customer tax-exempt status and credit limit can be changed only by owner, administrator, manager and accounting (`customers.tax_terms`). Accounting uses `PATCH /api/customers/:id/tax-terms`, which accepts only those two fields. Advisors, support, technicians and auditors cannot. The same rule applies to third-party payer tax-exempt status. |
| PERM-02 | Implemented | Warranty claim costs are internal costs: visible only to roles with `costs.read` (owner, administrator, manager, accounting, auditor). Hidden from advisors, support and technicians. No screen displayed them. |
| MAIL-01 | Implemented | Rendered email copies are classified. Copies addressed only to the internal test mailbox (all copies today) are temporary: `emails/test-copies/`, kept 30 days by default (`EMAIL_TEST_COPY_RETENTION_DAYS`). Copies sent to any customer address are business records: `emails/sent-records/`, never deleted automatically. Copies saved before this change stay where they are and are never deleted automatically. Invoices, estimates and delivery attempts in the database are the authoritative record and are never pruned. When real customer delivery is built, decide the archive and retention period for sent records with the accountant. |
| FONT-01 | Deferred; appearance unchanged | The Satoshi heading font still loads from Fontshare (allowed in the CSP). It is under the ITF Free Font License (FFL, v2.0, 17 Aug 2026), not an open-source licence. Fontshare offers an offline kit "for self-hosting", but secondary sources disagree on whether serving the files from our own server is allowed. Before self-hosting: download the family from fontshare.com, read the licence's "Limitations of Usage" and "Embedding" sections, keep the licence file with the fonts, add `@font-face` for weights 400/500/700/900, remove the Fontshare link and its CSP allowance, and confirm visually that nothing changes. Until then Fontshare sees visitors' IP addresses when the app loads. |
| HOST-01 | Provisional: DigitalOcean | Do not purchase or deploy yet. Final decision in Phase 4 after a ~40 simultaneous-user performance test. Planned shape: one VPS with persistent disk, Caddy (automatic HTTPS) in front, `HOST=127.0.0.1`, `TRUST_PROXY=loopback`, firewall, automatic security updates, nightly encrypted off-site backups (`BACKUP-AND-RECOVERY.md`). |
| SEC-02 | Required before production launch | An independent human security review, arranged by the owner, before any real customer information is used. |

## Reproduce the reported incident without live data

Create an isolated fixture with two legacy line items, totals $150 and $80, stored subtotal $230, tax $13.80 and total $243.80. In the latest version the estimate/invoice summary must show $230 unclassified, not $0 labor plus $0 materials without explanation.

For mixed records, classified labor plus non-labor plus unclassified charges must reconcile to the stored subtotal. If line totals and the stored subtotal disagree, show an explicit difference; do not manufacture missing lines or silently recalculate issued amounts.

## Definition of a dependable first release

Freeze nonessential feature expansion. Stabilize one complete customer-to-payment workflow for each service and each relevant role, approve the tax/compensation rules, prove backup restoration, and independently audit customer-data security before production use. Keep every unresolved item visible rather than describing a preview as fully fixed.
