import type { Express } from "express";
import { inheritEstimatePlanning } from "./work-orders";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { fail, cents } from "./billing";
import {
  lineNetCents,
  requireAllocations,
  allocations,
  apportion,
} from "./labor";
import { audit } from "./security";
import {hasPermission, type Role} from "../shared/security";
import {
  DEPARTMENTS,
  HOLD_REASONS,
  departmentFor,
  localToday,
  addDays,
} from "../shared/operations";
const all = (sql: string, ...p: any[]) =>
  sqlite.prepare(sql).all(...p) as any[];
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const run = (sql: string, ...p: any[]) => sqlite.prepare(sql).run(...p);
const now = () => new Date().toISOString();
export function migrateOperations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ops_followups (
      id INTEGER PRIMARY KEY,estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id),
      owner_id INTEGER REFERENCES staff_accounts(id),next_date TEXT,last_contact TEXT,
      state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','deferred','lost','closed')),
      reason TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,
      presented_date TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ops_cases (
      id INTEGER PRIMARY KEY,estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id),
      job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),department TEXT NOT NULL,
      promised_date TEXT,forecast_date TEXT,hold_reason TEXT NOT NULL DEFAULT '',hold_since TEXT,
      parts_ready INTEGER NOT NULL DEFAULT 0 CHECK(parts_ready IN (0,1)),
      qc TEXT NOT NULL DEFAULT 'pending' CHECK(qc IN ('pending','pass','fail')),
      cost_complete INTEGER NOT NULL DEFAULT 0 CHECK(cost_complete IN (0,1)),
      created_at TEXT NOT NULL,completed_at TEXT,delivered_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS ops_tasks (
      id INTEGER PRIMARY KEY,case_id INTEGER NOT NULL REFERENCES ops_cases(id),source_line_id INTEGER NOT NULL REFERENCES estimate_line_items(id),
      description TEXT NOT NULL,line_type TEXT NOT NULL CHECK(line_type IN ('parts','labor')),
      net_cents INTEGER NOT NULL CHECK(net_cents>=0),estimated_minutes INTEGER CHECK(estimated_minutes>=0),
      standard_minutes INTEGER CHECK(standard_minutes>=0),completed_at TEXT,version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(case_id,source_line_id));
    CREATE TABLE IF NOT EXISTS ops_time (
      id INTEGER PRIMARY KEY,task_id INTEGER NOT NULL REFERENCES ops_tasks(id),technician_id INTEGER NOT NULL REFERENCES technicians(id),
      work_date TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>0 AND minutes<=1440),
      kind TEXT NOT NULL CHECK(kind IN ('productive','rework','travel')),note TEXT NOT NULL,
      retry_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ops_costs (
      id INTEGER PRIMARY KEY,case_id INTEGER NOT NULL REFERENCES ops_cases(id),
      kind TEXT NOT NULL CHECK(kind IN ('parts','technician_pay','subcontract','other')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents>0),note TEXT NOT NULL,
      retry_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS ops_followups_due ON ops_followups(next_date,state);
    CREATE INDEX IF NOT EXISTS ops_tasks_case ON ops_tasks(case_id);
    CREATE INDEX IF NOT EXISTS ops_time_task ON ops_time(task_id);
    CREATE TRIGGER IF NOT EXISTS ops_tasks_value_immutable BEFORE UPDATE OF net_cents,line_type,source_line_id,case_id ON ops_tasks BEGIN SELECT RAISE(ABORT,'Authorized production values are locked'); END;
    CREATE TRIGGER IF NOT EXISTS ops_time_no_update BEFORE UPDATE ON ops_time BEGIN SELECT RAISE(ABORT,'Time evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ops_time_no_delete BEFORE DELETE ON ops_time BEGIN SELECT RAISE(ABORT,'Time evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ops_costs_no_update BEFORE UPDATE ON ops_costs BEGIN SELECT RAISE(ABORT,'Cost evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ops_costs_no_delete BEFORE DELETE ON ops_costs BEGIN SELECT RAISE(ABORT,'Cost evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_line_no_add BEFORE INSERT ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=NEW.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; use a separate approved supplement'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_line_no_edit BEFORE UPDATE ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; estimate lines are locked'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_line_no_delete BEFORE DELETE ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; estimate lines are locked'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_financial_lock BEFORE UPDATE OF subtotal,tax_rate,tax_amount,discount,total ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id) AND (NEW.subtotal!=OLD.subtotal OR NEW.tax_rate!=OLD.tax_rate OR NEW.tax_amount!=OLD.tax_amount OR NEW.discount!=OLD.discount OR NEW.total!=OLD.total)
      BEGIN SELECT RAISE(ABORT,'Authorized production values are locked'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_status_lock BEFORE UPDATE OF status ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id) AND NEW.status NOT IN ('approved','invoiced')
      BEGIN SELECT RAISE(ABORT,'Production already authorized; cannot silently revoke approval'); END;
    CREATE TRIGGER IF NOT EXISTS ops_job_completion_guard BEFORE UPDATE OF status ON jobs
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id) AND
        (NEW.status='cancelled' OR (NEW.status='completed' AND
          EXISTS(SELECT 1 FROM ops_cases c WHERE c.job_id=OLD.id AND (c.qc!='pass' OR EXISTS(SELECT 1 FROM ops_tasks t WHERE t.case_id=c.id AND t.completed_at IS NULL)))))
      BEGIN SELECT RAISE(ABORT,'Complete all production tasks and pass QC; cancellation needs an approved adjustment'); END;
    CREATE TRIGGER IF NOT EXISTS ops_job_completed AFTER UPDATE OF status ON jobs WHEN NEW.status='completed' AND OLD.status!='completed'
      BEGIN UPDATE ops_cases SET completed_at=coalesce(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),version=version+1 WHERE job_id=NEW.id; END;
    CREATE TRIGGER IF NOT EXISTS ops_job_no_reopen BEFORE UPDATE OF status ON jobs
      WHEN OLD.status='completed' AND NEW.status!='completed' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Completed production is locked; use a separate repair or adjustment'); END;
    CREATE TRIGGER IF NOT EXISTS ops_job_start_readiness BEFORE UPDATE OF status ON jobs
      WHEN NEW.status='in_progress' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id AND (parts_ready=0 OR hold_reason!=''))
      BEGIN SELECT RAISE(ABORT,'Release holds and confirm materials readiness before starting'); END;
    CREATE TRIGGER IF NOT EXISTS ops_job_final_readiness BEFORE UPDATE OF status ON jobs
      WHEN NEW.status='completed' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id AND (parts_ready=0 OR hold_reason!=''))
      BEGIN SELECT RAISE(ABORT,'Release holds and confirm materials readiness before completion'); END;
    CREATE TRIGGER IF NOT EXISTS ops_estimate_job_lock BEFORE UPDATE OF job_id ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id AND job_id IS NOT NEW.job_id)
      BEGIN SELECT RAISE(ABORT,'Production work order association is locked'); END;
  `);
}
export function validDate(v: any, optional = false): string | null {
  if (optional && (v === "" || v == null)) return null;
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Use a valid YYYY-MM-DD date.");
  return v;
}
export function integer(v: any, min: number, max: number, label: string) {
  if (!Number.isInteger(v) || v < min || v > max)
    fail(`${label} is outside its allowed range.`);
  return v;
}
const text = (v: any, max = 2000) => {
  if (typeof v !== "string" || v.length > max) fail("Invalid text field.");
  return v.trim();
};
const keys = (b: any, allowed: string[]) => {
  if (
    !b ||
    typeof b !== "object" ||
    Array.isArray(b) ||
    Object.keys(b).some((k) => !allowed.includes(k))
  )
    fail("Unsupported fields.");
};
export const clientName = (c: any) =>
  c?.companyName ||
  [c?.firstName, c?.lastName].filter(Boolean).join(" ") ||
  "Unknown customer";
function visibleDetail(c:any,role:Role){return hasPermission(role,"costs.read")?c:{...c,costs:[]};}
function detail(id: number) {
  const c = one(
    "SELECT c.*,j.job_number,j.status,j.assigned_tech_id FROM ops_cases c JOIN jobs j ON j.id=c.job_id WHERE c.id=?",
    id,
  );
  if (!c) fail("Production record not found.", 404);
  const e = storage.getEstimate(c.estimate_id)!;
  return {
    ...c,
    estimateNumber: e.estimateNumber,
    customer: clientName(storage.getCustomer(e.customerId)),
    customerId: e.customerId,
    invoiceId: e.invoiceId,
    tasks: all(
      "SELECT t.*,coalesce((SELECT SUM(minutes) FROM ops_time WHERE task_id=t.id AND kind='productive'),0) actual_minutes FROM ops_tasks t WHERE case_id=? ORDER BY id",
      id,
    ),
    time: all(
      "SELECT w.*,t.name technician FROM ops_time w JOIN technicians t ON t.id=w.technician_id WHERE task_id IN(SELECT id FROM ops_tasks WHERE case_id=?) ORDER BY w.id DESC",
      id,
    ),
    costs: all("SELECT * FROM ops_costs WHERE case_id=? ORDER BY id DESC", id),
    laborAssignments: all(
      "SELECT a.technician_id,t.name, a.share_bps, w.id task_id,w.description FROM ops_tasks w JOIN estimate_labor_allocations a ON a.line_id=w.source_line_id JOIN technicians t ON t.id=a.technician_id WHERE w.case_id=? ORDER BY w.id,t.name",
      id,
    ),
  };
}
export function operationsDashboard(department = "") {
  const today = localToday();
  const customerMap = new Map(storage.getCustomers().map((c) => [c.id, c]));
  const followups = new Map(
    all(
      "SELECT f.*,s.full_name owner FROM ops_followups f LEFT JOIN staff_accounts s ON s.id=f.owner_id",
    ).map((f) => [f.estimate_id, f]),
  );
  const raw = all(
    "SELECT c.*,j.status,j.job_number,j.assigned_tech,j.assigned_tech_id,j.scheduled_date FROM ops_cases c JOIN jobs j ON j.id=c.job_id",
  );
  const estimateDepartment=(e:any)=>raw.find(c=>c.estimate_id===e?.id)?.department||departmentFor(e?.serviceType||"");
  const cases = raw
    .filter((c) => !department || c.department === department)
    .map((c) => {
      const e = storage.getEstimate(c.estimate_id)!;
      const tasks = all("SELECT * FROM ops_tasks WHERE case_id=?", c.id);
      const incomplete = tasks.filter((t) => !t.completed_at);
      const parts = tasks.filter((t) => t.line_type === "parts"),
        labor = tasks.filter((t) => t.line_type === "labor");
      const activeReservations = all(
        "SELECT id FROM schedule_slots WHERE job_id=? AND status NOT IN('cancelled','completed')",
        c.job_id,
      );
      const remaining = incomplete.reduce((s, t) => s + t.net_cents, 0);
      const stage =
        c.status === "completed"
          ? "completed"
          : c.hold_reason
            ? "on_hold"
            : c.status === "in_progress"
              ? "in_progress"
              : activeReservations.length
                ? "scheduled"
                : "unscheduled";
      return {
        ...c,
        estimateNumber: e.estimateNumber,
        customer: clientName(customerMap.get(e.customerId)),
        customerId: e.customerId,
        invoiceId: e.invoiceId,
        technicianNames: Array.from(
          new Set(
            labor.flatMap((t) =>
              allocations(t.source_line_id).map((a) => a.name),
            ),
          ),
        ).join(", "),
        remainingCents: remaining,
        totalCents: tasks.reduce((s, t) => s + t.net_cents, 0),
        partsCents: parts.reduce((s, t) => s + t.net_cents, 0),
        laborCents: labor.reduce((s, t) => s + t.net_cents, 0),
        remainingMinutes: incomplete.every((t) => t.estimated_minutes != null)
          ? incomplete.reduce((s, t) => s + t.estimated_minutes, 0)
          : null,
        incompleteTasks: incomplete.length,
        totalTasks: tasks.length,
        stage,
        late:
          !!c.promised_date &&
          c.promised_date < today &&
          c.status !== "completed",
        costsCents: one(
          "SELECT coalesce(SUM(amount_cents),0) n FROM ops_costs WHERE case_id=?",
          c.id,
        ).n,
      };
    });
  const estimates = storage
    .getEstimates()
    .filter((e) => !department || estimateDepartment(e) === department);
  const open = estimates
    .filter((e) => !["approved", "invoiced"].includes(e.status))
    .map((e) => {
      const f = followups.get(e.id);
      return {
        ...e,
        customer: clientName(customerMap.get(e.customerId)),
        department: departmentFor(e.serviceType),
        followup: f || null,
        due:
          !!f?.next_date &&
          f.next_date <= today &&
          !["lost", "closed"].includes(f.state),
        needsFollowup:
          !f?.next_date &&
          !["rejected", "expired"].includes(e.status) &&
          !["lost", "closed"].includes(f?.state),
        netCents: cents(e.subtotal) - cents(e.discount),
        ageDays: Math.floor(
          (Date.parse(today) - Date.parse(e.createdAt.slice(0, 10))) / 86400000,
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(b.due) - Number(a.due) ||
        (a.followup?.next_date || "9999").localeCompare(
          b.followup?.next_date || "9999",
        ),
    );
  const notTracked = estimates
    .filter(
      (e) =>
        ["approved", "invoiced"].includes(e.status) &&
        !raw.some((c) => c.estimate_id === e.id),
    )
    .map((e) => ({
      id: e.id,
      serviceType: e.serviceType,
      estimateNumber: e.estimateNumber,
      customer: clientName(customerMap.get(e.customerId)),
      status: e.status,
      netCents: cents(e.subtotal) - cents(e.discount),
      reason:
        e.status === "invoiced"
          ? "Legacy invoice: completion unknown"
          : "Approved: production tracking not started",
    }));
  const invoices = storage
    .getInvoices()
    .filter(
      (i) =>
        !["draft", "void"].includes(i.status) &&
        (!department ||
          estimateDepartment(storage.getEstimate(i.estimateId || 0)) === department),
    );
  const unpaid = invoices
    .filter((i) => i.balanceDue > 0)
    .map((i) => ({
      ...i,
      customer: clientName(customerMap.get(i.customerId)),
      overdue: !!i.dueDate && i.dueDate < today,
    }));
  const completed = cases.filter((c) => c.status === "completed"),
    timed = completed.filter((c) => c.completed_at && c.promised_date);
  const completeCosts = completed.filter((c) => c.cost_complete);
  const prod = one(
    "SELECT coalesce(SUM(w.minutes),0) n FROM ops_time w JOIN ops_tasks t ON t.id=w.task_id JOIN ops_cases c ON c.id=t.case_id WHERE w.kind='productive' AND (?='' OR c.department=?)",
    department,
    department,
  ).n;
  const rework = one(
    "SELECT coalesce(SUM(w.minutes),0) n FROM ops_time w JOIN ops_tasks t ON t.id=w.task_id JOIN ops_cases c ON c.id=t.case_id WHERE w.kind='rework' AND (?='' OR c.department=?)",
    department,
    department,
  ).n;
  const presented = estimates.filter(
    (e) => followups.get(e.id)?.presented_date,
  );
  const presentedApproved = presented.filter((e) =>
    ["approved", "invoiced"].includes(e.status),
  );
  const presentedValue = presented.reduce(
    (s, e) => s + cents(e.subtotal) - cents(e.discount),
    0,
  );
  const measuredTasks = all(
    "SELECT t.*,coalesce((SELECT SUM(minutes) FROM ops_time WHERE task_id=t.id AND kind='productive'),0) actual FROM ops_tasks t JOIN ops_cases c ON c.id=t.case_id WHERE t.line_type='labor' AND t.completed_at IS NOT NULL AND (?='' OR c.department=?)",
    department,
    department,
  );
  const efficiencyTasks = measuredTasks.filter(
    (t) => t.standard_minutes > 0 && t.actual > 0,
  );
  const technicianWork: any[] = [];
  for (const c of cases.filter((c) => c.stage !== "completed")) {
    for (const t of all(
      "SELECT * FROM ops_tasks WHERE case_id=? AND line_type='labor' AND completed_at IS NULL",
      c.id,
    )) {
      const split = allocations(t.source_line_id),
        shares = apportion(
          t.net_cents,
          split.map((a) => a.share_bps),
        );
      split.forEach((a, i) =>
        technicianWork.push({
          technicianId: a.technician_id,
          technician: a.name,
          caseId: c.id,
          jobNumber: c.job_number,
          customer: c.customer,
          department: c.department,
          stage: c.stage,
          task: t.description,
          remainingLaborCents: shares[i],
        }),
      );
    }
  }
  const cycle = completed
    .filter((c) => c.completed_at)
    .map(
      (c) => (Date.parse(c.completed_at) - Date.parse(c.created_at)) / 86400000,
    );
  const earliest = cases.length
    ? cases.map((c) => c.created_at.slice(0, 10)).sort()[0]
    : today;
  return {
    today,
    generatedAt: now(),
    department,
    open,
    cases,
    unpaid,
    notTracked,
    technicianWork,
    metrics: {
      followupsDue: open.filter((e) => e.due).length,
      needsFollowup: open.filter((e) => e.needsFollowup).length,
      remainingCents: cases.reduce((s, c) => s + c.remainingCents, 0),
      unscheduled: cases.filter((c) => c.stage === "unscheduled").length,
      inProgress: cases.filter((c) => c.stage === "in_progress").length,
      onHold: cases.filter((c) => c.stage === "on_hold").length,
      overdue: cases.filter((c) => c.late).length,
      completedUnbilled: completed.filter((c) => !c.invoiceId).length,
      unpaidCents: unpaid.reduce((s, i) => s + cents(i.balanceDue), 0),
      netInvoicedCents: invoices.reduce(
        (s, i) => s + cents(i.subtotal) - cents(i.discount),
        0,
      ),
      approvedCount: estimates.filter((e) =>
        ["approved", "invoiced"].includes(e.status),
      ).length,
      estimateCount: estimates.length,
      approvedRate: estimates.length
        ? (estimates.filter((e) => ["approved", "invoiced"].includes(e.status))
            .length /
            estimates.length) *
          100
        : null,
      onTimeRate: timed.length
        ? (timed.filter(
            (c) => localToday(new Date(c.completed_at)) <= c.promised_date,
          ).length /
            timed.length) *
          100
        : null,
      onTimeSample: timed.length,
      productiveMinutes: prod,
      reworkMinutes: rework,
      presentedCount: presented.length,
      presentedApprovalRate: presented.length
        ? (100 * presentedApproved.length) / presented.length
        : null,
      presentedValueRate:
        presentedValue > 0
          ? (100 *
              presentedApproved.reduce(
                (s, e) => s + cents(e.subtotal) - cents(e.discount),
                0,
              )) /
            presentedValue
          : null,
      efficiencyRate: efficiencyTasks.length
        ? (100 * efficiencyTasks.reduce((s, t) => s + t.standard_minutes, 0)) /
          efficiencyTasks.reduce((s, t) => s + t.actual, 0)
        : null,
      efficiencySample: efficiencyTasks.length,
      completedLaborTasks: measuredTasks.length,
      cycleDays: cycle.length
        ? cycle.reduce((s, n) => s + n, 0) / cycle.length
        : null,
      contributionCents: completeCosts.length
        ? completeCosts.reduce((s, c) => s + c.totalCents - c.costsCents, 0)
        : null,
      costSample: completeCosts.length,
      qcFailures: cases.filter((c) => c.qc === "fail").length,
      partsBlocked: cases.filter(
        (c) => !c.parts_ready && c.stage !== "completed",
      ).length,
    },
    period: {
      from: earliest,
      to: today,
      label:
        "Current queues; all-history invoice/estimate totals; production measures since tracking began",
    },
    limitations: [
      "Only enrolled production records contribute to unfinished-work value. Review untracked authorized records before using this as a full-company total.",
      "Approval rate uses all estimates, including drafts; it is not presented-to-customer sales conversion.",
      "Time and cost entries are manual evidence. Payroll, bank settlement and marketing ROI are not inferred.",
      "Cycle time starts at production enrollment, not historical customer drop-off.",
    ],
  };
}
export function registerOperations(app: Express) {
  app.get("/api/operations", (req, res) => {
    const d = String(req.query.department || "");
    if (d && !DEPARTMENTS.includes(d as any)) fail("Invalid department.");
    const result=sqlite.transaction(() => operationsDashboard(d))();
    if(!hasPermission(res.locals.staff.role,"costs.read")){
      for(const c of result.cases)delete (c as any).costsCents;
      result.metrics.contributionCents=null;result.metrics.costSample=0;
    }
    res.json(result);
  });
  app.get("/api/operations/owners", (_req, res) =>
    res.json(
      all(
        "SELECT id,full_name name,role FROM staff_accounts WHERE status='active' AND role IN('owner','admin','manager','advisor') ORDER BY full_name",
      ),
    ),
  );
  app.put("/api/operations/followups/:id", (req, res) => {
    keys(req.body, [
      "version",
      "ownerId",
      "nextDate",
      "state",
      "reason",
      "note",
      "contacted",
      "presentedDate",
    ]);
    const result = sqlite
      .transaction(() => {
        const e = storage.getEstimate(Number(req.params.id));
        if (!e) fail("Estimate not found.", 404);
        if (["approved", "invoiced"].includes(e.status))
          fail("Approved estimates leave the unsold follow-up queue.", 409);
        const old = one(
          "SELECT * FROM ops_followups WHERE estimate_id=?",
          e.id,
        );
        if ((old?.version || 0) !== req.body.version)
          fail("Follow-up changed. Refresh before saving.", 409);
        const owner =
          req.body.ownerId == null
            ? null
            : integer(req.body.ownerId, 1, 1e9, "Advisor");
        if (
          owner &&
          !one(
            "SELECT id FROM staff_accounts WHERE id=? AND status='active' AND role IN('owner','admin','manager','advisor')",
            owner,
          )
        )
          fail("Choose an active advisor.");
        if (!["open", "deferred", "lost", "closed"].includes(req.body.state))
          fail("Choose a follow-up state.");
        const next = validDate(req.body.nextDate, true),
          presented = validDate(req.body.presentedDate, true);
        if (presented && presented > localToday())
          fail("Presented date cannot be in the future.");
        const reason = text(req.body.reason || "", 250),
          note = text(req.body.note || "");
        if (["deferred", "lost"].includes(req.body.state) && !reason)
          fail("Record why this estimate was deferred or lost.");
        if (req.body.contacted !== true && req.body.contacted !== false)
          fail("Choose whether a contact actually occurred.");
        const last = req.body.contacted ? now() : old?.last_contact || null;
        run(
          `INSERT INTO ops_followups(estimate_id,owner_id,next_date,last_contact,state,reason,note,presented_date,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(estimate_id) DO UPDATE SET owner_id=excluded.owner_id,next_date=excluded.next_date,last_contact=excluded.last_contact,
        state=excluded.state,reason=excluded.reason,note=excluded.note,presented_date=excluded.presented_date,updated_at=excluded.updated_at,version=version+1`,
          e.id,
          owner,
          next,
          last,
          req.body.state,
          reason,
          note,
          presented,
          now(),
          now(),
        );
        if (req.body.contacted)
          storage.createActivity({
            customerId: e.customerId,
            estimateId: e.id,
            activityType: "note",
            description: `Advisor follow-up completed: ${note || reason || "Contact logged"}. Next: ${next || "not scheduled"}.`,
          });
        return one("SELECT * FROM ops_followups WHERE estimate_id=?", e.id);
      })
      .immediate();
    res.json(result);
  });
  app.post("/api/operations/start", (req, res) => {
    keys(req.body, ["estimateId", "department"]);
    const result = sqlite
      .transaction(() => {
        const e = storage.getEstimate(req.body.estimateId);
        if (!e) fail("Estimate not found.", 404);
        const prior = one("SELECT id FROM ops_cases WHERE estimate_id=?", e.id);
        if (prior) return detail(prior.id);
        if (e.status !== "approved" || e.invoiceId)
          fail(
            "Start with an approved, uninvoiced estimate. Historical invoices require separate review.",
            409,
          );
        const lines = storage.getEstimateLineItems(e.id);
        if (
          !lines.length ||
          lines.some(
            (l) => !["parts", "labor"].includes(l.lineType) || l.total < 0,
          )
        )
          fail("Review and classify estimate lines first.");
        lines.forEach(requireAllocations);
        if (!DEPARTMENTS.includes(req.body.department))
          fail("Choose a department.");
        let job = e.jobId ? storage.getJob(e.jobId) : undefined;
        if (
          job &&
          (job.customerId !== e.customerId ||
            ["completed", "cancelled"].includes(job.status))
        )
          fail("Linked job is not an open matching work order.", 409);
        if (job && one("SELECT id FROM ops_cases WHERE job_id=?", job.id))
          fail(
            "This job already has a production record. Use a separate job for a supplement.",
            409,
          );
        if (!job) {
          const n = one("SELECT coalesce(max(id),0)+1 n FROM jobs").n;
          job = storage.createJob({
            jobNumber: `RO-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`,
            customerId: e.customerId,
            vehicleId: e.vehicleId,
            assetId: e.assetId,
            serviceType: e.serviceType,
            title: `${e.estimateNumber} repair`,
            status: "pending",
          });
          storage.updateEstimate(e.id, { jobId: job.id });
          inheritEstimatePlanning(e.id, job.id);
        }
        const id = Number(
          run(
            "INSERT INTO ops_cases(estimate_id,job_id,department,created_at) VALUES(?,?,?,?)",
            e.id,
            job.id,
            req.body.department,
            now(),
          ).lastInsertRowid,
        );
        const net = lineNetCents(lines, e.discount);
        lines.forEach((l, i) =>
          run(
            "INSERT INTO ops_tasks(case_id,source_line_id,description,line_type,net_cents) VALUES(?,?,?,?,?)",
            id,
            l.id,
            l.description,
            l.lineType,
            net[i],
          ),
        );
        audit("production.started", "ops_cases", id, null, {
          estimateId: e.id,
          jobId: job.id,
        });
        return detail(id);
      })
      .immediate();
    res.status(201).json(visibleDetail(result,res.locals.staff.role));
  });
  app.get("/api/operations/cases/:id", (req, res) =>
    res.json(visibleDetail(detail(Number(req.params.id)),res.locals.staff.role)),
  );
  app.patch("/api/operations/cases/:id", (req, res) => {
    keys(req.body, [
      "version",
      "department",
      "promisedDate",
      "forecastDate",
      "holdReason",
      "partsReady",
      "qc",
      "costComplete",
      "notes",
      "action",
    ]);
    const result = sqlite
      .transaction(() => {
      const c = detail(Number(req.params.id)),
        b = req.body;
      if(b.costComplete!==!!c.cost_complete&&!hasPermission(res.locals.staff.role,"costs.write"))fail("Cost-review permission required.",403);
        if (c.version !== b.version)
          fail("Production record changed. Refresh and retry.", 409);
        if (
          !DEPARTMENTS.includes(b.department) ||
          !HOLD_REASONS.includes(b.holdReason) ||
          !["pending", "pass", "fail"].includes(b.qc)
        )
          fail("Invalid production status.");
        if (
          typeof b.partsReady !== "boolean" ||
          typeof b.costComplete !== "boolean"
        )
          fail("Choose valid readiness settings.");
        const promised = validDate(b.promisedDate, true),
          forecast = validDate(b.forecastDate, true),
          notes = text(b.notes || "");
        if (c.status === "completed" && (b.holdReason || b.qc !== "pass"))
          fail(
            "Completed work cannot acquire a hold or lose its QC signoff.",
            409,
          );
        if (b.qc === "pass" && c.tasks.some((t: any) => !t.completed_at))
          fail("Complete all priced tasks before passing QC.");
        if (b.costComplete && c.status !== "completed")
          fail("Finalize costs after completion.");
        if (c.cost_complete && !b.costComplete)
          fail(
            "Finalized costs cannot be reopened without an audited adjustment workflow.",
            409,
          );
        run(
          "UPDATE ops_cases SET department=?,promised_date=?,forecast_date=?,hold_reason=?,hold_since=?,parts_ready=?,qc=?,cost_complete=?,notes=?,version=version+1 WHERE id=?",
          b.department,
          promised,
          forecast,
          b.holdReason,
          b.holdReason
            ? c.hold_reason === b.holdReason
              ? c.hold_since
              : now()
            : null,
          b.partsReady ? 1 : 0,
          b.qc,
          b.costComplete ? 1 : 0,
          notes,
          c.id,
        );
        if (b.action === "start") {
          if (c.status === "completed" || !b.partsReady || b.holdReason)
            fail(
              "Release holds and confirm parts/materials ready before starting.",
              409,
            );
          storage.updateJob(c.job_id, { status: "in_progress" });
        } else if (b.action === "complete") {
          if (
            b.holdReason ||
            b.qc !== "pass" ||
            c.tasks.some((t: any) => !t.completed_at)
          )
            fail(
              "All tasks must be complete, holds released and QC passed.",
              409,
            );
          storage.updateJob(c.job_id, {
            status: "completed",
            completedDate: localToday(),
          });
        } else if (b.action === "deliver") {
          if (c.status !== "completed")
            fail("Complete production and QC before marking delivered.");
          run(
            "UPDATE ops_cases SET delivered_at=coalesce(delivered_at,?) WHERE id=?",
            now(),
            c.id,
          );
        } else if (b.action && b.action !== "save") fail("Invalid action.");
        return detail(c.id);
      })
      .immediate();
    res.json(visibleDetail(result,res.locals.staff.role));
  });
  app.patch("/api/operations/tasks/:id", (req, res) => {
    keys(req.body, [
      "version",
      "estimatedMinutes",
      "standardMinutes",
      "completed",
    ]);
    const result = sqlite
      .transaction(() => {
        const t = one(
          "SELECT * FROM ops_tasks WHERE id=?",
          Number(req.params.id),
        );
        if (!t) fail("Task not found.", 404);
        const c = detail(t.case_id);
        if (t.version !== req.body.version)
          fail("Task changed. Refresh before saving.", 409);
        if (c.status === "completed")
          fail("Completed production is locked.", 409);
        if (typeof req.body.completed !== "boolean")
          fail("Choose task completion.");
        if (req.body.completed && (c.hold_reason || !c.parts_ready))
          fail("Release holds and confirm materials ready first.");
        const estimated =
          req.body.estimatedMinutes == null
            ? null
            : integer(req.body.estimatedMinutes, 0, 1e6, "Estimated minutes");
        const standard =
          req.body.standardMinutes == null
            ? null
            : integer(
                req.body.standardMinutes,
                0,
                1e6,
                "Standard labor minutes",
              );
        if (t.line_type !== "labor" && standard)
          fail("Only labor has standard labor hours.");
        run(
          "UPDATE ops_tasks SET estimated_minutes=?,standard_minutes=?,completed_at=?,version=version+1 WHERE id=?",
          estimated,
          standard,
          req.body.completed ? t.completed_at || now() : null,
          t.id,
        );
        run(
          "UPDATE ops_cases SET qc='pending',version=version+1 WHERE id=?",
          c.id,
        );
        return detail(c.id);
      })
      .immediate();
    res.json(visibleDetail(result,res.locals.staff.role));
  });
  app.post("/api/operations/time", (req, res) => {
    keys(req.body, [
      "taskId",
      "technicianId",
      "workDate",
      "minutes",
      "kind",
      "note",
      "retryKey",
    ]);
    const b = req.body,
      task = one("SELECT id FROM ops_tasks WHERE id=?", b.taskId);
    if (!task) fail("Choose a task.");
    if (
      !one(
        "SELECT id FROM technicians WHERE id=? AND status='active'",
        b.technicianId,
      )
    )
      fail("Choose an active technician.");
    const date = validDate(b.workDate)!;
    if (date > localToday())
      fail("Actual work cannot be logged in the future.");
    integer(b.minutes, 1, 1440, "Minutes");
    if (!["productive", "rework", "travel"].includes(b.kind))
      fail("Choose work kind.");
    const note = text(b.note || ""),
      key = text(b.retryKey || "", 128);
    if (!key) fail("Retry key required.");
    const out = sqlite
      .transaction(() => {
        const old = one("SELECT * FROM ops_time WHERE retry_key=?", key);
        if (old) {
          if (
            old.task_id !== b.taskId ||
            old.technician_id !== b.technicianId ||
            old.minutes !== b.minutes ||
            old.kind !== b.kind ||
            old.work_date !== date ||
            old.note !== note
          )
            fail("Retry key belongs to different work.", 409);
          return old;
        }
        if (
          one(
            "SELECT coalesce(SUM(minutes),0) n FROM ops_time WHERE technician_id=? AND work_date=?",
            b.technicianId,
            date,
          ).n +
            b.minutes >
          1440
        )
          fail("A technician cannot log more than 24 hours in one day.");
        const id = run(
          "INSERT INTO ops_time(task_id,technician_id,work_date,minutes,kind,note,retry_key,created_at) VALUES(?,?,?,?,?,?,?,?)",
          b.taskId,
          b.technicianId,
          date,
          b.minutes,
          b.kind,
          note,
          key,
          now(),
        ).lastInsertRowid;
        return one("SELECT * FROM ops_time WHERE id=?", id);
      })
      .immediate();
    res.status(201).json(out);
  });
  app.post("/api/operations/costs", (req, res) => {
    keys(req.body, ["caseId", "kind", "amountCents", "note", "retryKey"]);
    const b = req.body,
      c = detail(b.caseId);
    if (!["parts", "technician_pay", "subcontract", "other"].includes(b.kind))
      fail("Invalid cost kind.");
    integer(b.amountCents, 1, 1e11, "Cost cents");
    const note = text(b.note || ""),
      key = text(b.retryKey || "", 128);
    if (!note || !key) fail("A cost description and retry key are required.");
    const old = one("SELECT * FROM ops_costs WHERE retry_key=?", key);
    if (old) {
      if (
        old.case_id !== c.id ||
        old.kind !== b.kind ||
        old.amount_cents !== b.amountCents ||
        old.note !== note
      )
        fail("Retry key belongs to different cost.", 409);
      return res.json(old);
    }
    if (c.cost_complete)
      fail("Costs finalized; an audited adjustment workflow is required.", 409);
    const id = run(
      "INSERT INTO ops_costs(case_id,kind,amount_cents,note,retry_key,created_at) VALUES(?,?,?,?,?,?)",
      c.id,
      b.kind,
      b.amountCents,
      note,
      key,
      now(),
    ).lastInsertRowid;
    res.status(201).json(one("SELECT * FROM ops_costs WHERE id=?", id));
  });
}
