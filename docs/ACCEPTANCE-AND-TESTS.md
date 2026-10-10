# Acceptance and Test Strategy

Use expected business outcomes written before implementation as the acceptance authority. A passing test count alone cannot establish usability or financial correctness, and earlier tests missed an obvious legacy breakdown defect.

## Delivered runnable checks

From `app/` after installation/build:

```sh
node handoff/verify.mjs
node handoff/fresh-install-check.mjs
node handoff/security-check.mjs
npx tsx handoff/calculation-check.ts
```

These run in CI on every push (`.github/workflows/ci.yml`).

`fresh-install-check.mjs` confirms a production start on an empty database creates no demonstration data, accounts or default credentials, that restarts and `db:migrate` are idempotent, and that `db:seed-demo` refuses unsafe targets.

`verify.mjs` provisions a fresh temporary database (sample data loaded explicitly with `db:seed-demo`) and local owner, then exercises all nine services with customer, target, repair labor, material, freight-in, delivery, consumed supplies, internal use tax, technician split, salesperson attribution, approval, conversion, print and final payment. It rejects a mismatched service category, checks conversion retry safety, and checks physical/foreign-key integrity.

Its deliberately independent arithmetic is: $200 labor + $150 materials + $10 freight-in + $20 delivery = $380 subtotal; 6% of $160 taxable charges = $9.60; customer total $389.60. $10 consumed-supply cost at 6% yields $0.60 internal use tax, not an extra customer charge. Two technicians receive $120/$80 net labor, and the salesperson receives $380 sales attribution, not commission pay.

The calculation check covers legacy, mixed, missing and discrepant line breakdowns without requiring any database. This protects the latest summary-display fix, not historical tax classification.

## Existing source tests and limitations

`script/` retains the original tests as implementation evidence. They are not all portable or safe by default: several hardcode `/home/user/workspace`, ports, private fixture files, record IDs and output paths. Some generate or modify test data, and `workflow-setup.ts` copies a named operating database before overriding credentials on the copy.

Do not run a glob over all test files. Port each suite deliberately, require explicit local test paths, generate fresh fixtures, and fail closed if a production path is supplied. Earlier helpers also have different result shapes and some expect another helper to run first.

Useful areas to port include:

- **Estimate and billing:** `estimate-options-test.ts`, `estimate-service-test.ts`, `estimate-service-edge-test.ts`, `security-billing-test.ts`.
- **Roles and account safety:** `authorization-regression.ts`.
- **Operational integration:** `operations-test.ts`, `work-orders-test.ts`, `work-order-links-test.ts`.
- **Reports/pricing/layout:** `report-tests.ts`, `hail-reference-test.ts`, `sorting-test.ts`, `calendar-date-test.ts`.
- **Legacy UI incident:** `legacy-breakdown-test.ts`; its existing database loop assumes `data.db`, so the handoff calculation check is safer for initial use.

State Farm source comparison tests need the original source text/PDF, not just the transcribed constants. The PDF is not bundled as a redistributed document; obtain the source URL recorded in `shared/hail-reference.ts`, validate applicability, and archive evidence in the receiving team's authorized location.

## Browser acceptance required before signoff

| Scenario | Independent acceptance |
|---|---|
| New furniture estimate | No PDR/hail Quick Add or dent-size controls; enter fabric yards, labor, freight and internal cost without workarounds |
| All nine service types | Correct target, diagram, category list and template choices; no silent use of another service's prices |
| Legacy invoice | $230 legacy lines display $230 unclassified; recorded tax is visibly not revalidated; stored total and payment history unchanged |
| Mixed classification | Labor, non-labor, unknown and explicit discrepancy reconcile to subtotal on screen and print |
| Material edit | Customer price and purchase cost remain distinct; edited totals/tax update correctly and approval is invalidated |
| Staff splits | Invalid percentages/duplicate people/stale edits fail safely; saved exact splits survive reload and invoice issue |
| Unsaved changes | Approve/send/convert cannot use unsaved or stale intended splits; cancel returns to the saved state |
| Double submission | Duplicate clicks/retries do not duplicate invoices or payments |
| Role boundaries | Advisor, technician, support and auditor cannot read or change unauthorized records/costs |
| Mobile | Complete each critical flow at 375px width and on the owner's Android device; inspect real taps, keyboard, scroll and dialogs |
| Printing | Long estimates and full catalog have readable multi-page output; no blank print, clipped totals or private costs |
| External failures | VIN timeout, disconnected messaging, payment webhook retries and QB failures never claim success |

## Release gates

Maintain reproducible bug fixtures, browser recordings or screenshots, and exact expected financial results. A developer other than the implementation author should review tax/financial invariants and security tests. Have the owner demonstrate real representative jobs and the accountant sign off on tax, adjustments and payroll inputs.

Define and run a 40-user workload, backup/restore drill, staged migration rollback, permission review and deployment smoke test. Until those gates pass, use the app as a development/staging system rather than the sole financial record.
