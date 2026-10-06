// Read-only reporting contract. Money is aggregated in integer cents.
export type ReportSource = "invoices" | "payments" | "estimates" | "jobs" | "customers" | "campaigns";
export interface ReportConfig {
  source: ReportSource;
  start: string;
  end: string;
  group: string;
  status: string;
  customer: string;
  service: string;
  tech: string;
  search: string;
  metrics: string[];
  compare: boolean;
  formula?: { name: string; left: string; op: "+" | "-" | "*" | "/" | "%"; right: string };
}
export const REPORT_SOURCES: Record<ReportSource, { name: string; date: string; note: string; metrics: Record<string, { label: string; format: "money" | "number" | "percent" }>; groups: string[] }> = {
  invoices: { name: "Customer sales & receivables", date: "Invoice issue date", note: "Issued invoices only; drafts and voids excluded. Sales exclude tax. Collected and balance are current ledger totals on invoices issued in this period, not period cash flow. Service and technician come from the linked job/estimate. This is not a profit-and-loss statement.", metrics: {
    count: { label: "Invoices", format: "number" }, sales: { label: "Net billed sales", format: "money" }, tax: { label: "Sales tax", format: "money" }, gross: { label: "Invoice total", format: "money" }, collected: { label: "Recorded payments to date", format: "money" }, balance: { label: "Current balance", format: "money" }, average: { label: "Average net invoice", format: "money" },
  }, groups: ["customer", "service", "month", "date", "type", "tech", "status", "aging"] },
  payments: { name: "Cash collections", date: "Payment date", note: "Recorded payment ledger, including tax. Recording a payment does not verify bank settlement. No processor fees, refunds or bank reconciliation are captured in this report.", metrics: {
    count: { label: "Payments", format: "number" }, collected: { label: "Recorded collections", format: "money" }, average: { label: "Average payment", format: "money" },
  }, groups: ["date", "month", "customer", "service", "method", "type", "tech"] },
  estimates: { name: "Estimate conversion", date: "Estimate creation date (America/Boise)", note: "Creation-date cohort with current statuses. Approved includes invoiced estimates. Conversion is approved ÷ all estimates in the filtered cohort, not approval activity during the period.", metrics: {
    count: { label: "Estimates", format: "number" }, quoted: { label: "Quoted total incl. tax", format: "money" }, approved: { label: "Approved / invoiced", format: "number" }, conversion: { label: "Approval rate", format: "percent" }, average: { label: "Average quote", format: "money" },
  }, groups: ["customer", "service", "month", "date", "status", "type", "tech"] },
  jobs: { name: "Workload & technician output", date: "Job creation date (America/Boise)", note: "Creation-date cohort with current status and assigned technician. Job counts are not paid hours or payroll. Timecards, rates, commissions, expenses and taxes are not yet recorded.", metrics: {
    count: { label: "Jobs", format: "number" }, completed: { label: "Completed jobs", format: "number" }, completion: { label: "Completion rate", format: "percent" },
  }, groups: ["tech", "service", "status", "customer", "month", "date", "type"] },
  customers: { name: "Customer acquisition", date: "Customer creation date (America/Boise)", note: "Current customer records by creation date. Referral source is staff-entered, not verified marketing attribution. Merged source records are no longer counted separately.", metrics: {
    count: { label: "Customers", format: "number" }, active: { label: "Active customers", format: "number" }, reachable: { label: "With email or phone", format: "number" },
  }, groups: ["type", "source", "month", "date", "status"] },
  campaigns: { name: "Marketing activity", date: "Campaign start date; creation date if missing", note: "Stored, manually maintained campaign counters. Response rate = responses ÷ sent; conversion rate = conversions ÷ sent. Budget is planned, not actual spend. Attributed revenue and ROI are unavailable without delivery, spend and conversion integrations.", metrics: {
    count: { label: "Campaigns", format: "number" }, budget: { label: "Planned budget", format: "money" }, sent: { label: "Recorded sends", format: "number" }, responses: { label: "Recorded responses", format: "number" }, converted: { label: "Recorded conversions", format: "number" }, responseRate: { label: "Response rate", format: "percent" }, conversion: { label: "Conversion rate", format: "percent" },
  }, groups: ["campaign", "type", "status", "month", "date"] },
};
export const GROUP_LABELS: Record<string, string> = { none: "Grand total", customer: "Customer", service: "Service", month: "Month", date: "Day", type: "Customer / campaign type", tech: "Assigned technician", status: "Current status", aging: "Current aging bucket", method: "Payment method", source: "Referral source", campaign: "Campaign" };
export function defaultReport(source: ReportSource = "invoices"): ReportConfig {
  return { source, start: "", end: "", group: REPORT_SOURCES[source].groups[0], status: "", customer: "", service: "", tech: "", search: "", metrics: Object.keys(REPORT_SOURCES[source].metrics).slice(0, 4), compare: false };
}
export type ReportData = Record<ReportSource, any[]>;
const cents = (n: unknown) => Math.round(Number(n || 0) * 100);
const dateOnly = (s: unknown): string => {
  if (!s) return "";
  const text = String(s);
  if (/^\d{4}-\d\d-\d\d$/.test(text)) return validDate(text) ? text : "";
  const d = new Date(text);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Boise", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};
export function validDate(s: string) { return /^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
export function validateReport(c: ReportConfig) {
  if (!c || !Object.hasOwn(REPORT_SOURCES, c.source)) throw new Error("Choose a valid report source.");
  const def = REPORT_SOURCES[c.source];
  for (const key of ["start", "end", "group", "status", "customer", "service", "tech", "search"] as const)
    if (typeof c[key] !== "string" || c[key].length > 200) throw new Error(`Invalid ${key}.`);
  if ((c.start && !validDate(c.start)) || (c.end && !validDate(c.end))) throw new Error("Use valid calendar dates.");
  if (c.start && c.end && c.start > c.end) throw new Error("The start date must be before the end date.");
  if (c.group !== "none" && !def.groups.includes(c.group)) throw new Error("This grouping is not available for the selected source.");
  if (!Array.isArray(c.metrics) || !c.metrics.length || c.metrics.length > 12 || new Set(c.metrics).size !== c.metrics.length || c.metrics.some(m => !Object.hasOwn(def.metrics, m))) throw new Error("Select at least one valid, distinct measure.");
  if (typeof c.compare !== "boolean" || c.compare && (!c.start || !c.end)) throw new Error("Comparison needs both a start and end date.");
  if (c.formula) {
    const f = c.formula;
    if (!f.name?.trim() || f.name.length > 60 || !Object.hasOwn(def.metrics, f.left) || !Object.hasOwn(def.metrics, f.right) || !["+", "-", "*", "/", "%"].includes(f.op)) throw new Error("Choose valid calculation fields and an operator.");
    if (["+", "-"].includes(f.op) && def.metrics[f.left].format !== def.metrics[f.right].format) throw new Error("Addition and subtraction require measures with the same units.");
  }
}
export function previousPeriod(c: ReportConfig): ReportConfig {
  const duration = Date.parse(c.end) - Date.parse(c.start) + 86400000;
  return { ...c, start: new Date(Date.parse(c.start) - duration).toISOString().slice(0, 10), end: new Date(Date.parse(c.start) - 86400000).toISOString().slice(0, 10), compare: false };
}
export function runReport(c: ReportConfig, data: ReportData, now = new Date()) {
  validateReport(c);
  const customers = new Map(data.customers.map(x => [x.id, x]));
  const jobs = new Map(data.jobs.map(x => [x.id, x]));
  const estimates = new Map(data.estimates.map(x => [x.id, x]));
  const invoices = new Map(data.invoices.map(x => [x.id, x]));
  const paid = new Map<number, number>();
  data.payments.forEach(p => paid.set(p.invoiceId, (paid.get(p.invoiceId) || 0) + cents(p.amount)));
  const today = dateOnly(now.toISOString());
  let excluded = 0, missingDates = 0;
  const records = data[c.source].flatMap(r => {
    if (c.source === "invoices" && ["draft", "void"].includes(r.status)) { excluded++; return []; }
    const inv = c.source === "invoices" ? r : c.source === "payments" ? invoices.get(r.invoiceId) : null;
    const est = c.source === "estimates" ? r : estimates.get(inv?.estimateId);
    const job = c.source === "jobs" ? r : jobs.get(r.jobId || inv?.jobId || est?.jobId);
    const customer = c.source === "customers" ? r : customers.get(r.customerId);
    const customerName = customer?.companyName || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "Unlinked";
    const service = r.serviceType || job?.serviceType || est?.serviceType || "Unassigned";
    const tech = job?.assignedTech || "Unassigned";
    const date = dateOnly(c.source === "invoices" ? r.issueDate : c.source === "payments" ? r.paymentDate : c.source === "campaigns" ? (r.startDate || r.createdAt) : r.createdAt);
    if (!date) missingDates++;
    if (c.start && (!date || date < c.start) || c.end && (!date || date > c.end)) return [];
    if (c.status && c.status !== r.status || c.customer && String(customer?.id) !== c.customer || c.service && service !== c.service || c.tech && tech !== c.tech) return [];
    const reference = r.invoiceNumber || r.paymentNumber || r.estimateNumber || r.jobNumber || r.customerNumber || r.name || `#${r.id}`;
    if (c.search && !`${reference} ${customerName} ${service} ${tech} ${r.title || ""} ${r.name || ""}`.toLowerCase().includes(c.search.toLowerCase())) return [];
    const due = dateOnly(inv?.dueDate);
    const days = due ? Math.floor((Date.parse(today) - Date.parse(due)) / 86400000) : 0;
    const balance = inv ? cents(inv.total) - (paid.get(inv.id) || 0) : 0;
    const aging = balance <= 0 ? "Paid / no balance" : !due ? "No due date" : days <= 0 ? "Current" : days <= 30 ? "1–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "91+ days";
    const groups: Record<string, string> = { none: "All records", customer: `${customerName} (${customer?.customerNumber || customer?.id || "unlinked"})`, service, tech, month: date.slice(0, 7) || "No date", date: date || "No date", status: r.status || "Not applicable", type: r.customerType || r.campaignType || customer?.customerType || "Unknown", aging, method: r.paymentMethod || "Unknown", source: r.referralSource || "Not recorded", campaign: `${r.name} (#${r.id})` };
    const values: Record<string, number> = { count: 1 };
    if (c.source === "invoices") Object.assign(values, { sales: cents(r.subtotal) - cents(r.discount), tax: cents(r.taxAmount), gross: cents(r.total), collected: paid.get(r.id) || 0, balance });
    if (c.source === "payments") values.collected = cents(r.amount);
    if (c.source === "estimates") Object.assign(values, { quoted: cents(r.total), approved: ["approved", "invoiced"].includes(r.status) ? 1 : 0 });
    if (c.source === "jobs") values.completed = r.status === "completed" ? 1 : 0;
    if (c.source === "customers") Object.assign(values, { active: r.status === "active" ? 1 : 0, reachable: r.email || r.phone || r.mobile ? 1 : 0 });
    if (c.source === "campaigns") Object.assign(values, { budget: cents(r.budget), sent: Number(r.sentCount || 0), responses: Number(r.responseCount || 0), converted: Number(r.conversionCount || 0) });
    if (Object.values(values).some(v => !Number.isFinite(v))) throw new Error(`Record ${reference} contains invalid numeric data. Correct it before reporting.`);
    return [{ id: r.id, reference, date, customer: customerName, service, tech, status: r.status || "", group: groups[c.group], values }];
  });
  const aggregate = (rows: typeof records) => {
    const v: Record<string, number | null> = {};
    rows.forEach(r => Object.entries(r.values).forEach(([k, n]) => v[k] = (v[k] || 0) + n));
    Object.entries(REPORT_SOURCES[c.source].metrics).forEach(([k, m]) => { v[k] ??= 0; if (m.format === "money") v[k] = v[k]! / 100; });
    const ratio = (a: string, b: string, factor = 1) => v[b] ? v[a]! / v[b]! * factor : null;
    if (c.source === "invoices") v.average = ratio("sales", "count");
    if (c.source === "payments") v.average = ratio("collected", "count");
    if (c.source === "estimates") { v.average = ratio("quoted", "count"); v.conversion = ratio("approved", "count", 100); }
    if (c.source === "jobs") v.completion = ratio("completed", "count", 100);
    if (c.source === "campaigns") { v.responseRate = ratio("responses", "sent", 100); v.conversion = ratio("converted", "sent", 100); }
    if (c.formula) {
      const { left, right, op } = c.formula, a = v[left], b = v[right];
      v.calculated = a == null || b == null ? null : op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : b === 0 ? null : a / b * (op === "%" ? 100 : 1);
      if (v.calculated != null && !Number.isFinite(v.calculated)) v.calculated = null;
    }
    return v;
  };
  const grouped = new Map<string, typeof records>();
  records.forEach(r => { if (!grouped.has(r.group)) grouped.set(r.group, []); grouped.get(r.group)!.push(r); });
  return {
    rows: Array.from(grouped.entries()).map(([label, rows]) => ({ label, values: aggregate(rows) })).sort((a, b) => a.label.localeCompare(b.label)),
    totals: aggregate(records), count: records.length, records,
    generatedAt: now.toISOString(), agingAsOf: today,
    warnings: [
      ...(excluded ? [`${excluded} draft or void invoices excluded before filtering.`] : []),
      ...(missingDates ? [`${missingDates} records have no valid reporting date; date filters exclude them.`] : []),
      "Preview database data only. Access-controlled payroll and financial reporting require production authentication.",
    ],
  };
}
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  // Defend spreadsheet formula injection, including leading whitespace/control chars.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
