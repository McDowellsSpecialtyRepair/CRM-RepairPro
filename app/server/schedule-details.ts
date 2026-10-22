import { sqlite } from "./storage-db";
import { storage } from "./storage";

// What a technician or dispatcher needs on the calendar for one booked work order: who, where, what item,
// what service and what work, without opening the job. No prices or costs.
const SERVICE_LABELS: Record<string, string> = {
  pdr: "PDR", hail: "Hail repair", window_tint: "Window tint", interior_repair: "Auto interior repair",
  rv_interior: "RV interior repair", rv_upholstery: "RV upholstery", marine_interior: "Marine interior repair",
  marine_upholstery: "Marine upholstery", upholstery: "Furniture upholstery",
};
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];

export function scheduleJobDetails(jobId: number | null | undefined) {
  if (!jobId) return null;
  const job = storage.getJob(jobId);
  if (!job) return null;
  const c: any = storage.getCustomer(job.customerId);
  const v: any = job.vehicleId ? storage.getVehicle(job.vehicleId) : null;
  const a: any = job.assetId ? storage.getAssets(job.customerId).find((x: any) => x.id === job.assetId) : null;
  const lines = all(`SELECT l.description, l.quantity, l.unit FROM estimates e JOIN estimate_line_items l ON l.estimate_id=e.id
    WHERE e.job_id=? AND e.status NOT IN ('rejected','expired') ORDER BY e.id, l.id`, jobId);
  const estimates = all("SELECT estimate_number AS n FROM estimates WHERE job_id=? AND status NOT IN ('rejected','expired') ORDER BY id", jobId).map(r => r.n);
  const item = v ? [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.color ? ` (${v.color})` : "") : a ? [a.name, a.location].filter(Boolean).join(" — ") : null;
  return {
    jobNumber: job.jobNumber, title: job.title, status: job.status, priority: job.priority,
    service: SERVICE_LABELS[job.serviceType] || job.serviceType, estimateNumbers: estimates,
    customer: c ? (c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ")) : null,
    customerType: c?.customerType || null,
    phone: c ? (c.mobile || c.phone || null) : null,
    address: c ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(", ") || null : null,
    item, vin: v?.vin || null, plate: v?.licensePlate || null,
    work: lines.slice(0, 6).map(l => `${l.description}${l.quantity > 1 ? ` (×${l.quantity})` : ""}`), moreWork: Math.max(0, lines.length - 6),
    instructions: job.description ? String(job.description).slice(0, 300) : null,
    insuranceClaim: job.insuranceClaim || null,
  };
}

// The same at-a-glance details for an estimate that has a planned date but no work order yet.
export function scheduleEstimateDetails(estimateId: number) {
  const e = storage.getEstimate(estimateId);
  if (!e) return null;
  const c: any = storage.getCustomer(e.customerId);
  const v: any = e.vehicleId ? storage.getVehicle(e.vehicleId) : null;
  const a: any = e.assetId ? storage.getAssets(e.customerId).find((x: any) => x.id === e.assetId) : null;
  const lines = all("SELECT description, quantity FROM estimate_line_items WHERE estimate_id=? ORDER BY id", estimateId);
  const p = sqlite.prepare("SELECT priority FROM estimate_planning WHERE estimate_id=?").get(estimateId) as any;
  return {
    jobNumber: null, title: null, status: e.status, priority: p?.priority || "normal",
    service: SERVICE_LABELS[e.serviceType] || e.serviceType, estimateNumbers: [e.estimateNumber],
    customer: c ? (c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ")) : null,
    customerType: c?.customerType || null, phone: c ? (c.mobile || c.phone || null) : null,
    address: c ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(", ") || null : null,
    item: v ? [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.color ? ` (${v.color})` : "") : a ? [a.name, a.location].filter(Boolean).join(" — ") : null,
    vin: v?.vin || null, plate: v?.licensePlate || null,
    work: lines.slice(0, 6).map(l => `${l.description}${l.quantity > 1 ? ` (×${l.quantity})` : ""}`), moreWork: Math.max(0, lines.length - 6),
    instructions: null, insuranceClaim: null,
  };
}

// Work with a planned date and lead technician but no booked calendar time, so it still shows on the
// technician's day ("planned, no time booked"). Work orders with an active booking are left out (the
// booking shows instead); an estimate linked to a work order uses the work order's planning.
export function plannedWork(start: string, end: string) {
  const jobs = all(`SELECT j.id, j.scheduled_date AS date, j.assigned_tech_id AS techId FROM jobs j
    WHERE j.scheduled_date>=? AND j.scheduled_date<? AND j.assigned_tech_id IS NOT NULL AND j.status NOT IN ('completed','cancelled')
      AND NOT EXISTS (SELECT 1 FROM schedule_slots s WHERE s.job_id=j.id AND s.status NOT IN ('cancelled'))`, start, end)
    .map(r => ({ kind: "job", id: r.id, date: r.date, technicianId: r.techId, details: scheduleJobDetails(r.id) }));
  const estimates = all(`SELECT p.estimate_id AS id, p.scheduled_date AS date, p.assigned_tech_id AS techId FROM estimate_planning p
    JOIN estimates e ON e.id=p.estimate_id
    WHERE p.scheduled_date>=? AND p.scheduled_date<? AND p.assigned_tech_id IS NOT NULL AND e.job_id IS NULL AND e.invoice_id IS NULL
      AND e.status NOT IN ('rejected','expired','invoiced')`, start, end)
    .map(r => ({ kind: "estimate", id: r.id, date: r.date, technicianId: r.techId, details: scheduleEstimateDetails(r.id) }));
  return [...jobs, ...estimates];
}
