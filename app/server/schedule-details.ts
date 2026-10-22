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
