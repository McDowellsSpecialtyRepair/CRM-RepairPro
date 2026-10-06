import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { defaultReport, runReport, validateReport, previousPeriod, csvCell, REPORT_SOURCES, type ReportData } from "../shared/reporting";
import { furnitureGeometry, FURNITURE_STYLES } from "../client/src/lib/furniture-geometry";
const results: { name: string; status: string }[] = [];
function test(name: string, fn: () => void) { try { fn(); results.push({ name, status: "PASS" }); } catch (e) { results.push({ name, status: `FAIL: ${e}` }); } }
const data: ReportData = {
  customers: [{ id: 1, customerNumber: "C1", companyName: "Same Name", customerType: "dealership", status: "active", email: "test@example.invalid", createdAt: "2026-09-01" }, { id: 2, customerNumber: "C2", companyName: "Same Name", customerType: "retail", status: "inactive", createdAt: "2026-09-02" }],
  jobs: [{ id: 1, customerId: 1, serviceType: "pdr", assignedTech: "Tech A", status: "completed", createdAt: "2026-09-10" }, { id: 2, customerId: 2, serviceType: "upholstery", status: "scheduled", createdAt: "2026-09-11" }],
  estimates: [{ id: 1, customerId: 1, jobId: 1, serviceType: "pdr", total: 106, status: "invoiced", createdAt: "2026-09-10" }, { id: 2, customerId: 2, total: 10.60, status: "draft", createdAt: "2026-09-11" }],
  invoices: [
    { id: 1, customerId: 1, jobId: 1, invoiceNumber: "INV1", subtotal: 110, discount: 10, taxAmount: 6, total: 106, amountPaid: 9999, balanceDue: 9999, issueDate: "2026-09-10", dueDate: "2026-08-01", status: "partial" },
    { id: 2, customerId: 2, jobId: 2, subtotal: 0.30, discount: 0, taxAmount: 0.02, total: 0.32, issueDate: "2026-09-11", dueDate: "2026-09-26", status: "sent" },
    { id: 3, customerId: 1, subtotal: 500, total: 530, taxAmount: 30, status: "draft", issueDate: "2026-09-12" },
    { id: 4, customerId: 1, subtotal: 500, total: 530, taxAmount: 30, status: "void", issueDate: "2026-09-12" },
  ],
  payments: [{ id: 1, invoiceId: 1, customerId: 1, amount: 20, paymentDate: "2026-09-11", paymentMethod: "cash" }, { id: 2, invoiceId: 1, customerId: 1, amount: 30, paymentDate: "2026-09-25", paymentMethod: "check" }],
  campaigns: [{ id: 1, name: "A", budget: 50, sentCount: 10, responseCount: 2, conversionCount: 1, startDate: "2026-09-01" }, { id: 2, name: "B", budget: 50, sentCount: 90, responseCount: 9, conversionCount: 9, startDate: "2026-09-02" }],
};
const now = new Date("2026-09-25T16:00:00Z");
const report = (patch: any = {}, source: any = "invoices", d = data) => runReport({ ...defaultReport(source), ...patch }, d, now);
test("Invoice totals use exact cents, exclude drafts/voids and discount once", () => assert.equal(report().totals.sales, 100.30));
test("Customer names do not merge distinct customers", () => assert.equal(report().rows.length, 2));
test("Invoice ledger avoids payment join multiplication", () => assert.equal(report().totals.gross, 106.32));
test("Payments authoritative, cached paid field ignored", () => assert.equal(report().totals.collected, 50));
test("Current outstanding uses ledger, not cached balance", () => assert.equal(report().totals.balance, 56.32));
test("Invoice amount = sales + tax", () => assert.equal(Math.round((report().totals.sales! + report().totals.tax!) * 100), 10632));
test("Invoice date inclusion is inclusive", () => assert.equal(report({ start: "2026-09-10", end: "2026-09-10" }).count, 1));
test("Payments filtered by payment date, not invoice date", () => assert.equal(report({ start: "2026-09-25", end: "2026-09-25" }, "payments").totals.collected, 30));
test("Customer filter", () => assert.equal(report({ customer: "2" }).totals.sales, .30));
test("Service filter follows job", () => assert.equal(report({ service: "pdr" }).count, 1));
test("Technician filter follows job", () => assert.equal(report({ tech: "Tech A" }).count, 1));
test("Unassigned technician explicitly selectable", () => assert.equal(report({ tech: "Unassigned" }).count, 1));
test("Case-insensitive search", () => assert.equal(report({ search: "inv1" }).count, 1));
test("Current status filter", () => assert.equal(report({ status: "partial" }).count, 1));
test("No matches yield zero totals and N/A average", () => { const r = report({ search: "nothing" }); assert.equal(r.count, 0); assert.equal(r.totals.sales, 0); assert.equal(r.totals.average, null); });
test("Current aging buckets use due date", () => assert.ok(report({ group: "aging" }).rows.some(r => r.label === "31–60 days")));
test("Weighted marketing rates do not average group percentages", () => assert.equal(report({}, "campaigns").totals.responseRate, 11));
test("Marketing conversion uses sends", () => assert.equal(report({}, "campaigns").totals.conversion, 10));
test("Estimates count invoiced as approved", () => assert.equal(report({}, "estimates").totals.conversion, 50));
test("Job completion is count-based, not fabricated payroll", () => assert.equal(report({}, "jobs").totals.completion, 50));
test("Customer reachability", () => assert.equal(report({}, "customers").totals.reachable, 1));
test("Calculated ratio recomputed on aggregate", () => assert.equal(report({ formula: { name: "Collected share", left: "collected", right: "gross", op: "%" } }).totals.calculated, 50 / 106.32 * 100));
test("Zero denominator produces N/A", () => assert.equal(report({ search: "none", formula: { name: "Rate", left: "sales", right: "count", op: "/" } }).totals.calculated, null));
for (const op of ["+", "-", "*", "/"] as const) test(`Calculation ${op}`, () => assert.equal(report({ formula: { name: "Calc", left: "count", right: "count", op } }).totals.calculated, ({ "+": 4, "-": 0, "*": 4, "/": 1 })[op]));
for (const patch of [{ source: "sql" }, { start: "2026-02-30" }, { start: "2026-09-30", end: "2026-09-01" }, { metrics: [] }, { metrics: ["count", "count"] }, { metrics: ["__proto__"] }, { metrics: ["payroll"] }, { group: "malicious" }, { compare: true }, { formula: { name: "Bad", left: "sales", right: "count", op: "+" } }, { formula: { name: "Bad", left: "count", right: "count", op: "eval" } }]) test(`Reject invalid config ${JSON.stringify(patch)}`, () => assert.throws(() => validateReport({ ...defaultReport(), ...patch } as any)));
test("Previous equal period across leap year", () => { const r = previousPeriod({ ...defaultReport(), start: "2024-03-01", end: "2024-03-02" }); assert.equal(r.start, "2024-02-28"); assert.equal(r.end, "2024-02-29"); });
test("UTC creation timestamp converted to Boise date", () => { const d = { ...data, customers: [{ ...data.customers[0], createdAt: "2026-09-02T01:00:00Z" }] }; assert.equal(report({ start: "2026-09-01", end: "2026-09-01" }, "customers", d).count, 1); });
test("Malformed date warned and excluded by date filter", () => { const d = { ...data, jobs: [{ ...data.jobs[0], createdAt: "junk" }] }; const r = report({ start: "2026-01-01" }, "jobs", d); assert.equal(r.count, 0); assert.ok(r.warnings.some(w => w.includes("valid reporting date"))); });
test("Invalid numeric data fails rather than implying zero", () => assert.throws(() => report({}, "campaigns", { ...data, campaigns: [{ ...data.campaigns[0], sentCount: "junk" }] })));
for (const s of ["=SUM(A1)", "+cmd", "-cmd", "@SUM(A1)", " \t=cmd", "\ttext", "\ntext"]) test(`CSV formula safety ${JSON.stringify(s)}`, () => assert.ok(csvCell(s).startsWith('"\'') ));
test("CSV quotes, commas and newlines escaped", () => assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"'));
for (const [source, def] of Object.entries(REPORT_SOURCES)) for (const group of ["none", ...def.groups]) test(`Report ${source}/${group} produces reconciled count`, () => { const r = report({ group }, source); assert.equal(r.rows.reduce((n, x) => n + x.values.count!, 0), r.totals.count); });
for (const [type, styles] of Object.entries(FURNITURE_STYLES)) for (const variant of Object.keys(styles).filter(v => v !== "classic")) {
  for (const view of ["front", "top", "back"]) test(`Geometry ${type}/${variant}/${view}`, () => {
    const panels = furnitureGeometry(type, variant, view);
    assert.ok(panels.length >= (type === "ottoman" && view === "top" ? 1 : 2)); assert.equal(panels.length, new Set(panels.map(p => p.id)).size);
    assert.ok(panels.every(p => p.d.startsWith("M ") && p.d.endsWith("Z") && Number.isFinite(p.labelX) && Number.isFinite(p.labelY)));
  });
  test(`Stable part IDs ${type}/${variant}`, () => {
    const front = furnitureGeometry(type, variant, "front"), top = furnitureGeometry(type, variant, "top");
    assert.ok(front.some(p => top.some(q => q.id === p.id && q.name === p.name)));
  });
}
test("10,000 invoices aggregate without row loss or cent drift", () => {
  const invoices = Array.from({ length: 10000 }, (_, i) => ({ ...data.invoices[1], id: i + 100, subtotal: .1, discount: 0, taxAmount: 0, total: .1 }));
  const r = report({}, "invoices", { ...data, invoices, payments: [] }); assert.equal(r.count, 10000); assert.equal(r.totals.sales, 1000);
});
writeFileSync("/home/user/workspace/recon-research/report-geometry-tests.json", JSON.stringify({ total: results.length, passed: results.filter(r => r.status === "PASS").length, tests: results }, null, 2));
console.log(JSON.stringify({ total: results.length, passed: results.filter(r => r.status === "PASS").length, failures: results.filter(r => r.status !== "PASS") }, null, 2));
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
