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
| SEC-01 | Unverified readiness, P0 before live launch | Staff access exists, but production threat model, infrastructure hardening, recovery and access review are not independently certified. | Validate role boundaries, row access, sessions, reset/invite flows, rate limits, auditing, secure backups, TLS and incident recovery. |
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
| PRICE-01 | Pricing provenance | Source-backed State Farm cells coexist with unverified legacy insurer data. Other carriers must not inherit State Farm values. Obtain current applicable agreements and record provenance/approval; review Quick Add labor-only assumptions. |
| UI-01 | Role and workflow consistency | Some UI controls rely on backend denial rather than clear disabled/read-only states. Verify all roles and unsaved edits across every editor. |
| MAINT-01 | Dependencies / bundles | Phase 0: unused packages removed, non-breaking audit fixes applied (critical `proxy-addr` fixed), Node 22 LTS pinned. Remaining: build-time Tailwind CSS 3 audit findings with no non-breaking fix, deprecated `prebuild-install`/Recharts 2 warnings, large client bundle, and a `better-sqlite3` major upgrade before Node 24. A successful build is not a security audit. |

## Reproduce the reported incident without live data

Create an isolated fixture with two legacy line items, totals $150 and $80, stored subtotal $230, tax $13.80 and total $243.80. In the latest version the estimate/invoice summary must show $230 unclassified, not $0 labor plus $0 materials without explanation.

For mixed records, classified labor plus non-labor plus unclassified charges must reconcile to the stored subtotal. If line totals and the stored subtotal disagree, show an explicit difference; do not manufacture missing lines or silently recalculate issued amounts.

## Definition of a dependable first release

Freeze nonessential feature expansion. Stabilize one complete customer-to-payment workflow for each service and each relevant role, approve the tax/compensation rules, prove backup restoration, and independently audit customer-data security before production use. Keep every unresolved item visible rather than describing a preview as fully fixed.
