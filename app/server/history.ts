import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { fail } from "./billing";
import { audit } from "./security";

// Readable change history for one customer, estimate or work order, built from the append-only audit log
// (every change records the staff login that made it). Shows who, when, what, and old -> new values.
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const parse = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

const EVENT_LABELS: Record<string, string> = {
  "record.insert": "Created", "record.update": "Changed", "record.delete": "Deleted",
  "people.updated": "People changed (salespeople, estimator, follow-up)", "planning.updated": "Work planning changed",
  "planning.inherited": "Planning copied from the estimate", "estimate.linked": "Estimate linked to the work order",
  "schedule.date_before_estimate_confirmed": "Early schedule date confirmed (before the estimate was created)",
  "marketing.updated": "Marketing tags (how they heard about us) changed", "referral.thanked": "Referral marked thanked",
  "referral.reopened": "Referral moved back to \"To thank\"", "estimate.sales_team_updated": "Sales team changed",
  "estimate.dents_billed_individually": "Dents added to the estimate",
};
const TABLE_LABELS: Record<string, string> = {
  customers: "Customer", contacts: "Contact", vehicles: "Vehicle", assets: "Item", estimates: "Estimate", estimate_line_items: "Line item",
  jobs: "Work order", invoices: "Invoice", payments: "Payment", estimate_dents: "Dent", schedule_slots: "Appointment", activities: "Activity",
};
const FIELD_LABELS: Record<string, string> = {
  first_name: "First name", last_name: "Last name", company_name: "Company", email: "Email", phone: "Phone", mobile: "Mobile",
  address: "Address", city: "City", state: "State", zip: "ZIP", referral_source: "Heard about us (customer record)", notes: "Notes",
  status: "Status", tax_exempt: "Tax exempt", credit_limit: "Credit limit", customer_type: "Customer type",
  discount: "Discount ($)", discount_basis: "Discount applies to", discount_code: "Discount code", discount_note: "Discount description", discount_percent: "Discount (% of labor)",
  tax_rate: "Tax rate", description: "Description", quantity: "Quantity", unit_price: "Unit price", total: "Total", title: "Title",
  scheduled_date: "Scheduled date", priority: "Urgency", assigned_tech: "Lead technician", vin: "VIN", year: "Year", make: "Make", model: "Model",
  salesPersonId: "Lead salesperson", estimatorId: "Estimator", followUpId: "Follow-up salesperson", salesTeam: "Salespeople",
  scheduledDate: "Scheduled date", assignedTechId: "Lead technician", source: "Heard about us from", referrer: "Referred by",
  thankYouStatus: "Thank-you", note: "Note", tags: "Tags",
};
// Bookkeeping fields that change on every save and say nothing to a reader.
const NOISE = new Set(["updated_at", "created_at", "version", "allocation_version", "subtotal", "tax_amount", "revision", "peopleRevision",
  "slots", "salesPerson", "unit_cost", "use_tax_rate", "tax_note", "cost", "cost_cents", "password_hash", "estimator", "followUp", "assignedTech", "jobId", "estimateId", "sourceId", "needsReferrer", "thankedAt", "thankedBy", "id"]);

const staffNames = () => new Map(all("SELECT id, full_name FROM staff_accounts").map(r => [r.id, r.full_name]));
function show(key: string, v: any, names: Map<number, string>): string {
  if (v === null || v === undefined || v === "") return "(blank)";
  if (["salesPersonId", "estimatorId", "followUpId"].includes(key)) return names.get(v) || `Staff #${v}`;
  if (key === "assignedTechId") return storage.getTechnician(v)?.name || `Technician #${v}`;
  if (key === "salesTeam" && Array.isArray(v)) return v.length ? v.map((t: any) => `${names.get(t.staff_id ?? t.staffId) || "Staff"} ${((t.share_bps ?? t.shareBps) / 100)}%`).join(", ") : "(none)";
  if (key === "referrer" && typeof v === "object") return [v.name, v.phone].filter(Boolean).join(" · ") || "(blank)";
  if (key === "status" && typeof v === "string") return v.replaceAll("_", " ");
  if (key === "thankYouStatus") return ({ to_thank: "waiting", thanked: "thanked", not_needed: "not needed" } as any)[v] || v;
  if (Array.isArray(v) && v.every(x => typeof x === "string")) return v.length ? v.join(", ") : "(none)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function changes(before: any, after: any, names: Map<number, string>) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const out: { field: string; from: string; to: string }[] = [];
  for (const k of Array.from(keys)) {
    if (NOISE.has(k) || k.endsWith("_json")) continue;
    const a = before?.[k], b = after?.[k];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    if (!before) { if (b === null || b === undefined || b === "") continue; out.push({ field: FIELD_LABELS[k] || k.replaceAll("_", " "), from: "", to: show(k, b, names) }); continue; }
    out.push({ field: FIELD_LABELS[k] || k.replaceAll("_", " "), from: show(k, a, names), to: show(k, b, names) });
  }
  return out;
}

function eventsFor(kind: string, id: number) {
  const sid = String(id);
  if (kind === "customers") {
    if (!storage.getCustomer(id)) fail("Customer not found.", 404);
    return all(`SELECT a.*, s.email AS actor_email FROM security_audit a LEFT JOIN staff_accounts s ON s.id=a.actor_id
      WHERE (a.entity='customers' AND a.record_id=?) OR (a.entity IN ('contacts','vehicles','assets') AND (json_extract(a.after_json,'$.customer_id')=? OR json_extract(a.before_json,'$.customer_id')=?))
      ORDER BY a.id DESC LIMIT 300`, sid, id, id);
  }
  if (kind === "estimates") {
    if (!storage.getEstimate(id)) fail("Estimate not found.", 404);
    return all(`SELECT a.*, s.email AS actor_email FROM security_audit a LEFT JOIN staff_accounts s ON s.id=a.actor_id
      WHERE (a.entity='estimates' AND a.record_id=?) OR (a.entity IN ('estimate_line_items','estimate_dents') AND (json_extract(a.after_json,'$.estimate_id')=? OR json_extract(a.before_json,'$.estimate_id')=?))
      ORDER BY a.id DESC LIMIT 300`, sid, id, id);
  }
  if (!storage.getJob(id)) fail("Work order not found.", 404);
  // A work order also shows the people, discount and marketing changes made on its linked estimates.
  const linked = JSON.stringify(storage.getEstimates().filter(e => e.jobId === id).map(e => String(e.id)));
  return all(`SELECT a.*, s.email AS actor_email FROM security_audit a LEFT JOIN staff_accounts s ON s.id=a.actor_id
    WHERE (a.entity='jobs' AND a.record_id=?) OR (a.entity='schedule_slots' AND (json_extract(a.after_json,'$.job_id')=? OR json_extract(a.before_json,'$.job_id')=?))
      OR (a.entity='estimates' AND a.record_id IN (SELECT value FROM json_each(?)))
    ORDER BY a.id DESC LIMIT 300`, sid, id, id, linked);
}

export function registerHistory(app: Express) {
  app.get("/api/history/:kind/:id", (req, res) => {
    const kind = req.params.kind, id = Number(req.params.id);
    if (!["customers", "estimates", "jobs"].includes(kind) || !Number.isSafeInteger(id)) fail("Unknown record.", 404);
    const names = staffNames();
    const rows = eventsFor(kind, id).map(r => {
      const before = parse(r.before_json), after = parse(r.after_json);
      const what = EVENT_LABELS[r.event] || r.event.replaceAll(/[._]/g, " ");
      const table = r.event.startsWith("record.") ? TABLE_LABELS[r.entity] || r.entity.replaceAll("_", " ") : "";
      return { id: r.id, at: r.occurred_at, by: r.actor_label, login: r.actor_email || null,
        what: table ? `${table} ${what.toLowerCase()}` : what, changes: changes(before, after, names) };
    }).filter(r => r.changes.length || !r.what.endsWith("changed"));
    audit("history.viewed", kind, id);
    res.json(rows);
  });
}
