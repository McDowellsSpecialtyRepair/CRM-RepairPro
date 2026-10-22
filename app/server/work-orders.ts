import type { Express } from "express";
import { createHash } from "node:crypto";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail, createEstimateSafe, updateEstimateSafe, editableEstimate } from "./billing";
import { validDate } from "../shared/reporting";
import { hasPermission } from "../shared/security";
import { localToday } from "../shared/operations";
import { salesTeam } from "./estimate-sales";

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
  // People on an estimate or work order (A1): the estimator and the follow-up salesperson, alongside the
  // existing salesperson. Sales credit percentages stay in the separate sales team (no duplicate credit).
  for (const table of ["estimate_planning", "job_planning"]) {
    const cols = all(`PRAGMA table_info(${table})`).map(c => c.name);
    if (!cols.includes("estimator_id")) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN estimator_id INTEGER REFERENCES staff_accounts(id)`);
    if (!cols.includes("follow_up_id")) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN follow_up_id INTEGER REFERENCES staff_accounts(id)`);
  }
}

// Salesperson, estimator and follow-up salesperson choices: active owner, administrator, manager or
// service advisor (service writers use the Service advisor role).
const PEOPLE_ROLES = "('owner','admin','manager','advisor')";
const staffName = (id: number | null) => id ? one("SELECT id,full_name FROM staff_accounts WHERE id=?", id) : null;

// The earliest sensible schedule date is the day the estimate was created (Boise time). Scheduling earlier
// is allowed only when the person confirms it, for example when the estimate was written after the work had
// already started; the confirmation is recorded in the audit history.
export const EARLY_DATE_MESSAGE = "is before this estimate was created";
export function earliestScheduleDate(estimate: any, job: any) {
  const est = estimate || (job ? storage.getEstimates().filter((e: any) => e.jobId === job.id).sort((a: any, b: any) => a.id - b.id)[0] : null);
  const created = est?.createdAt || job?.createdAt;
  return created ? { date: localToday(new Date(created)), label: est ? `estimate ${est.estimateNumber}` : `work order ${job.jobNumber}` } : null;
}
export function checkScheduleDate(date: string | null, estimate: any, job: any, confirmed: unknown, context: any) {
  const earliest = date ? earliestScheduleDate(estimate, job) : null;
  if (!earliest || date! >= earliest.date) return;
  if (confirmed !== true) fail(`The date ${date} ${EARLY_DATE_MESSAGE} (${earliest.label} was created on ${earliest.date}). Check the date. If the work really started before the estimate was written, confirm that you want to use this date anyway.`, 409);
  audit("schedule.date_before_estimate_confirmed", context.kind, context.id, null, { date, estimateCreated: earliest.date, record: earliest.label });
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
  const estimator = staffName(extra?.estimator_id ?? null), followUp = staffName(extra?.follow_up_id ?? null);
  const value = {
    jobId: job?.id ?? null,
    scheduledDate: job ? job.scheduledDate : extra?.scheduled_date ?? null,
    assignedTechId: techId,
    assignedTech: tech?.name || job?.assignedTech || null,
    salesPersonId: sales?.id ?? null,
    salesPerson: sales?.full_name ?? null,
    estimatorId: estimator?.id ?? null,
    estimator: estimator?.full_name ?? null,
    followUpId: followUp?.id ?? null,
    followUp: followUp?.full_name ?? null,
    priority: job?.priority || extra?.priority || "normal",
    ...(job ? { title: job.title, description: job.description, status: job.status } : {}),
    slots,
  };
  // Two independent edit checks, so saving one box never blocks the other, and adding line items (which
  // changes the estimate's totals) does not count as someone else editing the planning or the people:
  //  - revision: schedule date, lead technician, urgency and the work order's own fields
  //  - peopleRevision: salespeople (with shares), estimator and follow-up salesperson
  const { salesPersonId, salesPerson, estimatorId, estimator: estName, followUpId, followUp: fuName, ...planned } = value as any;
  const team = estimate ? salesTeam(estimate.id).rows : [];
  const hash = (x: any) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
  return { ...value, salesTeam: team, revision: hash({ planned, jobId: job?.id ?? null }),
    peopleRevision: hash({ salesPersonId, estimatorId, followUpId, team }) };
}

// Once an estimate becomes a work order, its planning has one canonical home.
export function inheritEstimatePlanning(estimateId: number, jobId: number) {
  const p = one("SELECT * FROM estimate_planning WHERE estimate_id=?", estimateId);
  if (!p) return;
  const t = p.assigned_tech_id ? storage.getTechnician(p.assigned_tech_id) : null;
  storage.updateJob(jobId, { scheduledDate: p.scheduled_date, assignedTechId: t?.id ?? null, assignedTech: t?.name ?? null, priority: p.priority });
  sqlite.prepare("INSERT INTO job_planning(job_id,sales_person_id,estimator_id,follow_up_id) VALUES(?,?,?,?) ON CONFLICT(job_id) DO NOTHING").run(jobId, p.sales_person_id, p.estimator_id ?? null, p.follow_up_id ?? null);
  audit("planning.inherited", "jobs", jobId, null, { estimateId, ...planning("jobs", jobId) });
}

export function updatePlanning(kind: string, id: number, body: any) {
  return sqlite.transaction(() => {
    const { job } = resolve(kind, id);
    const before = planning(kind, id);
    const allowed = ["revision", "scheduledDate", "assignedTechId", "salesPersonId", "priority", "confirmEarlyDate", ...(job ? ["title", "description", "status"] : [])];
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) fail("Unexpected planning fields.");
    if (body.revision !== before.revision) fail("This record changed while you were editing. Reload the latest record before saving.", 409);
    const { confirmEarlyDate, ...changes } = body;
    const next = { ...before, ...changes };
    if (next.scheduledDate !== null && (typeof next.scheduledDate !== "string" || !validDate(next.scheduledDate))) fail("Enter a valid schedule date (YYYY-MM-DD) or clear it.");
    if (!priorities.includes(next.priority)) fail("Choose low, normal, high or urgent.");
    if (next.scheduledDate !== before.scheduledDate) checkScheduleDate(next.scheduledDate, kind === "estimates" ? storage.getEstimate(id) : null, job, confirmEarlyDate, { kind, id });
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

// The people on an estimate or work order can be changed by anyone who can edit it; scheduling permission is
// not needed. Every change is recorded in the audit history.
export function updatePeople(kind: string, id: number, body: any) {
  return sqlite.transaction(() => {
    const { job } = resolve(kind, id);
    const before: any = planning(kind, id);
    // On an estimate the salespeople (up to 3, with shares totalling 100%) are the sales team; the one with
    // the largest share is the lead salesperson shown elsewhere. A work order keeps one salesperson.
    const keys = kind === "estimates" ? ["salesTeam", "estimatorId", "followUpId"] : ["salesPersonId", "estimatorId", "followUpId"];
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => ![...keys, "revision"].includes(k))) fail("Unexpected fields.");
    if (body.revision !== before.peopleRevision) fail("Someone else changed the people on this record while you were editing. Reload to see their changes, then make yours again.", 409);
    const eligible = (staffId: any) => !!one(`SELECT id FROM staff_accounts WHERE id=? AND status='active' AND role IN ${PEOPLE_ROLES}`, staffId);
    const roleHint = "Service writers use the Service advisor role; a newly invited person appears once they have activated their login.";
    const next: any = { salesPersonId: before.salesPersonId, estimatorId: before.estimatorId, followUpId: before.followUpId, ...body };
    for (const [k, label] of [["estimatorId", "estimator"], ["followUpId", "follow-up salesperson"], ["salesPersonId", "salesperson"]] as const) {
      if (next[k] === undefined) continue;
      if (next[k] !== null && (!Number.isSafeInteger(next[k]) || next[k] <= 0)) fail(`Choose a valid ${label}.`);
      if (next[k] && next[k] !== before[k] && !eligible(next[k])) fail(`Choose an active staff member as ${label}. ${roleHint}`);
    }
    if (kind === "estimates" && body.salesTeam !== undefined) {
      const est = editableEstimate(id), team = body.salesTeam;
      if (!Array.isArray(team) || team.length > 3) fail("Choose up to 3 salespeople.");
      const seen = new Set<number>();
      for (const t of team) {
        if (!t || !Number.isSafeInteger(t.staffId) || t.staffId <= 0) fail("Choose a salesperson on every salesperson row, or remove the empty row.");
        if (seen.has(t.staffId)) fail("Each salesperson can be listed only once.");
        if (!Number.isInteger(t.shareBps) || t.shareBps <= 0 || t.shareBps > 10000) fail("Enter each salesperson's share as a percentage above 0 and up to 100.");
        if (!before.salesTeam.some((r: any) => r.staff_id === t.staffId) && !eligible(t.staffId)) fail(`Choose active staff as salespeople. ${roleHint}`);
        seen.add(t.staffId);
      }
      if (team.length && team.reduce((n: number, t: any) => n + t.shareBps, 0) !== 10000) fail("Salesperson shares must add up to exactly 100%.");
      sqlite.prepare("DELETE FROM estimate_sales_team WHERE estimate_id=?").run(est.id);
      for (const t of team) sqlite.prepare("INSERT INTO estimate_sales_team VALUES(?,?,?)").run(est.id, t.staffId, t.shareBps);
      const v = (one("SELECT version FROM estimate_sales_versions WHERE estimate_id=?", est.id)?.version || 1) + 1;
      sqlite.prepare("INSERT INTO estimate_sales_versions VALUES(?,?) ON CONFLICT(estimate_id) DO UPDATE SET version=excluded.version").run(est.id, v);
      // Sales credit is internal attribution, not a customer price or scope change, so it does not require
      // the customer to approve again (approved authorization policy, 2026-10-21).
      const lead = [...team].sort((a: any, b: any) => b.shareBps - a.shareBps)[0];
      next.salesPersonId = lead ? lead.staffId : null;
    }
    if (job) {
      sqlite.prepare(`INSERT INTO job_planning(job_id,sales_person_id,estimator_id,follow_up_id) VALUES(?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET sales_person_id=excluded.sales_person_id,estimator_id=excluded.estimator_id,follow_up_id=excluded.follow_up_id`)
        .run(job.id, next.salesPersonId, next.estimatorId, next.followUpId);
    } else {
      sqlite.prepare(`INSERT INTO estimate_planning(estimate_id,sales_person_id,estimator_id,follow_up_id) VALUES(?,?,?,?)
        ON CONFLICT(estimate_id) DO UPDATE SET sales_person_id=excluded.sales_person_id,estimator_id=excluded.estimator_id,follow_up_id=excluded.follow_up_id`)
        .run(id, next.salesPersonId, next.estimatorId, next.followUpId);
    }
    const after: any = planning(kind, id);
    const pick = (x: any) => ({ salesPersonId: x.salesPersonId, estimatorId: x.estimatorId, followUpId: x.followUpId, salesTeam: x.salesTeam });
    audit("people.updated", kind, id, pick(before), pick(after));
    return after;
  })();
}

export function registerWorkOrders(app: Express) {
  app.get("/api/people/staff", (_req, res) => res.json(all(`SELECT id,full_name AS name,role FROM staff_accounts WHERE status='active' AND role IN ${PEOPLE_ROLES} ORDER BY full_name,id`)));
  app.get("/api/planning/staff", (_req, res) => res.json(all("SELECT id,full_name AS name FROM staff_accounts WHERE status='active' AND role IN ('owner','admin','manager','advisor') ORDER BY full_name,id")));
  for (const kind of ["jobs", "estimates"]) {
    app.patch(`/api/${kind}/:id/people`, (req, res) => res.json(updatePeople(kind, Number(req.params.id), req.body)));
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
