import type { Express } from "express";
import { createHash } from "node:crypto";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail, createEstimateSafe, updateEstimateSafe } from "./billing";
import { validDate } from "../shared/reporting";
import { hasPermission } from "../shared/security";
import { localToday } from "../shared/operations";

const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const priorities = ["low", "normal", "high", "urgent"];
const statuses = ["pending", "scheduled", "in_progress", "completed", "cancelled"];

// Batch-enrich lists, using exactly the same linked-job precedence as the editor.
export function estimatePlanningList() {
  const jobs = new Map(storage.getJobs().map(j => [j.id, j]));
  const techs = new Map(storage.getTechnicians().map(t => [t.id, t.name]));
  const plans = new Map(all("SELECT * FROM estimate_planning").map(p => [p.estimate_id, p]));
  return storage.getEstimates().map(e => {
    const job = e.jobId ? jobs.get(e.jobId) : null, p = plans.get(e.id);
    const techId = job ? job.assignedTechId : p?.assigned_tech_id;
    return { ...e, scheduledDate: job ? job.scheduledDate : p?.scheduled_date ?? null,
      assignedTechId: techId ?? null, assignedTech: (techId ? techs.get(techId) : null) || job?.assignedTech || null,
      priority: job?.priority || p?.priority || "normal" };
  });
}

export function migrateWorkOrders() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS job_planning (
      job_id INTEGER PRIMARY KEY REFERENCES jobs(id),
      sales_person_id INTEGER REFERENCES staff_accounts(id)
    );
    CREATE TABLE IF NOT EXISTS estimate_planning (
      estimate_id INTEGER PRIMARY KEY REFERENCES estimates(id),
      scheduled_date TEXT, assigned_tech_id INTEGER REFERENCES technicians(id),
      sales_person_id INTEGER REFERENCES staff_accounts(id),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'))
    );
  `);
}

function resolve(kind: string, id: number) {
  const estimate = kind === "estimates" ? storage.getEstimate(id) : null;
  if (kind === "estimates" && !estimate) fail("Estimate not found.", 404);
  const job = kind === "jobs" ? storage.getJob(id) : estimate?.jobId ? storage.getJob(estimate.jobId) : null;
  if (kind === "jobs" && !job) fail("Work order not found.", 404);
  return { estimate, job };
}

export function planning(kind: string, id: number) {
  const { estimate, job } = resolve(kind, id);
  const extra = job
    ? one("SELECT * FROM job_planning WHERE job_id=?", job.id)
    : one("SELECT * FROM estimate_planning WHERE estimate_id=?", id);
  const slots = job ? storage.getScheduleSlots().filter(s => s.jobId === job.id && !["cancelled", "completed"].includes(s.status)) : [];
  const techId = job?.assignedTechId ?? extra?.assigned_tech_id ?? null;
  const tech = techId ? storage.getTechnician(techId) : null;
  const sales = extra?.sales_person_id ? one("SELECT id,full_name,status FROM staff_accounts WHERE id=?", extra.sales_person_id) : null;
  const value = {
    jobId: job?.id ?? null,
    scheduledDate: job ? job.scheduledDate : extra?.scheduled_date ?? null,
    assignedTechId: techId,
    assignedTech: tech?.name || job?.assignedTech || null,
    salesPersonId: sales?.id ?? null,
    salesPerson: sales?.full_name ?? null,
    priority: job?.priority || extra?.priority || "normal",
    ...(job ? { title: job.title, description: job.description, status: job.status } : {}),
    slots,
  };
  return { ...value, revision: createHash("sha256").update(JSON.stringify({ value, estimate, job, extra })).digest("hex") };
}

// Once an estimate becomes a work order, its planning has one canonical home.
export function inheritEstimatePlanning(estimateId: number, jobId: number) {
  const p = one("SELECT * FROM estimate_planning WHERE estimate_id=?", estimateId);
  if (!p) return;
  const t = p.assigned_tech_id ? storage.getTechnician(p.assigned_tech_id) : null;
  storage.updateJob(jobId, { scheduledDate: p.scheduled_date, assignedTechId: t?.id ?? null, assignedTech: t?.name ?? null, priority: p.priority });
  sqlite.prepare("INSERT INTO job_planning(job_id,sales_person_id) VALUES(?,?) ON CONFLICT(job_id) DO NOTHING").run(jobId, p.sales_person_id);
  audit("planning.inherited", "jobs", jobId, null, { estimateId, ...planning("jobs", jobId) });
}

export function updatePlanning(kind: string, id: number, body: any) {
  return sqlite.transaction(() => {
    const { job } = resolve(kind, id);
    const before = planning(kind, id);
    const allowed = ["revision", "scheduledDate", "assignedTechId", "salesPersonId", "priority", ...(job ? ["title", "description", "status"] : [])];
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) fail("Unexpected planning fields.");
    if (body.revision !== before.revision) fail("This record changed while you were editing. Reload the latest record before saving.", 409);
    const next = { ...before, ...body };
    if (next.scheduledDate !== null && (typeof next.scheduledDate !== "string" || !validDate(next.scheduledDate))) fail("Enter a valid schedule date (YYYY-MM-DD) or clear it.");
    if (!priorities.includes(next.priority)) fail("Choose low, normal, high or urgent.");
    for (const key of ["assignedTechId", "salesPersonId"]) if (next[key] !== null && (!Number.isSafeInteger(next[key]) || next[key] <= 0)) fail("Select a valid staff member.");
    const t = next.assignedTechId ? storage.getTechnician(next.assignedTechId) : null;
    if (next.assignedTechId !== before.assignedTechId && next.assignedTechId && t?.status !== "active") fail("Choose an active technician.");
    if (next.salesPersonId !== before.salesPersonId && next.salesPersonId &&
      !one("SELECT id FROM staff_accounts WHERE id=? AND status='active' AND role IN ('owner','admin','manager','advisor')", next.salesPersonId)) fail("Choose an active salesperson or service advisor.");
    if (job) {
      if (typeof next.title !== "string" || !next.title.trim() || next.title.length > 250) fail("Work order title is required (maximum 250 characters).");
      if (next.description !== null && (typeof next.description !== "string" || next.description.length > 10000)) fail("Description must be at most 10,000 characters.");
      if (!statuses.includes(next.status)) fail("Choose a valid work order status.");
      const scheduleChanged = next.scheduledDate !== before.scheduledDate || next.assignedTechId !== before.assignedTechId;
      if (before.slots.length && scheduleChanged) fail("This job has calendar appointments. Cancel and rebook those appointments in Scheduling before changing its planned date or lead technician.", 409);
      if (before.slots.length && next.status === "cancelled" && next.status !== before.status) fail("Cancel the active calendar appointments before cancelling this work order.", 409);
      storage.updateJob(job.id, { title: next.title.trim(), description: next.description, status: next.status,
        scheduledDate: next.scheduledDate, assignedTechId: next.assignedTechId,
        assignedTech: t?.name ?? (next.assignedTechId === before.assignedTechId ? before.assignedTech : null), priority: next.priority,
        ...(next.status !== before.status ? { completedDate: next.status === "completed" ? localToday() : null } : {}) });
      sqlite.prepare("INSERT INTO job_planning(job_id,sales_person_id) VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET sales_person_id=excluded.sales_person_id").run(job.id, next.salesPersonId);
    } else {
      sqlite.prepare(`INSERT INTO estimate_planning(estimate_id,scheduled_date,assigned_tech_id,sales_person_id,priority) VALUES(?,?,?,?,?)
        ON CONFLICT(estimate_id) DO UPDATE SET scheduled_date=excluded.scheduled_date,assigned_tech_id=excluded.assigned_tech_id,sales_person_id=excluded.sales_person_id,priority=excluded.priority`)
        .run(id, next.scheduledDate, next.assignedTechId, next.salesPersonId, next.priority);
    }
    const after = planning(kind, id);
    audit("planning.updated", kind, id, before, after);
    return after;
  })();
}

export function registerWorkOrders(app: Express) {
  app.get("/api/planning/staff", (_req, res) => res.json(all("SELECT id,full_name AS name FROM staff_accounts WHERE status='active' AND role IN ('owner','admin','manager','advisor') ORDER BY full_name,id")));
  for (const kind of ["jobs", "estimates"]) {
    app.get(`/api/${kind}/:id/planning`, (req, res) => res.json(planning(kind, Number(req.params.id))));
    app.patch(`/api/${kind}/:id/planning`, (req, res) => {
      const p = planning(kind, Number(req.params.id));
      if (p.jobId && !hasPermission(res.locals.staff.role, "jobs.write")) fail("Your role cannot edit linked work orders.", 403);
      if (!hasPermission(res.locals.staff.role, "schedule.write")) fail("Scheduling permission is required.", 403);
      res.json(updatePlanning(kind, Number(req.params.id), req.body));
    });
  }
  app.get("/api/jobs/:id/detail", (req, res) => {
    const id = Number(req.params.id), job = storage.getJob(id);
    if (!job) fail("Work order not found.", 404);
    const role = res.locals.staff.role;
    const estimates = storage.getEstimates().filter(e => e.jobId === id).map(e => ({
      id: e.id, estimateNumber: e.estimateNumber, status: e.status, notes: e.notes,
      ...(hasPermission(role, "estimates.read") ? { total: e.total } : {}),
      lineItems: storage.getEstimateLineItems(e.id).map(l => hasPermission(role, "estimates.read") ? l : { id: l.id, description: l.description, quantity: l.quantity, unit: l.unit, lineType: l.lineType, panelLocation: l.panelLocation }),
    }));
    res.json({ ...job, customer: storage.getCustomer(job.customerId),
      vehicle: job.vehicleId ? storage.getVehicle(job.vehicleId) : null,
      asset: job.assetId ? storage.getAssets(job.customerId).find(a => a.id === job.assetId) : null,
      estimates, invoices: hasPermission(role, "billing.read") ? storage.getInvoices().filter(i => i.jobId === id) : [],
      production: one("SELECT id FROM ops_cases WHERE job_id=?", id)?.id ?? null });
  });
  app.post("/api/jobs/:id/estimate", (req, res) => {
    if (!hasPermission(res.locals.staff.role, "estimates.write")) fail("Estimate editing permission is required.", 403);
    res.json(sqlite.transaction(() => {
      const job = storage.getJob(Number(req.params.id));
      if (!job) fail("Work order not found.", 404);
      if (["cancelled", "completed"].includes(job.status)) fail("Create estimates only for an open work order.", 409);
      const existing = storage.getEstimates().find(e => e.jobId === job.id && !["rejected", "expired"].includes(e.status));
      return existing || createEstimateSafe({ customerId: job.customerId, vehicleId: job.vehicleId, assetId: job.assetId,
        jobId: job.id, serviceType: job.serviceType, notes: job.description || job.title });
    })());
  });
  app.post("/api/jobs/:id/link-estimate", (req, res) => {
    if (!hasPermission(res.locals.staff.role, "estimates.write")) fail("Estimate editing permission is required.", 403);
    res.json(sqlite.transaction(() => {
      const job = storage.getJob(Number(req.params.id));
      const e = storage.getEstimate(req.body?.estimateId);
      if (!job || !e) fail("Choose an existing work order and estimate.", 404);
      if (["cancelled", "completed"].includes(job.status)) fail("Only open work orders can receive an estimate.", 409);
      if (e.jobId === job.id) return e;
      if (e.jobId || e.invoiceId || !["draft", "sent", "approved"].includes(e.status) || one("SELECT id FROM ops_cases WHERE estimate_id=?", e.id))
        fail("Choose an unlinked, uninvoiced estimate that has not started production.", 409);
      if (job.customerId !== e.customerId || job.serviceType !== e.serviceType || job.vehicleId !== e.vehicleId || job.assetId !== e.assetId)
        fail("Estimate must match this customer, service and repair item.");
      if (storage.getEstimates().some(other => other.jobId === job.id && !["rejected", "expired"].includes(other.status)))
        fail("This job already has an active estimate. Review it before linking another.", 409);
      const linked = updateEstimateSafe(e.id, { jobId: job.id });
      audit("estimate.linked", "jobs", job.id, { estimateId: null }, { estimateId: e.id, previousStatus: e.status, status: linked.status });
      return linked;
    })());
  });
}
