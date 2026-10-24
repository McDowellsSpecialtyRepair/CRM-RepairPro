import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail } from "./billing";
import { scheduleJobDetails, scheduleEstimateDetails } from "./schedule-details";
import { localToday } from "../shared/operations";

// Callbacks (as in RoadFS): dated follow-ups on an estimate or work order, each with a type that management
// keeps, optionally assigned to a person. Each type is its own list. Parts types ("parts to order",
// "researching parts", "awaiting parts") mean the job is not ready to schedule until they are done; when the
// last one is done the job shows as "Ready to schedule". The waiting list shows every sold job not yet booked.
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const now = () => new Date().toISOString();

// Starting types: the owner's RoadFS callback types (2026-10-23), with the per-person types (Jenn, John, Josh,
// Megan, Stacy, Torson, SB, Frog) folded into one type plus an assigned person.
const STARTING_TYPES: [string, boolean][] = [
  ["Parts To Order", true], ["Researching Parts", true], ["Awaiting Parts", true], ["To Be Scheduled (TBS)", false],
  ["Estimate Follow-up", false], ["Hail Follow-up", false], ["Insurance Awaiting Approval", false], ["Insurance Claims Follow-up", false],
  ["In Progress Follow-up", false], ["Active Work Order & Estimate Follow-up", false], ["Customer Follow-up", false],
  ["Warranty", false], ["Appointment Reminder", false], ["Book Check Out", false],
];

export function migrateCallbacks() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS callback_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 80),
      parts INTEGER NOT NULL DEFAULT 0 CHECK(parts IN (0,1)),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS callbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_kind TEXT NOT NULL CHECK(record_kind IN ('estimates','jobs')),
      record_id INTEGER NOT NULL,
      type_id INTEGER NOT NULL REFERENCES callback_types(id),
      due_date TEXT NOT NULL CHECK(due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      assigned_staff_id INTEGER REFERENCES staff_accounts(id),
      note TEXT CHECK(note IS NULL OR length(note) <= 1000),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
      done_at TEXT, done_by TEXT, done_note TEXT CHECK(done_note IS NULL OR length(done_note) <= 1000),
      created_at TEXT NOT NULL, created_by TEXT
    );
    CREATE INDEX IF NOT EXISTS callbacks_open ON callbacks(status, due_date);
    CREATE INDEX IF NOT EXISTS callbacks_record ON callbacks(record_kind, record_id);
  `);
  if (!one("SELECT id FROM callback_types LIMIT 1")) {
    const ins = sqlite.prepare("INSERT INTO callback_types(name,parts,sort_order,created_at,updated_at) VALUES(?,?,?,?,?)");
    STARTING_TYPES.forEach(([n, parts], i) => ins.run(n, parts ? 1 : 0, (i + 1) * 10, now(), now()));
  }
}

const typeShape = (r: any) => r && ({ id: r.id, name: r.name, parts: !!r.parts, active: !!r.active, sortOrder: r.sort_order });
const staffName = (id: number | null) => id ? (one("SELECT full_name FROM staff_accounts WHERE id=?", id)?.full_name ?? null) : null;
const label = (kind: string, id: number) => kind === "jobs" ? storage.getJob(id)?.jobNumber : storage.getEstimate(id)?.estimateNumber;
function shape(r: any) {
  const t = one("SELECT * FROM callback_types WHERE id=?", r.type_id);
  return { id: r.id, recordKind: r.record_kind, recordId: r.record_id, record: label(r.record_kind, r.record_id) || null,
    type: t?.name ?? null, typeId: r.type_id, parts: !!t?.parts, dueDate: r.due_date, assignedStaffId: r.assigned_staff_id,
    assignedTo: staffName(r.assigned_staff_id), note: r.note, status: r.status, doneAt: r.done_at, doneBy: r.done_by, doneNote: r.done_note,
    createdAt: r.created_at, createdBy: r.created_by, overdue: r.status === "open" && r.due_date < localToday() };
}
// The callbacks that belong to a job: its own plus those on its linked estimates (and the reverse for an estimate).
function relatedKeys(kind: string, id: number): [string, number][] {
  if (kind === "jobs") return [["jobs", id], ...storage.getEstimates().filter(e => e.jobId === id).map(e => ["estimates", e.id] as [string, number])];
  const e = storage.getEstimate(id);
  return [["estimates", id], ...(e?.jobId ? [["jobs", e.jobId] as [string, number]] : [])];
}
const forRecord = (kind: string, id: number) => relatedKeys(kind, id).flatMap(([k, i]) => all("SELECT * FROM callbacks WHERE record_kind=? AND record_id=? ORDER BY status='done', due_date, id", k, i));
export const partsOutstanding = (kind: string, id: number) => forRecord(kind, id).some(r => r.status === "open" && one("SELECT parts FROM callback_types WHERE id=?", r.type_id)?.parts);

function validDay(v: any) { if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T12:00:00Z"))) fail("Choose a callback date."); return v; }
function staffOk(v: any) {
  if (v == null) return null;
  if (!Number.isSafeInteger(v) || !one("SELECT id FROM staff_accounts WHERE id=? AND status='active'", v)) fail("Choose an active staff member to assign it to.");
  return v;
}

// Sold work not yet booked on the calendar: approved estimates without a work order, and open work orders
// without an active booking. Each shows its open callbacks and whether parts are still outstanding.
function waitingWork() {
  const rows: any[] = [];
  const add = (kind: "estimates" | "jobs", id: number, since: string | null, details: any, status: string) => {
    const cbs = forRecord(kind, id).filter(r => r.status === "open").map(shape);
    const lastPartsDone = forRecord(kind, id).filter(r => r.status === "done" && one("SELECT parts FROM callback_types WHERE id=?", r.type_id)?.parts).map(r => r.done_at).sort().pop() || null;
    const parts = cbs.some(c => c.parts);
    const state = parts ? "waiting_parts" : cbs.length ? "waiting_other" : "ready";
    rows.push({ kind, id, number: kind === "jobs" ? details?.jobNumber : details?.estimateNumbers?.[0], status, since, details, callbacks: cbs, state,
      partsArrivedAt: !parts ? lastPartsDone : null, daysWaiting: since ? Math.max(0, Math.round((Date.now() - Date.parse(since)) / 86400000)) : null });
  };
  for (const j of storage.getJobs()) {
    if (["completed", "cancelled"].includes(j.status)) continue;
    if (one("SELECT 1 FROM schedule_slots WHERE job_id=? AND status NOT IN ('cancelled','completed')", j.id)) continue;
    if (j.status === "in_progress") continue;
    add("jobs", j.id, j.createdAt, scheduleJobDetails(j.id), j.status);
  }
  for (const e of storage.getEstimates()) {
    if (e.status !== "approved" || e.jobId || e.invoiceId) continue;
    add("estimates", e.id, e.approvedDate || e.createdAt, scheduleEstimateDetails(e.id), e.status);
  }
  const order: Record<string, number> = { ready: 0, waiting_parts: 1, waiting_other: 2 };
  return rows.sort((a, b) => order[a.state] - order[b.state] || (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
}

export function registerCallbacks(app: Express) {
  app.get("/api/callback-types", (_req, res) => res.json(all("SELECT * FROM callback_types ORDER BY active DESC, sort_order, name").map(typeShape)));
  const validType = (b: any, existing?: any) => {
    const name = String(b.name ?? existing?.name ?? "").trim();
    if (!name || name.length > 80) fail("Enter a name of up to 80 characters.");
    const parts = b.parts === undefined ? !!existing?.parts : b.parts === true;
    const active = b.active === undefined ? (existing ? !!existing.active : true) : b.active === true;
    return { name, parts: parts ? 1 : 0, active: active ? 1 : 0 };
  };
  app.post("/api/callback-types", (req, res) => {
    const v = validType(req.body || {});
    if (one("SELECT id FROM callback_types WHERE name=?", v.name)) fail("That callback type already exists.", 409);
    const sort = (one("SELECT max(sort_order) m FROM callback_types")?.m || 0) + 10;
    const id = Number(sqlite.prepare("INSERT INTO callback_types(name,parts,active,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(v.name, v.parts, v.active, sort, now(), now()).lastInsertRowid);
    const after = typeShape(one("SELECT * FROM callback_types WHERE id=?", id));
    audit("callback_type.created", "callback_types", id, null, after);
    res.status(201).json(after);
  });
  app.patch("/api/callback-types/:id", (req, res) => {
    const id = Number(req.params.id), existing = one("SELECT * FROM callback_types WHERE id=?", id);
    if (!existing) fail("Callback type not found.", 404);
    const v = validType(req.body || {}, existing);
    if (one("SELECT id FROM callback_types WHERE name=? AND id<>?", v.name, id)) fail("That callback type already exists.", 409);
    sqlite.prepare("UPDATE callback_types SET name=?,parts=?,active=?,updated_at=? WHERE id=?").run(v.name, v.parts, v.active, now(), id);
    const after = typeShape(one("SELECT * FROM callback_types WHERE id=?", id));
    audit("callback_type.updated", "callback_types", id, typeShape(existing), after);
    res.json(after);
  });

  app.get("/api/callbacks", (req, res) => {
    const q = req.query, args: any[] = [], where: string[] = [];
    if (q.status !== "all") { where.push("status=?"); args.push(q.status === "done" ? "done" : "open"); }
    if (q.typeId) { where.push("type_id=?"); args.push(Number(q.typeId)); }
    if (q.assigned === "me") { where.push("assigned_staff_id=?"); args.push(res.locals.staff?.id); }
    else if (q.assigned === "none") where.push("assigned_staff_id IS NULL");
    else if (q.assigned) { where.push("assigned_staff_id=?"); args.push(Number(q.assigned)); }
    if (q.due === "overdue") { where.push("due_date<?"); args.push(localToday()); }
    if (q.due === "today") { where.push("due_date<=?"); args.push(localToday()); }
    res.json(all(`SELECT * FROM callbacks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY due_date, id LIMIT 500`, ...args).map(r => {
      const s = shape(r), d = r.record_kind === "jobs" ? scheduleJobDetails(r.record_id) : scheduleEstimateDetails(r.record_id);
      return { ...s, customer: d?.customer ?? null, phone: d?.phone ?? null, item: d?.item ?? null, service: d?.service ?? null };
    }));
  });
  for (const kind of ["estimates", "jobs"]) {
  app.get(`/api/${kind}/:id/callbacks`, (req, res) => {
    const id = Number(req.params.id);
    if (!(kind === "jobs" ? storage.getJob(id) : storage.getEstimate(id))) fail("Record not found.", 404);
    res.json({ callbacks: forRecord(kind, id).map(shape), partsOutstanding: partsOutstanding(kind, id) });
  });
  app.post(`/api/${kind}/:id/callbacks`, (req, res) => {
    const id = Number(req.params.id), b = req.body || {};
    if (Object.keys(b).some(k => !["typeId", "dueDate", "assignedStaffId", "note"].includes(k))) fail("Unexpected fields.");
    if (!(kind === "jobs" ? storage.getJob(id) : storage.getEstimate(id))) fail("Record not found.", 404);
    const t = one("SELECT * FROM callback_types WHERE id=? AND active=1", b.typeId);
    if (!t) fail("Choose a callback type.");
    const note = b.note == null ? null : String(b.note).trim().slice(0, 1000) || null;
    const cid = Number(sqlite.prepare("INSERT INTO callbacks(record_kind,record_id,type_id,due_date,assigned_staff_id,note,created_at,created_by) VALUES(?,?,?,?,?,?,?,?)")
      .run(kind, id, t.id, validDay(b.dueDate), staffOk(b.assignedStaffId), note, now(), res.locals.staff?.full_name || null).lastInsertRowid);
    const after = shape(one("SELECT * FROM callbacks WHERE id=?", cid));
    audit("callback.created", kind, id, null, { type: after.type, dueDate: after.dueDate, assignedTo: after.assignedTo, note: after.note });
    res.status(201).json(after);
  });
  }
  app.patch("/api/callbacks/:id", (req, res) => {
    const id = Number(req.params.id), b = req.body || {}, before = one("SELECT * FROM callbacks WHERE id=?", id);
    if (!before) fail("Callback not found.", 404);
    if (Object.keys(b).some(k => !["done", "doneNote", "dueDate", "assignedStaffId", "note"].includes(k))) fail("Unexpected fields.");
    const was = shape(before);
    sqlite.transaction(() => {
      if (b.dueDate !== undefined) sqlite.prepare("UPDATE callbacks SET due_date=? WHERE id=?").run(validDay(b.dueDate), id);
      if (b.assignedStaffId !== undefined) sqlite.prepare("UPDATE callbacks SET assigned_staff_id=? WHERE id=?").run(staffOk(b.assignedStaffId), id);
      if (b.note !== undefined) sqlite.prepare("UPDATE callbacks SET note=? WHERE id=?").run(b.note == null ? null : String(b.note).trim().slice(0, 1000) || null, id);
      if (b.done === true) sqlite.prepare("UPDATE callbacks SET status='done',done_at=?,done_by=?,done_note=? WHERE id=?").run(now(), res.locals.staff?.full_name || null, b.doneNote == null ? null : String(b.doneNote).trim().slice(0, 1000) || null, id);
      if (b.done === false) sqlite.prepare("UPDATE callbacks SET status='open',done_at=NULL,done_by=NULL,done_note=NULL WHERE id=?").run(id);
    })();
    const after = shape(one("SELECT * FROM callbacks WHERE id=?", id));
    const pick = (x: any) => ({ type: x.type, dueDate: x.dueDate, assignedTo: x.assignedTo, note: x.note, status: x.status, doneNote: x.doneNote });
    audit(b.done === true ? "callback.done" : "callback.updated", before.record_kind, before.record_id, pick(was), pick(after));
    // The last outstanding parts callback is done: the job is ready to schedule.
    const readyNow = was.parts && b.done === true && !partsOutstanding(before.record_kind, before.record_id);
    if (readyNow) audit("schedule.ready_parts_arrived", before.record_kind, before.record_id, null, { callback: after.type });
    res.json({ ...after, readyToSchedule: readyNow });
  });
  app.get("/api/waiting-work", (_req, res) => res.json(waitingWork()));
}
