import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { SERVICES } from "../shared/services";
const dir = "/home/user/workspace/workorders-qa";
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`, "utf8"));
const tests: any[] = [];
let token = "";
async function api(method: string, path: string, body?: any) {
  const r = await fetch("http://127.0.0.1:5006" + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
async function ok(method: string, path: string, body?: any) { const r = await api(method, path, body); if (![200,201].includes(r.status)) throw Error(`${path}: ${r.status} ${JSON.stringify(r.data)}`); return r.data; }
function check(name: string, pass: boolean, observed?: any) { tests.push({ name, passed: pass, observed }); if (!pass) console.error("FAIL", name, observed); }
async function blocked(name: string, method: string, path: string, body: any, expected = 400) { const r = await api(method, path, body); check(name, r.status === expected, r); }
async function save(kind: string, id: number, body: any) {
  const path = `/api/${kind}/${id}/planning`, p = await ok("GET", path);
  return ok("PATCH", path, { revision: p.revision, ...body });
}
try {
  await blocked("Unauthenticated detail is denied", "GET", "/api/jobs/1/detail", undefined, 401);
  token = (await ok("POST", "/api/auth/login", fixture)).token;
  const ownerToken = token;
  const owner = await ok("GET", "/api/auth/me");
  const staff = await ok("GET", "/api/planning/staff");
  check("Staff choices omit credentials and private fields", staff.every((s: any) => Object.keys(s).sort().join() === "id,name"));
  // Give each run its own technicians so staff-account uniqueness stays tested
  // without colliding with accounts intentionally retained by earlier runs.
  const techs = [];
  for (const suffix of ["A", "B"]) techs.push(await ok("POST", "/api/technicians", {
    name: `QA Work Orders ${suffix} ${randomBytes(4).toString("hex")}`,
    email: "service@mcdowellsrepair.com", skillAreas: "pdr,hail,upholstery",
    technicianType: "in_shop", status: "active",
  }));
  const c = await ok("POST", "/api/customers", { companyName: "QA Work Order Navigation", customerType: "retail", email: "service@mcdowellsrepair.com", confirmDuplicate: true });
  const vehicles: any = {};
  for (const domain of ["auto", "rv", "marine"]) vehicles[domain] = await ok("POST", "/api/vehicles", { customerId: c.id, vehicleType: domain, make: "QA", model: `${domain} repair item` });
  const asset = await ok("POST", "/api/assets", { customerId: c.id, assetType: "sofa", name: "QA Furniture Repair" });
  const records: any[] = [];
  for (const svc of SERVICES) {
    const target = svc.target === "asset" ? { assetId: asset.id } : { vehicleId: vehicles[svc.domain].id };
    const j = await ok("POST", "/api/jobs", { customerId: c.id, title: `QA ${svc.label}`, serviceType: svc.value, ...target });
    const p = await save("jobs", j.id, { scheduledDate: "2027-01-12", assignedTechId: techs[0].id, salesPersonId: staff[0].id, priority: "urgent", description: "Repair torn material; inspect surrounding surface." });
    check(`${svc.value}: all planning fields persist`, p.scheduledDate === "2027-01-12" && p.assignedTechId === techs[0].id && p.salesPersonId === staff[0].id && p.priority === "urgent");
    const e = await ok("POST", `/api/jobs/${j.id}/estimate`, {});
    check(`${svc.value}: linked estimate preserves target`, e.jobId === j.id && e.customerId === c.id && e.serviceType === svc.value && (e.vehicleId === target.vehicleId || e.assetId === target.assetId));
    check(`${svc.value}: repeated create avoids duplicate`, (await ok("POST", `/api/jobs/${j.id}/estimate`, {})).id === e.id);
    const ep = await ok("GET", `/api/estimates/${e.id}/planning`);
    check(`${svc.value}: linked planning shared`, ep.jobId === j.id && ep.priority === "urgent" && ep.salesPersonId === staff[0].id);
    await save("estimates", e.id, { priority: "high" });
    check(`${svc.value}: estimate edit updates work order`, (await ok("GET", `/api/jobs/${j.id}`)).priority === "high");
    await ok("POST", `/api/estimates/${e.id}/line-items`, { serviceCategory: "material", description: "Replacement material", lineType: "parts", unitPrice: 100 });
    const labor = await ok("POST", `/api/estimates/${e.id}/line-items`, { serviceCategory: "labor", description: "Repair and installation", lineType: "labor", quantity: 2, unitPrice: 150 });
    await ok("PATCH", `/api/estimates/line-items/${labor.id}/classification`, { expectedVersion: 1, lineType: "labor", splits: techs.map((t: any) => ({ technicianId: t.id, shareBps: 5000 })) });
    const d = await ok("GET", `/api/jobs/${j.id}/detail`);
    check(`${svc.value}: detail shows estimate scope and repaired item`, d.estimates[0].lineItems.length === 2 && !!(d.vehicle || d.asset) && d.estimates[0].total === 406);
    await ok("PATCH", `/api/estimates/${e.id}`, { status: "approved" });
    const inv = await ok("POST", `/api/estimates/${e.id}/convert-invoice`, {});
    const credits = await ok("GET", `/api/invoices/${inv.id}/labor`);
    await save("estimates", e.id, { priority: "normal", assignedTechId: techs[1].id });
    const inv2 = await ok("GET", `/api/invoices/${inv.id}`);
    check(`${svc.value}: planning never changes invoice or labor credits`, inv2.total === 406 && inv2.taxAmount === 6 && JSON.stringify(credits) === JSON.stringify(await ok("GET", `/api/invoices/${inv.id}/labor`)));
    await blocked(`${svc.value}: invoice lock retained`, "PATCH", `/api/estimates/${e.id}`, { notes: "Do not permit financial snapshot edit" }, 409);
    records.push({ job: j, estimate: e, invoice: inv });
  }
  const j = records[0].job, path = `/api/jobs/${j.id}/planning`;
  const stale = await ok("GET", path);
  await save("jobs", j.id, { priority: "low" });
  await blocked("Stale editor rejected", "PATCH", path, { revision: stale.revision, priority: "urgent" }, 409);
  for (const [name, body] of [
    ["Impossible date", { scheduledDate: "2026-02-30" }], ["Datetime instead of date", { scheduledDate: "2026-09-27T10:00:00" }],
    ["Invalid priority", { priority: "instant" }], ["Unknown technician", { assignedTechId: 999999 }],
    ["String staff identifier", { salesPersonId: "1" }], ["Unknown salesperson", { salesPersonId: 999999 }],
    ["Empty title", { title: " " }], ["Invalid status", { status: "paid" }], ["Financial injection", { total: 1 }],
    ["Customer reassignment", { customerId: 2 }],
  ] as any[]) {
    const old = await ok("GET", path);
    await blocked(name, "PATCH", path, { revision: old.revision, ...body });
    check(`${name}: atomic rollback`, (await ok("GET", path)).revision === old.revision);
  }
  for (const status of ["scheduled", "in_progress", "completed", "pending"]) {
    const p = await save("jobs", j.id, { status });
    check(`Status ${status} saved`, p.status === status);
  }
  await save("jobs", j.id, { scheduledDate: null, assignedTechId: null, salesPersonId: null });
  const cleared = await ok("GET", path);
  check("Assignments and date can be cleared", !cleared.scheduledDate && !cleared.assignedTechId && !cleared.salesPersonId);
  const oldPatch = await api("PATCH", `/api/jobs/${j.id}`, { status: "scheduled" });
  check("Legacy status menu still works", oldPatch.status === 200);
  await blocked("Legacy route cannot inject financial field", "PATCH", `/api/jobs/${j.id}`, { total: 15 });
  await blocked("Missing work order", "GET", "/api/jobs/999999/detail", undefined, 404);
  await blocked("Missing estimate planning", "GET", "/api/estimates/999999/planning", undefined, 404);

  // Direct fixture creation only in the isolated QA database.
  const db = new Database(`${dir}/test.db`);
  for (const name of ["staff_actor_id", "staff_actor_label", "staff_request_id"]) db.function(name, () => name === "staff_actor_id" ? null : "isolated-qa-fixture");
  db.prepare("INSERT INTO schedule_slots(job_id,customer_id,technician_id,date,start_time,end_time,duration_hours,slot_type,status,created_at) VALUES(?,?,?,'2027-01-12','08:00','10:00',2,'work','scheduled',?)").run(j.id, c.id, techs[0].id, new Date().toISOString());
  let current = await ok("GET", path);
  await blocked("Booked job planned date protected", "PATCH", path, { revision: current.revision, scheduledDate: "2027-01-13" }, 409);
  await blocked("Booked job lead technician protected", "PATCH", path, { revision: current.revision, assignedTechId: techs[0].id }, 409);
  await blocked("Booked job cancellation protected", "PATCH", path, { revision: current.revision, status: "cancelled" }, 409);
  await blocked("Legacy patch cannot bypass calendar safety", "PATCH", `/api/jobs/${j.id}`, { scheduledDate: "2027-01-13" }, 409);
  await save("jobs", j.id, { priority: "urgent" });
  check("Booked job can still edit urgency", (await ok("GET", path)).priority === "urgent");
  db.prepare("UPDATE schedule_slots SET status='cancelled' WHERE job_id=?").run(j.id);
  await save("jobs", j.id, { scheduledDate: "2027-01-13", assignedTechId: techs[0].id, salesPersonId: staff[0].id });
  check("Rescheduling allowed after appointment cancelled", (await ok("GET", path)).scheduledDate === "2027-01-13");

  const e = await ok("POST", "/api/estimates", { customerId: c.id, serviceType: "pdr", vehicleId: vehicles.auto.id });
  await save("estimates", e.id, { scheduledDate: "2027-01-15", assignedTechId: techs[0].id, salesPersonId: staff[0].id, priority: "urgent" });
  await ok("POST", `/api/estimates/${e.id}/line-items`, { serviceCategory: "material", description: "Material only", lineType: "parts", unitPrice: 10 });
  await ok("PATCH", `/api/estimates/${e.id}`, { status: "approved" });
  const prod = await ok("POST", "/api/operations/start", { estimateId: e.id, department: "PDR / Hail" });
  const inherited = await ok("GET", `/api/estimates/${e.id}/planning`);
  check("Estimate planning inherited by production work order", !!inherited.jobId && inherited.priority === "urgent" && inherited.assignedTechId === techs[0].id && inherited.scheduledDate === "2027-01-15" && inherited.salesPersonId === staff[0].id);

  const roleFixtures: any = {};
  for (const role of ["advisor", "support", "accountant", "auditor", "technician"]) {
    token = ownerToken;
    const email = `qa-${randomBytes(6).toString("hex")}@mcdowellsrepair.com`;
    const user = await ok("POST", "/api/staff", { email, fullName: `QA ${role}`, role, ...(role === "technician" ? { technicianId: techs[0].id } : {}) });
    const password = randomBytes(24).toString("base64url");
    const code = user.activationCode ?? user.invitation?.activationCode;
    token = (await ok("POST", "/api/auth/activate", { email, password, activationCode: code })).token;
    roleFixtures[role] = { email, password };
    if (role === "technician") {
      await blocked("Technician cannot access general job details", "GET", `/api/jobs/${j.id}/detail`, undefined, 403);
      const scope = await ok("GET", `/api/my-work/${j.id}/scope`);
      check("Technician can open assigned estimated scope without prices", scope.lines.length === 2 && !JSON.stringify(scope).includes("unitPrice"));
      await blocked("Technician cannot read another technician's scope", "GET", `/api/my-work/${records[1].job.id}/scope`, undefined, 404);
      continue;
    }
    const detail = await ok("GET", `/api/jobs/${j.id}/detail`);
    const p = await ok("GET", path);
    if (role === "advisor" || role === "support") {
      await ok("PATCH", path, { revision: p.revision, priority: "normal" });
      check(`${role} can edit authorized job planning`, true);
    } else await blocked(`${role} cannot edit job planning`, "PATCH", path, { revision: p.revision, priority: "urgent" }, 403);
    if (role === "support") {
      check("Support gets repair scope but not prices or invoices", detail.estimates[0].lineItems.length === 2 && !("total" in detail.estimates[0]) && !("unitPrice" in detail.estimates[0].lineItems[0]) && detail.invoices.length === 0);
      await blocked("Support cannot create estimate through job route", "POST", `/api/jobs/${j.id}/estimate`, {}, 403);
      await blocked("Support cannot edit estimate planning", "PATCH", `/api/estimates/${records[0].estimate.id}/planning`, {}, 403);
    }
  }
  token = ownerToken;
  const events = await ok("GET", "/api/staff/audit?event=planning.updated");
  check("Planning audit records actor and before/after values", events.events.some((a: any) => a.actor_id && a.before_json && a.after_json));
  check("SQLite integrity check", (db.pragma("integrity_check") as any[]).every(r => r.integrity_check === "ok"));
  check("Foreign keys contain no orphan rows", (db.pragma("foreign_key_check") as any[]).length === 0);
  db.close();
  writeFileSync(`${dir}/ui-fixture.json`, JSON.stringify({ ...fixture, roles: roleFixtures, customerId: c.id, vehicleId: vehicles.auto.id, records, techs, staff, production: prod, standaloneEstimateId: e.id }), { mode: 0o600 });
} catch (e: any) {
  check("Test runner completed", false, e.message);
} finally {
  writeFileSync(`${dir}/api-results.json`, JSON.stringify(tests, null, 2));
  console.log(JSON.stringify({ total: tests.length, passed: tests.filter(t => t.passed).length, failed: tests.filter(t => !t.passed) }, null, 2));
  if (tests.some(t => !t.passed)) process.exitCode = 1;
}
