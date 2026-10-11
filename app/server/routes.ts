import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { sqlite } from "./storage-db";
import { createHash } from "node:crypto";
import { createEstimateSafe, updateEstimateSafe, addEstimateLines, deleteEstimateLine,
  convertEstimate, postPayment, updateInvoiceSafe, fail, editableEstimate, recalculateEstimate, updateEstimateLine, validateEstimateServices } from "./billing";
import {registerEstimateSales} from "./estimate-sales";
import {registerEstimateDents} from "./estimate-dents";
import {nonLaborCategory,categoryTaxable,customerLineLabel,documentBreakdown} from "../shared/estimate-rules";
import nodemailer from "nodemailer";
import { registerReporting } from "./reporting";
import { registerSecurity, assignmentPatch } from "./security";
import { allocations, deliveries, recordDelivery } from "./labor";
import { printable,breakdownHtml } from "./print-safety";
import { registerOperations } from "./operations";
import { registerCapacity, validateSlot } from "./capacity";
import {registerVin} from "./vin";
import {normalizeVin} from "../shared/vin";
import {registerPricingCatalog} from "./pricing-catalog";
import {validDate} from "../shared/reporting";
import {formatCalendarDate} from "../shared/calendar-date";
import { registerWorkOrders, planning, updatePlanning, estimatePlanningList } from "./work-orders";
import { runMigrations } from "./migrations";
import { TEST_EMAIL, saveEmailCopy } from "./delivery-config";
import { acceptFields } from "./input-guard";
import { AUTO_PRINT_SCRIPT, internalOrigin } from "./http-security";
import { actorLabel } from "./security-context";
import { customers, vehicles, assets, serviceHistory, jobs, campaigns, activities, technicians, scheduleSlots, bookings,
  coiCertificates, thirdPartyPayers, fleetAccounts, fleetAuthorizedContacts, warrantyClaims, assetDetails, taxJurisdictions } from "@shared/schema";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

// SMTP configuration - can be set via environment variables or app settings
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
};

let emailTransporter: any = null;
function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;
  if (!SMTP_CONFIG.user || !SMTP_CONFIG.pass) return null;
  emailTransporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass },
  });
  return emailTransporter;
}

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  // All schema migrations run here, in order, before any route is registered.
  // Demonstration data is never loaded on startup (see server/migrations.ts).
  runMigrations();
  // Authentication must precede every API and print route, including reporting.
  registerSecurity(app);
  registerEstimateSales(app);
  registerEstimateDents(app);
  app.patch("/api/estimates/line-items/:id",(req,res)=>res.json(updateEstimateLine(Number(req.params.id),req.body)));
  registerWorkOrders(app);
  registerOperations(app);
  registerCapacity(app);
  registerVin(app);
  registerPricingCatalog(app);
  registerReporting(app);
  app.get("/api/estimates/:id/labor", (req,res) => {
    const items = storage.getEstimateLineItems(Number(req.params.id));
    res.json(items.map(i => ({...i,allocations:allocations(i.id)})));
  });
  app.patch("/api/estimates/line-items/:id/classification", (req,res) => {
    const result = sqlite.transaction(() => {
      const line = sqlite.prepare("SELECT * FROM estimate_line_items WHERE id=?").get(Number(req.params.id)) as any;
      if (!line) fail("Line not found",404);
      editableEstimate(line.estimate_id);
      if (req.body.expectedVersion !== line.allocation_version) fail("This labor line changed. Reopen the estimate before saving your split.",409);
      const {lineType, splits} = req.body;
      if (!["parts","labor"].includes(lineType) || !Array.isArray(splits) || splits.length>40) fail("Choose parts or labor and valid technician splits.");
      if (lineType === "parts" && splits.length) fail("Parts cannot be assigned as technician labor.");
      if(nonLaborCategory(line.service_category)&&lineType!=="parts")fail("Materials, supplies and freight cannot be assigned as technician labor.");
      if(line.service_category==="fabrication"&&lineType!=="labor")fail("Fabrication must remain a labor charge.");
      const ids = new Set<number>();
      for (const s of splits) {
        if (!Number.isInteger(s.technicianId) || ids.has(s.technicianId) || !Number.isInteger(s.shareBps) || s.shareBps<=0 || s.shareBps>10000 || !sqlite.prepare("SELECT id FROM technicians WHERE id=? AND status='active'").get(s.technicianId)) fail("Each split needs a unique active technician and a valid percentage.");
        ids.add(s.technicianId);
      }
      if (splits.length && splits.reduce((n: number,s: any) => n+s.shareBps,0)!==10000) fail("Technician percentages must total exactly 100%.");
      sqlite.prepare("DELETE FROM estimate_labor_allocations WHERE line_id=?").run(line.id);
      sqlite.prepare("UPDATE estimate_line_items SET line_type=?,allocation_version=allocation_version+1 WHERE id=?").run(lineType,line.id);
      for (const s of splits) sqlite.prepare("INSERT INTO estimate_labor_allocations(line_id,technician_id,share_bps) VALUES(?,?,?)").run(line.id,s.technicianId,s.shareBps);
      storage.updateEstimate(line.estimate_id,{status:"draft",approvedDate:null});
      return recalculateEstimate(line.estimate_id);
    }).immediate();
    res.json(result);
  });
  app.get("/api/invoices/:id/labor", (req,res) => res.json(sqlite.prepare(`SELECT c.*,l.description FROM invoice_labor_credits c JOIN invoice_line_items l ON l.id=c.line_id WHERE l.invoice_id=? ORDER BY c.technician_id,c.line_id`).all(Number(req.params.id))));
  app.get("/api/reports/technician-labor", (req,res) => {
    const from = String(req.query.from || "0001-01-01"), to = String(req.query.to || "9999-12-31");
    if (![from,to].every(validDate) || from>to) return res.status(400).json({error:"Choose a valid date range."});
    const rows = sqlite.prepare(`SELECT c.technician_id,c.technician_name,i.id invoice_id,i.invoice_number,i.issue_date,l.description,c.share_bps,c.net_labor_cents
      FROM invoice_labor_credits c JOIN invoice_line_items l ON l.id=c.line_id JOIN invoices i ON i.id=l.invoice_id
      WHERE i.status NOT IN ('draft','void') AND i.issue_date BETWEEN ? AND ? ORDER BY c.technician_name,i.issue_date,i.id`).all(from,to);
    const legacy = sqlite.prepare(`SELECT COUNT(DISTINCT i.id) n FROM invoices i JOIN invoice_line_items l ON l.invoice_id=i.id WHERE l.line_type='legacy' AND i.status NOT IN ('draft','void') AND i.issue_date BETWEEN ? AND ?`).get(from,to) as any;
    res.json({rows,legacyInvoices:legacy.n,basis:"Invoice issue date; net labor sales after allocated discount; excludes parts and tax. Not payroll dollars or cash collections."});
  });
  app.get("/api/delivery/:type/:id", (req,res) => {
    if (!["estimate","invoice"].includes(req.params.type)) return res.status(400).json({error:"Invalid document"});
    res.json({testEmail:TEST_EMAIL,emailConfigured:!!getEmailTransporter(),smsConfigured:false,whatsappConfigured:false,attempts:deliveries(req.params.type,Number(req.params.id))});
  });

  const registerCrudRoutes = (
    path: string,
    table: SQLiteTable,
    getAll: () => any[],
    create: (data: any) => any,
    update: (id: number, data: any) => any | undefined,
    remove: (id: number) => void,
  ) => {
    app.get(`/api/${path}`, async (_req, res) => res.json(getAll()));
    app.get(`/api/${path}/:id`, async (req, res) => {
      const record = getAll().find(record => record.id === parseInt(req.params.id));
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    });
    app.post(`/api/${path}`, async (req, res) => res.json(create(acceptFields(table, req.body, res))));
    app.patch(`/api/${path}/:id`, async (req, res) => {
      const record = update(parseInt(req.params.id), acceptFields(table, req.body, res, ["customerId"]));
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    });
    app.delete(`/api/${path}/:id`, async (req, res) => {
      remove(parseInt(req.params.id));
      res.json({ success: true });
    });
  };

  // ===== DASHBOARD =====
  app.get("/api/dashboard", async (_req, res) => {
    res.json(storage.getDashboardStats());
  });

  // ===== CUSTOMERS =====
  app.get("/api/customers", async (_req, res) => {
    res.json(storage.getCustomers());
  });
  // ===== CUSTOMER LOOKUP & DUPLICATE DETECTION =====
  const digits = (v: any) => String(v || "").replace(/\D/g, "").slice(-10);
  const norm = (v: any) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normAddr = (v: any) => String(v || "").toLowerCase()
    .replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave").replace(/\broad\b/g, "rd").replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln").replace(/\bboulevard\b/g, "blvd").replace(/\bcourt\b/g, "ct").replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s").replace(/\beast\b/g, "e").replace(/\bwest\b/g, "w").replace(/[^a-z0-9]/g, "");
  const lev = (a: string, b: string) => {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0]; dp[0] = i;
      for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
    }
    return dp[b.length];
  };
  const NICK: Record<string, string> = { bob: "robert", rob: "robert", bobby: "robert", bill: "william", will: "william", billy: "william", liz: "elizabeth", beth: "elizabeth", jim: "james", jimmy: "james", mike: "michael", dave: "david", dan: "daniel", danny: "daniel", tom: "thomas", tony: "anthony", joe: "joseph", chris: "christopher", matt: "matthew", nick: "nicholas", steve: "steven", kate: "katherine", katie: "katherine", jen: "jennifer", jenny: "jennifer", sam: "samuel", ben: "benjamin", alex: "alexander", andy: "andrew", drew: "andrew", pat: "patrick", rick: "richard", dick: "richard", rich: "richard", ed: "edward", ted: "edward", greg: "gregory", jon: "jonathan", josh: "joshua", ken: "kenneth", larry: "lawrence", ron: "ronald", don: "donald", sue: "susan", peggy: "margaret", maggie: "margaret", meg: "margaret", abby: "abigail", becky: "rebecca", cathy: "catherine", debbie: "deborah", jeff: "jeffrey", jerry: "gerald", doug: "douglas", fred: "frederick", hank: "henry", jack: "john", johnny: "john", nate: "nathan", tim: "timothy", zach: "zachary" };
  const canonFirst = (f: string) => NICK[f] || f;
  const custName = (c: any) => c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
  const customerSummary = (c: any) => {
    const vehicles = storage.getVehicles(c.id);
    const assets = storage.getAssets(c.id);
    const ests = storage.getEstimates().filter((e: any) => e.customerId === c.id);
    const invs = storage.getInvoices().filter((i: any) => i.customerId === c.id);
    const jobsList = storage.getJobs().filter((j: any) => j.customerId === c.id);
    const dates = [...ests, ...invs, ...jobsList].map((x: any) => x.createdAt).filter(Boolean).sort();
    return {
      id: c.id, customerNumber: c.customerNumber, name: custName(c), customerType: c.customerType,
      email: c.email, phone: c.phone, mobile: c.mobile, address: c.address, city: c.city, state: c.state, zip: c.zip, status: c.status,
      vehicles: vehicles.map((v: any) => ({ id: v.id, label: `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim(), vin: v.vin, licensePlate: v.licensePlate, vehicleType: v.vehicleType })),
      assets: assets.map((a: any) => ({ id: a.id, name: a.name, assetType: a.assetType })),
      estimateCount: ests.length, jobCount: jobsList.length, invoiceCount: invs.length,
      lifetimeValue: Math.round(invs.reduce((s: number, i: any) => s + (i.total || 0), 0) * 100) / 100,
      lastVisit: dates.length ? dates[dates.length - 1] : null,
    };
  };

  const findDuplicates = (input: any, excludeId?: number) => {
    const inEmail = String(input.email || "").trim().toLowerCase();
    const inPhones = [digits(input.phone), digits(input.mobile)].filter((d) => d.length >= 7);
    const inFirst = norm(input.firstName), inLast = norm(input.lastName), inCompany = norm(input.companyName);
    const inAddr = normAddr(input.address), inZip = String(input.zip || "").trim().slice(0, 5);
    const results: any[] = [];
    for (const c of storage.getCustomers() as any[]) {
      if (excludeId && c.id === excludeId) continue;
      const reasons: string[] = []; let score = 0;
      const contacts = storage.getContacts(c.id);
      if (inEmail && [c.email, ...contacts.map(x => x.email)].some(x => String(x || "").trim().toLowerCase() === inEmail)) { reasons.push("Same email"); score += 60; }
      const cPhones = [digits(c.phone), digits(c.mobile), ...contacts.map(x => digits(x.phone))].filter((d) => d.length >= 7);
      if (inPhones.some((p) => cPhones.includes(p))) { reasons.push("Same phone number"); score += 50; }
      const cFirst = norm(c.firstName), cLast = norm(c.lastName), cCompany = norm(c.companyName);
      if (inCompany && cCompany) {
        if (inCompany === cCompany) { reasons.push("Same company name"); score += 50; }
        else if (inCompany.length > 4 && (cCompany.includes(inCompany) || inCompany.includes(cCompany) || lev(inCompany, cCompany) <= 2)) { reasons.push("Similar company name"); score += 25; }
      }
      if (inLast && cLast) {
        const lastClose = inLast === cLast || (inLast.length > 3 && lev(inLast, cLast) <= 1);
        const firstClose = inFirst && cFirst && (inFirst === cFirst || canonFirst(inFirst) === canonFirst(cFirst) || lev(inFirst, cFirst) <= 1 || inFirst[0] === cFirst[0] && (inFirst.startsWith(cFirst) || cFirst.startsWith(inFirst)));
        if (lastClose && firstClose) { reasons.push(inLast === cLast && inFirst === cFirst ? "Same name" : "Similar name"); score += inLast === cLast && inFirst === cFirst ? 50 : 25; }
        else if (lastClose && inZip && String(c.zip || "").slice(0, 5) === inZip) { reasons.push("Same last name in same ZIP"); score += 25; }
      }
      if (inAddr.length > 5 && c.address && normAddr(c.address) === inAddr) { reasons.push("Same street address"); score += 35; }
      if (score >= 25) results.push({ ...customerSummary(c), score, reasons, level: score >= 50 ? "likely" : "possible" });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  };

  app.post("/api/customers/check-duplicates", async (req, res) => {
    res.json({ matches: findDuplicates(req.body || {}, req.body?.excludeId) });
  });

  app.get("/api/customers/lookup", async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ results: [] });
    const ql = q.toLowerCase(), qd = q.replace(/\D/g, ""), qn = norm(q);
    const out: any[] = [];
    for (const c of storage.getCustomers() as any[]) {
      const hits: string[] = [];
      const name = custName(c).toLowerCase();
      const full = `${c.firstName || ""} ${c.lastName || ""} ${c.companyName || ""}`.toLowerCase();
      if (name.includes(ql) || full.includes(ql) || ql.split(/\s+/).every((t) => full.includes(t))) hits.push("Name");
      const contacts = storage.getContacts(c.id);
      if ([c.email, ...contacts.map(x => x.email)].some(x => String(x || "").toLowerCase().includes(ql))) hits.push("Email");
      if (qd.length >= 4 && [c.phone, c.mobile, ...contacts.map(x => x.phone)].some((p: any) => String(p || "").replace(/\D/g, "").includes(qd))) hits.push("Phone");
      if (c.customerNumber && c.customerNumber.toLowerCase().includes(ql)) hits.push("Customer #");
      if (c.address && c.address.toLowerCase().includes(ql)) hits.push("Address");
      const vs = storage.getVehicles(c.id);
      if (qn.length >= 3 && vs.some((v: any) => norm(v.vin).includes(qn))) hits.push("VIN / HIN");
      if (qn.length >= 3 && vs.some((v: any) => norm(v.licensePlate).includes(qn))) hits.push("Plate");
      if (vs.some((v: any) => `${v.year || ""} ${v.make || ""} ${v.model || ""}`.toLowerCase().includes(ql))) hits.push("Vehicle");
      if (storage.getAssets(c.id).some((a: any) => String(a.name || "").toLowerCase().includes(ql))) hits.push("Item");
      const docs = [...storage.getEstimates().filter((e: any) => e.customerId === c.id).map((e: any) => e.estimateNumber),
        ...storage.getInvoices().filter((i: any) => i.customerId === c.id).map((i: any) => i.invoiceNumber),
        ...storage.getJobs().filter((j: any) => j.customerId === c.id).map((j: any) => j.jobNumber)];
      if (docs.some((d: any) => String(d || "").toLowerCase().includes(ql))) hits.push("Estimate / WO / Invoice #");
      if (hits.length) out.push({ ...customerSummary(c), matchedOn: hits });
    }
    out.sort((a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || ""));
    res.json({ results: out.slice(0, 20) });
  });

  // ===== CONTACT CHANGE HANDLING (new phone / new email / moved) =====
  const STATE_ABBR: Record<string, string> = { idaho: "id", oregon: "or", washington: "wa", utah: "ut", nevada: "nv", montana: "mt", wyoming: "wy", california: "ca", arizona: "az", colorado: "co" };
  const normState = (v: any) => { const x = String(v || "").trim().toLowerCase(); return STATE_ABBR[x] || x; };
  const addrOf = (c: any) => ({ address: c.address || "", city: c.city || "", state: c.state || "", zip: c.zip || "" });
  const addrText = (a: any) => [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const sameAddr = (a: any, b: any) => normAddr(a.address) === normAddr(b.address) && String(a.zip || "").slice(0, 5) === String(b.zip || "").slice(0, 5)
    && norm(a.city) === norm(b.city) && normState(a.state) === normState(b.state);
  const tidyAddr = (a: any) => ({ ...a, city: a.city && a.city === a.city.toUpperCase() ? a.city.toLowerCase().replace(/\b\w/g, (m: string) => m.toUpperCase()) : a.city,
    address: a.address && a.address === a.address.toUpperCase() ? a.address.toLowerCase().replace(/\b\w/g, (m: string) => m.toUpperCase()) : a.address,
    state: STATE_ABBR[String(a.state || "").trim().toLowerCase()]?.toUpperCase() || a.state });
  const contactDiffs = (current: any, incoming: any) => {
    const out: any[] = [];
    const cp = digits(current.phone), ip = digits(incoming.phone);
    const knownPhones = [digits(current.phone), digits(current.mobile)].filter(Boolean);
    if (incoming.phone && !knownPhones.includes(ip)) out.push({ key: "phone", current: current.phone || "", incoming: incoming.phone, currentMobile: current.mobile || "" });
    const im = digits(incoming.mobile);
    if (incoming.mobile && im !== ip && !knownPhones.includes(im)) out.push({ key: "mobile", current: current.mobile || "", incoming: incoming.mobile, currentMobile: current.mobile || "" });
    const ce = String(current.email || "").trim().toLowerCase(), ie = String(incoming.email || "").trim().toLowerCase();
    if (ie && ie !== ce) out.push({ key: "email", current: current.email || "", incoming: incoming.email });
    const ca = addrOf(current), ia = addrOf(incoming);
    if (ia.address && !sameAddr(ca, ia)) out.push({ key: "address", current: ca, incoming: tidyAddr(ia), currentText: addrText(ca), incomingText: addrText(tidyAddr(ia)) });
    return out;
  };
  // answers: [{ key, current, incoming, answer: "replaced" | "both" | "kept" }]
  const validateAnswer = (a: any) => {
    if (!["phone", "mobile", "email", "address"].includes(a?.key) || !["replaced", "both", "kept"].includes(a?.answer))
      fail("Answer each contact question with replace, keep both, or keep current");
    if (a.answer !== "kept") {
      if (["phone", "mobile"].includes(a.key) && digits(a.incoming).length < 7) fail("Enter a valid phone number");
      if (a.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.incoming || ""))) fail("Enter a valid email address");
      if (a.key === "address" && ["address", "city", "state", "zip"].some(k => !String(a.incoming?.[k] || "").trim()))
        fail("A new address requires street, city, state and ZIP");
    }
  };
  const applyContactAnswers = (customerId: number, answers: any[], context: string) => {
    if (!Array.isArray(answers)) fail("Contact answers must be a list");
    answers.forEach(validateAnswer);
    const c = storage.getCustomer(customerId) as any;
    if (new Set(answers.map(a=>a.key)).size!==answers.length) fail("Answer each contact field only once.");
    for(const a of answers){
      const current=a.key==="address"?addrOf(c):(c[a.key]||"");
      const same=a.key==="address"
        ? ["address","city","state","zip"].every(k=>a.current?.[k]===current[k])
        : a.current===current;
      if(!same||(a.currentMobile!==undefined&&a.currentMobile!==(c.mobile||"")))
        fail("Contact information changed while this prompt was open. Refresh the customer and review the new values.",409);
    }
    const updates: any = {}; const notes: string[] = []; const log: string[] = [];
    const stamp = new Date().toLocaleDateString("en-US");
    const name = custName(c);
    for (const a of answers || []) {
      if (a.key === "phone" || a.key === "mobile") {
        const field = a.key; const label = field === "phone" ? "Phone" : "Mobile";
        if (a.answer === "replaced") {
          updates[field] = a.incoming;
          if (a.current) notes.push(`${label} changed from ${a.current} to ${a.incoming}; old number no longer in use.`);
          log.push(`${label} updated to ${a.incoming}${a.current ? ` (was ${a.current})` : ""}`);
        } else if (a.answer === "both") {
          if (field === "phone" && !c.mobile && !updates.mobile) { updates.mobile = a.incoming; log.push(`Second number ${a.incoming} saved as mobile`); }
          else if(!storage.getContacts(customerId).some(x=>digits(x.phone)===digits(a.incoming))) { storage.createContact({ customerId, name: `${name} (additional)`, phone: a.incoming, isPrimary: 0 } as any); log.push(`Second number ${a.incoming} saved to Contacts`); }
        } else {
          notes.push(`Other ${label.toLowerCase()} ${a.incoming} was reported but not used; ${a.current || "number on file"} confirmed current.`);
        }
      }
      if (a.key === "email") {
        if (a.answer === "replaced") {
          updates.email = a.incoming;
          if (a.current) notes.push(`Email changed from ${a.current} to ${a.incoming}.`);
          log.push(`Email updated to ${a.incoming}${a.current ? ` (was ${a.current})` : ""}`);
        } else if (a.answer === "both") {
          if(!storage.getContacts(customerId).some(x=>String(x.email||"").trim().toLowerCase()===String(a.incoming).trim().toLowerCase()))
            storage.createContact({ customerId, name: `${name} (additional email)`, email: a.incoming, isPrimary: 0 } as any);
          log.push(`Second email ${a.incoming} saved to Contacts; estimates and invoices still go to ${c.email}`);
        } else notes.push(`Other email ${a.incoming} was reported but not used; ${a.current} confirmed current.`);
      }
      if (a.key === "address") {
        const inc = a.incoming || {}; const curText = addrText(a.current || {}); const incText = addrText(inc);
        if (a.answer === "replaced") {
          Object.assign(updates, { address: inc.address, city: inc.city, state: inc.state, zip: inc.zip });
          if (curText) notes.push(`Moved from ${curText} to ${incText}.`);
          log.push(`Address updated: moved to ${incText}${curText ? ` (from ${curText})` : ""}`);
        } else if (a.answer === "both") {
          notes.push(`Second location on file: ${incText}. Primary/billing address remains ${curText}.`);
          log.push(`Second location ${incText} added to notes`);
        } else notes.push(`Other address ${incText} was reported but not used; ${curText} confirmed current.`);
      }
    }
    if (notes.length) updates.notes = [c.notes, `[${stamp}] ${context}: ${notes.join(" ")}`].filter(Boolean).join("\n");
    if (Object.keys(updates).length) storage.updateCustomer(customerId, updates);
    if (log.length) storage.createActivity({ customerId, activityType: "note", description: `Contact info reviewed (${context}): ${log.join("; ")}.`, performedBy: "System Admin", createdAt: new Date().toISOString() } as any);
    return { updates, log };
  };

  app.post("/api/customers/:id/contact-diffs", async (req, res) => {
    const c = storage.getCustomer(parseInt(req.params.id));
    if (!c) return res.status(404).json({ message: "Not found" });
    res.json({ diffs: contactDiffs(c, req.body || {}) });
  });
  app.post("/api/customers/:id/contact-update", async (req, res) => {
    const id = parseInt(req.params.id);
    if (!storage.getCustomer(id)) return res.status(404).json({ message: "Not found" });
    const r = sqlite.transaction(() => applyContactAnswers(id, req.body?.answers || [], req.body?.context || "Returning customer check-in")).immediate();
    res.json({ ok: true, ...r, customer: storage.getCustomer(id) });
  });

  // ===== MERGE DUPLICATE CUSTOMERS =====
  const MERGE_TABLES = ["contacts", "vehicles", "service_history", "assets", "jobs", "estimates", "invoices", "payments", "activities", "schedule_slots", "bookings", "coi_certificates", "third_party_payers", "fleet_accounts", "fleet_authorized_contacts", "warranty_claims", "asset_details"];
  const MERGE_FIELDS = ["customerType", "firstName", "lastName", "companyName", "email", "phone", "mobile", "address", "city", "state", "zip", "referralSource"];
  const FIELD_LABELS: Record<string, string> = { customerType: "Type", firstName: "First name", lastName: "Last name", companyName: "Company", email: "Email", phone: "Phone", mobile: "Mobile", address: "Address", city: "City", state: "State", zip: "ZIP", referralSource: "Referral source" };
  const mergeCounts = (id: number) => {
    const out: Record<string, number> = {};
    for (const t of MERGE_TABLES) {
      const n = (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE customer_id = ?`).get(id) as any).n;
      if (n) out[t] = n;
    }
    return out;
  };
  const mergeVersion = (keepId: number, srcId: number) => createHash("sha256").update(JSON.stringify({
    keep: storage.getCustomer(keepId), source: storage.getCustomer(srcId),
    linked: MERGE_TABLES.map(t => sqlite.prepare(`SELECT * FROM ${t} WHERE customer_id IN (?,?) ORDER BY id`).all(keepId, srcId)),
  })).digest("hex");

  app.get("/api/customers/:id/merge-preview", async (req, res) => {
    const keep = storage.getCustomer(parseInt(req.params.id)) as any;
    const src = storage.getCustomer(parseInt(String(req.query.sourceId))) as any;
    if (!keep || !src) return res.status(404).json({ message: "Customer not found" });
    if (keep.id === src.id) return res.status(400).json({ message: "Pick a different customer" });
    const lastUsed = (id: number) => {
      const d = [...storage.getEstimates().filter((e: any) => e.customerId === id), ...storage.getInvoices().filter((i: any) => i.customerId === id), ...storage.getJobs().filter((j: any) => j.customerId === id)]
        .map((x: any) => x.createdAt).filter(Boolean).sort();
      const cu = storage.getCustomer(id) as any;
      return d.length ? d[d.length - 1] : cu.createdAt;
    };
    const keepUsed = lastUsed(keep.id), srcUsed = lastUsed(src.id);
    const CONTACT_KEYS = ["phone", "mobile", "email", "address", "city", "state", "zip"];
    const fields = MERGE_FIELDS.filter((f) => !CONTACT_KEYS.includes(f)).map((f) => ({ field: f, label: FIELD_LABELS[f], keep: keep[f] || "", source: src[f] || "" }))
      .filter((x) => x.source && norm(x.keep) !== norm(x.source));
    const cdiffs = contactDiffs(keep, src);
    res.json({
      keep: { id: keep.id, customerNumber: keep.customerNumber, name: custName(keep) },
      source: { id: src.id, customerNumber: src.customerNumber, name: custName(src) },
      moving: mergeCounts(src.id), fields, contactDiffs: cdiffs,
      version: mergeVersion(keep.id, src.id),
      lastUsed: { keep: keepUsed, source: srcUsed }, sourceIsNewer: (srcUsed || "") >= (keepUsed || ""),
      vehicles: storage.getVehicles(src.id).map((v: any) => `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim()),
      estimates: storage.getEstimates().filter((e: any) => e.customerId === src.id).map((e: any) => e.estimateNumber),
    });
  });

  app.post("/api/customers/:id/merge", async (req, res) => {
    const keepId = parseInt(req.params.id), srcId = parseInt(req.body?.sourceId);
    const keep = storage.getCustomer(keepId) as any, src = storage.getCustomer(srcId) as any;
    if (!keep || !src) return res.status(404).json({ message: "Customer not found" });
    if (keepId === srcId) return res.status(400).json({ message: "Cannot merge a customer into itself" });
    if (req.body?.confirmed !== true) return res.status(400).json({ message: "Confirm the account merge before continuing" });
    const choices: Record<string, string> = req.body?.useSource || {};
    const moved = mergeCounts(srcId);
    try {
      const run = sqlite.transaction(() => {
        if (req.body.version !== mergeVersion(keepId, srcId)) fail("The account changed or the preview expired. Reopen the merge preview and review it again.", 409);
        const diffs = contactDiffs(keep, src);
        const supplied = req.body?.contactAnswers;
        if (!Array.isArray(supplied) || supplied.length !== diffs.length ||
          new Set(supplied.map((a: any) => a.key)).size !== diffs.length)
          fail("Every contact difference must be answered before merging");
        const answers = diffs.map(d => {
          const a = supplied.find((a: any) => a.key === d.key);
          if (!a) fail("Every contact difference must be answered before merging");
          if (JSON.stringify(a.current) !== JSON.stringify(d.current) || JSON.stringify(a.incoming) !== JSON.stringify(d.incoming))
            fail("Contact details changed. Refresh the merge preview.", 409);
          const answer = { ...d, answer: a.answer };
          validateAnswer(answer);
          return answer;
        });
        sqlite.prepare("INSERT INTO integrity_audit(kind,record_table,record_id,before_json,after_json) VALUES(?,?,?,?,?)")
          .run("customer-merge", "customers", keepId, JSON.stringify({ keep, source: src, moved }),
            JSON.stringify({ keepId, sourceId: srcId, useSource: choices, contactAnswers: answers }));
        for (const t of MERGE_TABLES) {
          sqlite.prepare(`UPDATE ${t} SET customer_id = ? WHERE customer_id = ?`).run(keepId, srcId);
        }
        const updates: any = {};
        const kept: string[] = [];
        const answeredKeys = new Set<string>();
        for (const a of answers) { answeredKeys.add(a.key); if (a.key === "address") ["address", "city", "state", "zip"].forEach((k) => answeredKeys.add(k)); }
        for (const f of MERGE_FIELDS) {
          const k = keep[f], v = src[f];
          if (!v || k === v || answeredKeys.has(f)) continue;
          if (k && norm(k) === norm(v)) continue;
          if (f === "customerType" && k) continue;
          if (k && ["phone", "mobile", "email", "address", "city", "state", "zip"].includes(f)) continue; // handled by advisor questions
          if (choices[f] === "source" || !k) updates[f] = v;
          if (k && choices[f] !== "source") kept.push(`${FIELD_LABELS[f]}: ${v}`);
          else if (k && choices[f] === "source") kept.push(`${FIELD_LABELS[f]} (previous): ${k}`);
        }
        const stamp = new Date().toLocaleDateString("en-US");
        const note = `[${stamp}] Merged duplicate ${src.customerNumber} (${custName(src)}).` + (kept.length ? ` Other contact info on file: ${kept.join("; ")}.` : "") + (src.notes ? ` Notes from duplicate: ${src.notes}` : "");
        updates.notes = [keep.notes, note].filter(Boolean).join("\n");
        storage.updateCustomer(keepId, updates);
        if (answers.length) applyContactAnswers(keepId, answers, `Merge of ${src.customerNumber}`);
        sqlite.prepare("DELETE FROM customers WHERE id = ?").run(srcId);
        storage.createActivity({ customerId: keepId, activityType: "note", description: `Merged duplicate account ${src.customerNumber} (${custName(src)}) into ${keep.customerNumber}. Moved: ${Object.entries(moved).map(([t, n]) => `${n} ${t.replace(/_/g, " ")}`).join(", ") || "no records"}.`, performedBy: "System Admin", createdAt: new Date().toISOString() } as any);
      });
      run.immediate();
      res.json({ ok: true, keepId, removed: src.customerNumber, moved, customer: storage.getCustomer(keepId) });
    } catch (err: any) {
      res.status(err.status || 409).json({ message: `Merge failed, nothing changed: ${err.message}` });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const customer = storage.getCustomer(id);
    if (!customer) return res.status(404).json({ error: "Not found" });
    const contacts = storage.getContacts(id);
    const vehicles = storage.getVehicles(id);
    const assets = storage.getAssets(id);
    const activities = storage.getActivitiesByCustomer(id);
    const serviceHistory = storage.getServiceHistory(id);
    const coiCertificates = storage.getCoiCertificatesByCustomer(id);
    const thirdPartyPayers = storage.getThirdPartyPayersByCustomer(id);
    const fleetAccounts = storage.getFleetAccountsByCustomer(id);
    const fleetAuthorizedContacts = storage.getFleetAuthorizedContactsByCustomer(id);
    const warrantyClaims = storage.getWarrantyClaimsByCustomer(id);
    const assetDetails = storage.getAssetDetailsByCustomer(id);
    res.json({ ...customer, contacts, vehicles, assets, activities, serviceHistory, coiCertificates, thirdPartyPayers, fleetAccounts, fleetAuthorizedContacts, warrantyClaims, assetDetails });
  });
  app.post("/api/customers", async (req, res) => {
    try {
      const body: any = acceptFields(customers, req.body, res, ["customerNumber"]);
      const confirmDuplicate = req.body.confirmDuplicate;
      if (![body.firstName, body.lastName, body.companyName].some(x => typeof x === "string" && x.trim()))
        return res.status(400).json({ message: "A customer name or company is required" });
      if (!confirmDuplicate) {
        const matches = findDuplicates(body).filter((m) => m.level === "likely");
        if (matches.length) return res.status(409).json({ message: "Possible duplicate customer", duplicate: true, matches });
      }
      const used = new Set(storage.getCustomers().map((c: any) => c.customerNumber));
      let n = storage.getCustomers().length + 1;
      while (used.has(`CUST-${String(n).padStart(3, "0")}`)) n++;
      body.customerNumber = `CUST-${String(n).padStart(3, "0")}`;
      if (!body.status) body.status = "active";
      res.json(storage.createCustomer(body));
    } catch (err: any) {
      res.status(err.status || 400).json({ message: err.message });
    }
  });
  app.patch("/api/customers/:id", async (req, res) => {
    const patch = acceptFields(customers, req.body, res, ["customerNumber"]);
    const id = parseInt(req.params.id);
    const customer = Object.keys(patch).length ? storage.updateCustomer(id, patch) : storage.getCustomer(id);
    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json(customer);
  });
  // Tax-exempt status and credit limit only, for billing/management roles (customers.tax_terms).
  // Lets accounting change tax terms without general customer-editing rights. Audited by triggers.
  app.patch("/api/customers/:id/tax-terms", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(k => !["taxExempt", "creditLimit"].includes(k)))
      fail("Send only taxExempt and/or creditLimit.");
    const patch: any = {};
    if (Object.hasOwn(body, "taxExempt")) {
      if (![0, 1, true, false].includes(body.taxExempt)) fail("taxExempt must be true or false.");
      patch.taxExempt = body.taxExempt ? 1 : 0;
    }
    if (Object.hasOwn(body, "creditLimit")) {
      if (typeof body.creditLimit !== "number" || !Number.isFinite(body.creditLimit) || body.creditLimit < 0 || body.creditLimit > 1e9) fail("creditLimit must be a non-negative amount.");
      patch.creditLimit = Math.round(body.creditLimit * 100) / 100;
    }
    const id = parseInt(req.params.id);
    if (!storage.getCustomer(id)) return res.status(404).json({ error: "Not found" });
    res.json(storage.updateCustomer(id, patch));
  });
  app.delete("/api/customers/:id", async (req, res) => {
    storage.deleteCustomer(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== ASSETS (non-vehicle items: furniture, booths, hotel, office, aircraft, home) =====
  app.get("/api/assets", async (req, res) => {
    const cid = req.query.customerId ? parseInt(String(req.query.customerId)) : null;
    if (cid) return res.json(storage.getAssets(cid));
    const all = storage.getCustomers().flatMap((c: any) => storage.getAssets(c.id));
    res.json(all);
  });
  app.post("/api/assets", async (req, res) => {
    try {
      const body: any = acceptFields(assets, req.body, res);
      if (!body.customerId || !body.assetType) return res.status(400).json({ message: "customerId and assetType are required" });
      res.json(storage.createAsset(body));
    } catch (err: any) {
      res.status(err.status || 400).json({ message: err.message });
    }
  });

  // ===== CUSTOMER COVERAGE, FLEET, WARRANTY, ASSET, AND TAX DATA =====
  registerCrudRoutes(
    "coi-certificates",
    coiCertificates,
    () => storage.getCoiCertificates(),
    data => storage.createCoiCertificate(data),
    (id, data) => storage.updateCoiCertificate(id, data),
    id => storage.deleteCoiCertificate(id),
  );
  registerCrudRoutes(
    "third-party-payers",
    thirdPartyPayers,
    () => storage.getThirdPartyPayers(),
    data => storage.createThirdPartyPayer(data),
    (id, data) => storage.updateThirdPartyPayer(id, data),
    id => storage.deleteThirdPartyPayer(id),
  );
  registerCrudRoutes(
    "fleet-accounts",
    fleetAccounts,
    () => storage.getFleetAccounts(),
    data => storage.createFleetAccount(data),
    (id, data) => storage.updateFleetAccount(id, data),
    id => storage.deleteFleetAccount(id),
  );
  registerCrudRoutes(
    "fleet-authorized-contacts",
    fleetAuthorizedContacts,
    () => storage.getFleetAuthorizedContacts(),
    data => storage.createFleetAuthorizedContact(data),
    (id, data) => storage.updateFleetAuthorizedContact(id, data),
    id => storage.deleteFleetAuthorizedContact(id),
  );
  registerCrudRoutes(
    "warranty-claims",
    warrantyClaims,
    () => storage.getWarrantyClaims(),
    data => storage.createWarrantyClaim(data),
    (id, data) => storage.updateWarrantyClaim(id, data),
    id => storage.deleteWarrantyClaim(id),
  );
  registerCrudRoutes(
    "asset-details",
    assetDetails,
    () => storage.getAssetDetails(),
    data => storage.createAssetDetail(data),
    (id, data) => storage.updateAssetDetail(id, data),
    id => storage.deleteAssetDetail(id),
  );
  registerCrudRoutes(
    "tax-jurisdictions",
    taxJurisdictions,
    () => storage.getTaxJurisdictions(),
    data => storage.createTaxJurisdiction(data),
    (id, data) => storage.updateTaxJurisdiction(id, data),
    id => storage.deleteTaxJurisdiction(id),
  );

  // ===== VEHICLES =====
  app.get("/api/vehicles", async (_req, res) => {
    // Return all vehicles across all customers
    const allCustomers = storage.getCustomers();
    const allVehicles = allCustomers.flatMap(c => storage.getVehicles(c.id));
    res.json(allVehicles);
  });
  app.get("/api/vehicles/:id", async (req, res) => {
    const vehicle = storage.getVehicle(parseInt(req.params.id));
    if (!vehicle) return res.status(404).json({ error: "Not found" });
    const history = storage.getServiceHistoryByVehicle(vehicle.id);
    res.json({ ...vehicle, serviceHistory: history });
  });
  app.post("/api/vehicles", async (req, res) => {
    const fields:any=acceptFields(vehicles,req.body,res);
    const body={...fields,vin:normalizeVin(fields.vin)||null};
    if(body.vin){
      const existing=storage.getVehicles(Number(body.customerId)).find(v=>normalizeVin(v.vin||"")===body.vin);
      if(existing)return res.status(409).json({message:"This VIN is already attached to this customer. Use the existing vehicle shown in the VIN lookup.",existingVehicleId:existing.id});
    }
    const vehicle = storage.createVehicle(body);
    res.json(vehicle);
  });
  app.patch("/api/vehicles/:id", async (req, res) => {
    const fields:any=acceptFields(vehicles,req.body,res,["customerId"]);
    const body={...fields,...(Object.hasOwn(fields,"vin")?{vin:normalizeVin(fields.vin)||null}:{})};
    const current=storage.getVehicle(Number(req.params.id));
    if(current&&body.vin&&storage.getVehicles(current.customerId).some(v=>v.id!==current.id&&normalizeVin(v.vin||"")===body.vin))return res.status(409).json({message:"This customer already has a vehicle with that VIN."});
    const vehicle = storage.updateVehicle(parseInt(req.params.id), body);
    if (!vehicle) return res.status(404).json({ error: "Not found" });
    res.json(vehicle);
  });

  // ===== SERVICE HISTORY =====
  app.get("/api/service-history/customer/:customerId", async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    const history = storage.getServiceHistory(customerId);
    res.json(history);
  });
  app.get("/api/service-history/vehicle/:vehicleId", async (req, res) => {
    const vehicleId = parseInt(req.params.vehicleId);
    const history = storage.getServiceHistoryByVehicle(vehicleId);
    res.json(history);
  });
  app.get("/api/service-history/asset/:assetId", async (req, res) => {
    const assetId = parseInt(req.params.assetId);
    const history = storage.getServiceHistoryByAsset(assetId);
    res.json(history);
  });
  app.post("/api/service-history", async (req, res) => {
    const entry = storage.createServiceHistory(acceptFields(serviceHistory, req.body, res) as any);
    res.json(entry);
  });

  // ===== JOBS =====
  app.get("/api/jobs", async (_req, res) => {
    res.json(storage.getJobs());
  });
  app.get("/api/jobs/:id", async (req, res) => {
    const job = storage.getJob(parseInt(req.params.id));
    if (!job) return res.status(404).json({ error: "Not found" });
    res.json(job);
  });
  app.post("/api/jobs", async (req, res) => {
    try {
      const body = assignmentPatch(acceptFields(jobs, req.body, res, ["jobNumber", "completedDate", "assignedTechId"]));
      const nums = storage.getJobs().map((j: any) => parseInt(String(j.jobNumber).split("-").pop() || "0") || 0);
      body.jobNumber = `JOB-${new Date().getFullYear()}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
      res.json(storage.createJob(body));
    } catch (err: any) {
      res.status(err.status || 400).json({ message: err.message });
    }
  });
  app.patch("/api/jobs/:id", async (req, res) => {
    const id = Number(req.params.id);
    const before = planning("jobs", id);
    const patch = Object.hasOwn(req.body, "assignedTech") ? assignmentPatch(req.body) : { ...req.body };
    delete patch.assignedTech;
    updatePlanning("jobs", id, { revision: before.revision, ...patch });
    res.json(storage.getJob(id));
  });

  // ===== ESTIMATES =====
  app.get("/api/estimates", async (_req, res) => {
    res.json(estimatePlanningList());
  });
  app.get("/api/estimates/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const estimate = storage.getEstimate(id);
    if (!estimate) return res.status(404).json({ error: "Not found" });
    const lineItems = storage.getEstimateLineItems(id);
    res.json({ ...estimate, lineItems });
  });
  app.post("/api/estimates", async (req, res) => {
    res.json(createEstimateSafe(req.body));
  });
  app.patch("/api/estimates/:id", async (req, res) => {
    res.json(updateEstimateSafe(Number(req.params.id), req.body));
  });
  app.post("/api/estimates/:id/line-items", async (req, res) => {
    res.json(addEstimateLines(Number(req.params.id), [req.body])[0]);
  });
  // Bulk add (used by the splat damage map)
  app.post("/api/estimates/:id/line-items/bulk", async (req, res) => {
    const created = addEstimateLines(Number(req.params.id), req.body?.items);
    res.json({ created: created.length });
  });
  app.delete("/api/estimates/line-items/:id", async (req, res) => {
    deleteEstimateLine(Number(req.params.id));
    res.json({ success: true });
  });

  // ===== INVOICES =====
  app.get("/api/invoices", async (_req, res) => {
    res.json(storage.getInvoices());
  });
  app.get("/api/invoices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const invoice = storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    const lineItems = storage.getInvoiceLineItems(id);
    const payments = storage.getPaymentsByInvoice(id);
    res.json({ ...invoice, lineItems, payments });
  });
  app.post("/api/invoices", async (req, res) => {
    res.status(409).json({ message: "Create an invoice from an approved estimate so totals and line items remain consistent." });
  });
  // Convert estimate to invoice
  app.post("/api/estimates/:id/convert-invoice", async (req, res) => {
    res.json(convertEstimate(Number(req.params.id)));
  });
  app.patch("/api/invoices/:id", async (req, res) => {
    res.json(updateInvoiceSafe(Number(req.params.id), req.body));
  });

  // ===== PAYMENTS =====
  app.get("/api/payments", async (_req, res) => {
    res.json(storage.getPayments());
  });
  app.post("/api/payments", async (req, res) => {
    res.json(postPayment(req.body));
  });

  // ===== SERVICE TEMPLATES =====
  app.get("/api/service-templates", async (_req, res) => {
    res.json(storage.getServiceTemplates());
  });

  // ===== PRICING MATRICES =====
  app.get("/api/pricing-matrices", async (_req, res) => {
    res.json(storage.getPricingMatrices());
  });

  // ===== CAMPAIGNS =====
  app.get("/api/campaigns", async (_req, res) => {
    res.json(storage.getCampaigns());
  });
  app.get("/api/campaigns/:id", async (req, res) => {
    const campaign = storage.getCampaign(parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ error: "Not found" });
    res.json(campaign);
  });
  app.post("/api/campaigns", async (req, res) => {
    res.json(storage.createCampaign(acceptFields(campaigns, req.body, res) as any));
  });
  app.patch("/api/campaigns/:id", async (req, res) => {
    const campaign = storage.updateCampaign(parseInt(req.params.id), acceptFields(campaigns, req.body, res) as any);
    if (!campaign) return res.status(404).json({ error: "Not found" });
    res.json(campaign);
  });

  // ===== ACTIVITIES =====
  app.get("/api/activities", async (_req, res) => {
    res.json(storage.getActivities());
  });
  app.post("/api/activities", async (req, res) => {
    res.json(storage.createActivity({ ...acceptFields(activities, req.body, res), performedBy: actorLabel() } as any));
  });

  // ===== QB SYNC =====
  app.get("/api/qb-sync", async (_req, res) => {
    res.json(storage.getQbSyncLog());
  });
  app.post("/api/qb-sync", async (req, res) => {
    res.status(409).json({message:"QuickBooks Desktop is not connected. Sync acknowledgments can only be created by a verified connector response."});
  });
  app.post("/api/qb-sync/run", async (_req, res) => {
    res.status(409).json({success:false,synced:0,message:"QuickBooks Desktop Enterprise is not connected. Nothing was transmitted or marked synced. Configure and test an approved Desktop bridge before enabling transfers."});
  });

  // ===== TECHNICIANS =====
  app.get("/api/technicians", async (_req, res) => {
    res.json(storage.getTechnicians());
  });
  app.get("/api/technicians/:id", async (req, res) => {
    const tech = storage.getTechnician(parseInt(req.params.id));
    if (!tech) return res.status(404).json({ error: "Not found" });
    res.json(tech);
  });
  app.post("/api/technicians", async (req, res) => {
    res.json(storage.createTechnician(acceptFields(technicians, req.body, res, ["userId"]) as any));
  });
  app.patch("/api/technicians/:id", async (req, res) => {
    const tech = storage.updateTechnician(parseInt(req.params.id), acceptFields(technicians, req.body, res, ["userId"]) as any);
    if (!tech) return res.status(404).json({ error: "Not found" });
    res.json(tech);
  });

  // ===== SCHEDULE SLOTS =====
  app.get("/api/schedule-slots", async (_req, res) => {
    res.json(storage.getScheduleSlots());
  });
  app.get("/api/schedule-slots/:id", async (req, res) => {
    const slot = storage.getScheduleSlot(parseInt(req.params.id));
    if (!slot) return res.status(404).json({ error: "Not found" });
    res.json(slot);
  });
  app.post("/api/schedule-slots", async (req, res) => {
    const body: any = acceptFields(scheduleSlots, req.body, res);
    if (body.jobId) {
      const job = storage.getJob(body.jobId);
      if (!job) fail("Work order not found");
      if (body.customerId && body.customerId !== job.customerId) fail("Schedule customer must match the work order");
      body.customerId = job.customerId;
    }
    res.json(storage.createScheduleSlot(validateSlot(body)));
  });
  app.patch("/api/schedule-slots/:id", async (req, res) => {
    const slot = storage.updateScheduleSlot(parseInt(req.params.id), validateSlot(acceptFields(scheduleSlots, req.body, res),Number(req.params.id)));
    if (!slot) return res.status(404).json({ error: "Not found" });
    res.json(slot);
  });
  app.delete("/api/schedule-slots/:id", async (req, res) => {
    storage.deleteScheduleSlot(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== BOOKINGS =====
  app.get("/api/bookings", async (_req, res) => {
    res.json(storage.getBookings());
  });
  app.get("/api/bookings/:id", async (req, res) => {
    const booking = storage.getBooking(parseInt(req.params.id));
    if (!booking) return res.status(404).json({ error: "Not found" });
    res.json(booking);
  });
  app.post("/api/bookings", async (req, res) => {
    const booking = storage.createBooking(acceptFields(bookings, req.body, res) as any);
    storage.createActivity({
      customerId: booking.customerId,
      activityType: 'note',
      description: `New booking request: ${booking.bookingNumber} - ${booking.bookingType} for ${booking.serviceType}`,
      performedBy: 'Customer Portal',
    });
    res.json(booking);
  });
  app.patch("/api/bookings/:id", async (req, res) => {
    const booking = storage.updateBooking(parseInt(req.params.id), acceptFields(bookings, req.body, res, ["bookingNumber"]) as any);
    if (!booking) return res.status(404).json({ error: "Not found" });
    if (req.body.status === 'confirmed') {
      storage.createActivity({
        customerId: booking.customerId,
        activityType: 'note',
        description: `Booking ${booking.bookingNumber} confirmed for ${booking.confirmedDate} at ${booking.confirmedTime}`,
        performedBy: 'System Admin',
      });
    }
    res.json(booking);
  });

  // ===== EMAIL INVOICE ROUTE =====
  app.post("/api/invoices/:id/email", async (req, res) => {
    const invoice = printable(storage.getInvoices().find((inv: any) => inv.id === parseInt(req.params.id)));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const lineItems = printable(storage.getInvoiceLineItems(invoice.id));
    const customer = printable(storage.getCustomers().find((c: any) => c.id === invoice.customerId));
    const estimate: any = invoice.estimateId ? storage.getEstimate(invoice.estimateId) : null;
    const job: any = invoice.jobId ? storage.getJobs().find((j: any) => j.id === invoice.jobId) : null;
    const vehId = estimate?.vehicleId || job?.vehicleId;
    const vehicle: any = printable(vehId ? storage.getVehicle(vehId) : null);
    const assetIdRef = estimate?.assetId || job?.assetId;
    const asset: any = printable(assetIdRef && customer ? storage.getAssets(customer.id).find((a: any) => a.id === assetIdRef) : null);
    const { subtotal, taxAmount, total } = invoice;
    const custName = customer ? (customer.companyName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim()) : "";
    const vehInfo = vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "";
    const vehLabel = vehicle?.vehicleType === "marine" ? "Boat" : vehicle?.vehicleType === "rv" ? "RV" : "Vehicle";
    const idLabel = vehicle?.vehicleType === "marine" ? "HIN" : "VIN";
    const assetInfo = asset ? `${asset.name || ""}${asset.location ? " — " + asset.location : ""}` : "";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const dueDate = formatCalendarDate(invoice.dueDate || "");
    const serviceLabel: Record<string, string> = {
      pdr: "PDR", hail: "Hail Repair", window_tint: "Window Tint",
      interior_repair: "Auto Interior Repair", rv_interior: "RV Interior Repair",
      rv_upholstery: "RV Upholstery", marine_interior: "Marine Interior Repair",
      marine_upholstery: "Marine Upholstery", upholstery: "Furniture Upholstery",
    };
    const stLabel = estimate?.serviceType ? (serviceLabel[estimate.serviceType] || estimate.serviceType) : (job?.serviceType ? (serviceLabel[job.serviceType] || job.serviceType) : "");
    const recipientEmail = TEST_EMAIL;
    if (!recipientEmail) return res.status(400).json({ error: "No recipient email address found" });

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:800px;margin:0 auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;border-bottom:3px solid #0e7490;padding-bottom:20px;margin-bottom:20px;">
        <div><div style="font-size:24px;font-weight:bold;color:#0e7490;">McDowells Specialty Repair</div>
        <div style="font-size:12px;color:#666;margin-top:2px;">Paintless Dent Repair | Hail | Interior | Upholstery | Tint</div></div>
        <div style="text-align:right;"><div style="font-size:28px;font-weight:bold;">INVOICE</div>
        <div style="font-size:14px;color:#666;">${invoice.invoiceNumber}</div>
        <div style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold;text-transform:uppercase;background:#fef3e2;color:#92400e;">${invoice.status}</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div style="font-size:13px;line-height:1.6;">
          <div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px;">Bill To</div>
          <div style="font-size:14px;">${custName}</div>
          ${customer?.phone ? `<div>${customer.phone}</div>` : ""}
          <div>${recipientEmail}</div>
          ${customer?.address ? `<div>${customer.address}</div>${customer?.city ? `<div>${customer.city}, ${customer.state || ""} ${customer.zip || ""}</div>` : ""}` : ""}
        </div>
        <div style="font-size:13px;line-height:1.6;text-align:right;">
          <div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-bottom:4px;">Issue Date</div>
          <div style="font-size:14px;">${formatCalendarDate(invoice.issueDate)}</div>
          ${dueDate ? `<div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-top:10px;">Due Date</div><div style="font-size:14px;">${dueDate}</div>` : ""}
          ${vehInfo ? `<div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-top:10px;">${vehLabel}</div><div style="font-size:14px;">${vehInfo}</div>${vehicle?.vin ? `<div style="font-size:12px;">${idLabel}: ${vehicle.vin}</div>` : ""}` : ""}${assetInfo ? `<div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-top:10px;">Item</div><div style="font-size:14px;">${assetInfo}</div>` : ""}
          ${stLabel ? `<div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#888;margin-top:10px;">Service Type</div><div style="font-size:14px;">${stLabel}</div>` : ""}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr><th style="background:#f0f4f5;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #0e7490;">Description</th><th style="background:#f0f4f5;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #0e7490;">Qty</th><th style="background:#f0f4f5;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #0e7490;">Unit Price</th><th style="background:#f0f4f5;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #0e7490;">Total</th></tr></thead>
        <tbody>
          ${lineItems.map((item: any) => `<tr><td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #e0e0e0;">${item.description}<br><small>${customerLineLabel(item)}</small></td><td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #e0e0e0;text-align:right;">${item.quantity} ${item.unit}</td><td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #e0e0e0;text-align:right;">$${(item.unitPrice || 0).toFixed(2)}</td><td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #e0e0e0;text-align:right;">$${(item.total || 0).toFixed(2)}</td></tr>`).join("")}
          ${lineItems.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">No line items</td></tr>' : ""}
        </tbody>
      </table>
      <table style="margin-left:auto;width:280px;margin-top:10px;">
        ${breakdownHtml(lineItems,subtotal)}
        <tr><td style="padding:6px 12px;">Subtotal</td><td style="padding:6px 12px;text-align:right;">$${subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 12px;">${documentBreakdown(lineItems,subtotal).taxLabel} (${invoice.taxRate || 0}%)</td><td style="padding:6px 12px;text-align:right;">$${taxAmount.toFixed(2)}</td></tr>
        ${invoice.discount ? `<tr><td style="padding:6px 12px;">Discount</td><td style="padding:6px 12px;text-align:right;">-$${(invoice.discount || 0).toFixed(2)}</td></tr>` : ""}
        <tr><td style="border-top:2px solid #0e7490;font-weight:bold;font-size:16px;padding-top:10px;padding:6px 12px;">Total</td><td style="border-top:2px solid #0e7490;font-weight:bold;font-size:16px;padding-top:10px;padding:6px 12px;text-align:right;">$${total.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 12px;">Paid</td><td style="padding:6px 12px;text-align:right;">$${(invoice.amountPaid || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 12px;">Balance Due</td><td style="padding:6px 12px;text-align:right;">$${(invoice.balanceDue || 0).toFixed(2)}</td></tr>
      </table>
      ${invoice.notes ? `<div style="margin-top:20px;font-size:13px;color:#555;border-top:1px solid #e0e0e0;padding-top:15px;"><strong>Notes:</strong><br>${invoice.notes}</div>` : ""}
      <div style="margin-top:30px;font-size:11px;color:#999;text-align:center;border-top:1px solid #e0e0e0;padding-top:15px;">McDowells Specialty Repair | Boise, Idaho | Payment due within 30 days of issue date.</div>
      </body></html>`;


    // Write email content to file for external sending
    saveEmailCopy(`invoice-${invoice.invoiceNumber}.html`, emailHtml, recipientEmail);

    // Try to send via SMTP if configured
    let smtpResult: any = null;
    const transporter = getEmailTransporter();
    if (transporter) {
      try {
        smtpResult = await transporter.sendMail({
          from: `McDowells Specialty Repair <${SMTP_CONFIG.user}>`,
          to: recipientEmail,
          subject: `Invoice ${invoice.invoiceNumber} - McDowells Specialty Repair`,
          html: emailHtml,
        });
        console.log(`Email sent: ${invoice.invoiceNumber} -> ${recipientEmail} (MessageId: ${smtpResult.messageId})`);
      } catch (err: any) {
        console.error(`SMTP error for ${invoice.invoiceNumber}: ${err.message}`);
        smtpResult = { error: err.message };
      }
    }

    const delivered = recordDelivery("invoice",invoice.id,recipientEmail,smtpResult,!!transporter);
    storage.createActivity({
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      activityType: "email",
      description: delivered
        ? `Invoice ${invoice.invoiceNumber} accepted by email provider for ${recipientEmail}; recipient delivery unconfirmed`
        : `Invoice ${invoice.invoiceNumber} prepared for ${recipientEmail} (not delivered: ${smtpResult?.error || "email server not set up"})`,
      performedBy: "System Admin",
    });
    res.json({ success: delivered, delivered:false, providerAccepted:delivered, message: delivered ? `Email provider accepted invoice for ${recipientEmail}; delivery unconfirmed` : `Invoice prepared for ${recipientEmail}, not sent`, invoiceNumber: invoice.invoiceNumber, recipientEmail, smtpResult: smtpResult ? { messageId: smtpResult.messageId, error: smtpResult.error } : null });
  });

  // ===== SEND ESTIMATE TO CUSTOMER =====
  app.post("/api/estimates/:id/send", async (req, res) => {
    const estimate: any = storage.getEstimate(parseInt(req.params.id));
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    if (estimate.invoiceId || estimate.status === "invoiced" || sqlite.prepare("SELECT id FROM invoices WHERE estimate_id=?").get(estimate.id))
      return res.status(409).json({ message: "This estimate is invoiced and locked. Use the invoice document instead." });
    const customer: any = storage.getCustomers().find((c: any) => c.id === estimate.customerId);
    const to = TEST_EMAIL;
    const note = String(req.body?.message || "").trim();
    if (!to || !to.split(/\s*,\s*/).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return res.status(400).json({ message: "A valid customer email address is required" });
    const lineItems = storage.getEstimateLineItems(estimate.id);
    if (lineItems.length === 0) return res.status(400).json({ message: "This estimate has no line items yet. Add at least one line item before sending." });
    validateEstimateServices(estimate.id);
    if (lineItems.some(i=>i.lineType==="legacy")) return res.status(409).json({message:"Classify all lines as parts or labor before sending an estimate."});

    // Reuse the printable estimate as the email body (strip auto-print script)
    let html = "";
    try {
      const port = process.env.PORT || 5000;
      const r = await fetch(`${internalOrigin(port)}/print/estimate/${estimate.id}`, {headers:{Authorization:req.headers.authorization || ""}});
      if (!r.ok) throw new Error("Printable estimate was unavailable.");
      html = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
    } catch (e: any) {
      return res.status(500).json({ message: "Could not build estimate email: " + e.message });
    }
    if (note) {
      const safe = note.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[ch]).replace(/\n/g, "<br>");
      html = html.replace(/<body([^>]*)>/i, `<body$1><div style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 20px;padding:12px 16px;background:#f5f5f5;border-radius:6px;">${safe}</div>`);
    }

    saveEmailCopy(`estimate-${estimate.estimateNumber}.html`, html, to);

    let smtpResult: any = null;
    const transporter = getEmailTransporter();
    if (transporter) {
      try {
        smtpResult = await transporter.sendMail({
          from: `McDowells Specialty Repair <${SMTP_CONFIG.user}>`,
          to,
          subject: `Estimate ${estimate.estimateNumber} - McDowells Specialty Repair`,
          html,
        });
      } catch (err: any) {
        smtpResult = { error: err.message };
      }
    }
    const delivered = recordDelivery("estimate",estimate.id,to,smtpResult,!!transporter);

    const validUntil = estimate.validUntil || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    // Re-read after asynchronous delivery; never overwrite a concurrent approval or conversion.
    sqlite.prepare(`UPDATE estimates SET status=CASE WHEN ?=1 AND status='draft' THEN 'sent' ELSE status END,valid_until=coalesce(valid_until,?)
      WHERE id=? AND invoice_id IS NULL AND NOT EXISTS(SELECT 1 FROM invoices WHERE estimate_id=?)`).run(delivered?1:0,validUntil,estimate.id,estimate.id);
    const updated = storage.getEstimate(estimate.id);
    storage.createActivity({
      customerId: estimate.customerId,
      jobId: estimate.jobId,
      activityType: "email",
      description: delivered
        ? `Estimate ${estimate.estimateNumber} accepted by email provider for ${to}; recipient delivery unconfirmed`
        : `Estimate ${estimate.estimateNumber} NOT sent to ${to}; ${smtpResult?.error || "email server not configured"}. Approval status preserved.`,
      performedBy: "System Admin",
    } as any);

    res.json({
      success: delivered,
      delivered: false,
      providerAccepted: delivered,
      smtpConfigured: !!transporter,
      smtpError: smtpResult?.error || null,
      to,
      subject: `Estimate ${estimate.estimateNumber} - McDowells Specialty Repair`,
      total: estimate.total,
      estimate: updated,
    });
  });

  // ===== SMTP SETTINGS ROUTE =====
  app.get("/api/smtp-settings", async (_req, res) => {
    res.json({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      configured: !!(SMTP_CONFIG.user && SMTP_CONFIG.pass),
      user: SMTP_CONFIG.user ? SMTP_CONFIG.user.replace(/(.{2}).*(@.*)/, "$1***$2") : "",
    });
  });

  app.post("/api/smtp-settings/test", async (req, res) => {
    const { to } = req.body;
    const testEmail = TEST_EMAIL;
    const transporter = getEmailTransporter();
    if (!transporter) {
      return res.status(400).json({ error: "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables." });
    }
    try {
      const info = await transporter.sendMail({
        from: `McDowells Specialty Repair <${SMTP_CONFIG.user}>`,
        to: testEmail,
        subject: "RepairPro CRM - SMTP Test",
        html: "<h2>SMTP Test</h2><p>Your email configuration is working correctly.</p><p>McDowells Specialty Repair CRM</p>",
      });
      res.json({ success: true, messageId: info.messageId, message: `Test email sent to ${testEmail}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== PRINT ROUTES =====
  app.get("/print/estimate/:id", async (req, res) => {
    const estimate = printable(storage.getEstimate(parseInt(req.params.id)));
    if (!estimate) return res.status(404).send("Estimate not found");
    const lineItems = printable(storage.getEstimateLineItems(estimate.id));
    const customer = printable(storage.getCustomers().find((c: any) => c.id === estimate.customerId));
    const vehicle: any = printable(estimate.vehicleId ? storage.getVehicle(estimate.vehicleId) : null);
    const asset: any = printable(estimate.assetId && customer ? storage.getAssets(customer.id).find((a: any) => a.id === estimate.assetId) : null);
    const { subtotal, taxAmount, total } = estimate;
    const custName = customer ? (customer.companyName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim()) : "";
    const vehInfo = vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "";
    const vehLabel = vehicle?.vehicleType === "marine" ? "Boat" : vehicle?.vehicleType === "rv" ? "RV" : "Vehicle";
    const idLabel = vehicle?.vehicleType === "marine" ? "HIN" : "VIN";
    const assetInfo = asset ? `${asset.name || ""}${asset.location ? " — " + asset.location : ""}` : "";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const serviceLabel: Record<string, string> = {
      pdr: "PDR", hail: "Hail Repair", window_tint: "Window Tint",
      interior_repair: "Auto Interior Repair", rv_interior: "RV Interior Repair",
      rv_upholstery: "RV Upholstery", marine_interior: "Marine Interior Repair",
      marine_upholstery: "Marine Upholstery", upholstery: "Furniture Upholstery",
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estimate ${estimate.estimateNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0e7490; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #0e7490; }
        .logo-sub { font-size: 12px; color: #666; margin-top: 2px; }
        .doc-title { font-size: 28px; font-weight: bold; text-align: right; }
        .doc-num { font-size: 14px; color: #666; text-align: right; margin-top: 4px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .info-block { font-size: 13px; line-height: 1.6; }
        .info-label { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
        .info-value { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f0f4f5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 2px solid #0e7490; }
        td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e0e0e0; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 280px; margin-top: 10px; }
        .totals tr td { border: none; padding: 6px 12px; }
        .totals tr:last-child td { border-top: 2px solid #0e7490; font-weight: bold; font-size: 16px; padding-top: 10px; }
        .notes { margin-top: 30px; font-size: 13px; color: #555; border-top: 1px solid #e0e0e0; padding-top: 15px; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 15px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; background: #e0f2f1; color: #0e7490; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div><div class="logo">McDowells Specialty Repair</div><div class="logo-sub">Paintless Dent Repair | Hail | Interior | Upholstery | Tint</div></div>
        <div><div class="doc-title">ESTIMATE</div><div class="doc-num">${estimate.estimateNumber}</div><div class="badge">${estimate.status}</div></div>
      </div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Bill To</div>
          <div class="info-value">${custName}</div>
          ${customer?.phone ? `<div>${customer.phone}</div>` : ""}
          ${customer?.email ? `<div>${customer.email}</div>` : ""}
          ${customer?.address ? `<div>${customer.address}</div>` : ""}
        </div>
        <div class="info-block" style="text-align:right">
          <div class="info-label">Date</div>
          <div class="info-value">${today}</div>
          ${estimate.validUntil ? `<div class="info-label" style="margin-top:10px">Valid Until</div><div class="info-value">${formatCalendarDate(estimate.validUntil)}</div>` : ""}
          ${vehInfo ? `<div class="info-label" style="margin-top:10px">${vehLabel}</div><div class="info-value">${vehInfo}</div>${vehicle?.vin ? `<div style="font-size:12px">${idLabel}: ${vehicle.vin}</div>` : ""}` : ""}${assetInfo ? `<div class="info-label" style="margin-top:10px">Item</div><div class="info-value">${assetInfo}</div>` : ""}
          ${estimate.serviceType ? `<div class="info-label" style="margin-top:10px">Service Type</div><div class="info-value">${serviceLabel[estimate.serviceType] || estimate.serviceType}</div>` : ""}
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Repair area</th>${["pdr","hail"].includes(estimate.serviceType)?"<th>Dent size</th>":""}<th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${lineItems.map((item: any) => `<tr><td>${item.description}<br><small>${customerLineLabel(item)}</small></td><td>${item.panelLocation || ""}</td>${["pdr","hail"].includes(estimate.serviceType)?`<td>${item.damageSize || ""}</td>`:""}<td class="text-right">${item.quantity} ${item.unit}</td><td class="text-right">$${(item.unitPrice || 0).toFixed(2)}</td><td class="text-right">$${(item.total || 0).toFixed(2)}</td></tr>`).join("")}
          ${lineItems.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">No line items</td></tr>' : ""}
        </tbody>
      </table>
      <table class="totals">
        ${breakdownHtml(lineItems,subtotal)}
        <tr><td>Subtotal</td><td class="text-right">$${subtotal.toFixed(2)}</td></tr>
        <tr><td>${documentBreakdown(lineItems,subtotal).taxLabel} (${estimate.taxRate || 0}%)</td><td class="text-right">$${taxAmount.toFixed(2)}</td></tr>
        ${estimate.discount ? `<tr><td>Discount</td><td class="text-right">-$${(estimate.discount || 0).toFixed(2)}</td></tr>` : ""}
        <tr><td>Total</td><td class="text-right">$${total.toFixed(2)}</td></tr>
      </table>
      ${estimate.notes ? `<div class="notes"><strong>Notes:</strong><br>${estimate.notes}</div>` : ""}
      <div class="footer">McDowells Specialty Repair | Boise, Idaho | This estimate is valid for 14 days unless otherwise noted.</div>
      <script>${AUTO_PRINT_SCRIPT}</script>
      </body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  app.get("/print/invoice/:id", async (req, res) => {
    const invoice = printable(storage.getInvoices().find((inv: any) => inv.id === parseInt(req.params.id)));
    if (!invoice) return res.status(404).send("Invoice not found");
    const lineItems = printable(storage.getInvoiceLineItems(invoice.id));
    const customer = printable(storage.getCustomers().find((c: any) => c.id === invoice.customerId));
    const estimate: any = printable(invoice.estimateId ? storage.getEstimate(invoice.estimateId) : null);
    const job: any = printable(invoice.jobId ? storage.getJobs().find((j: any) => j.id === invoice.jobId) : null);
    const vehId = estimate?.vehicleId || job?.vehicleId;
    const vehicle: any = printable(vehId ? storage.getVehicle(vehId) : null);
    const assetIdRef = estimate?.assetId || job?.assetId;
    const asset: any = printable(assetIdRef && customer ? storage.getAssets(customer.id).find((a: any) => a.id === assetIdRef) : null);
    const { subtotal, taxAmount, total } = invoice;
    const custName = customer ? (customer.companyName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim()) : "";
    const vehInfo = vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "";
    const vehLabel = vehicle?.vehicleType === "marine" ? "Boat" : vehicle?.vehicleType === "rv" ? "RV" : "Vehicle";
    const idLabel = vehicle?.vehicleType === "marine" ? "HIN" : "VIN";
    const assetInfo = asset ? `${asset.name || ""}${asset.location ? " — " + asset.location : ""}` : "";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const dueDate = formatCalendarDate(invoice.dueDate || "");
    const serviceLabel: Record<string, string> = {
      pdr: "PDR", hail: "Hail Repair", window_tint: "Window Tint",
      interior_repair: "Auto Interior Repair", rv_interior: "RV Interior Repair",
      rv_upholstery: "RV Upholstery", marine_interior: "Marine Interior Repair",
      marine_upholstery: "Marine Upholstery", upholstery: "Furniture Upholstery",
    };
    const stLabel = estimate?.serviceType ? (serviceLabel[estimate.serviceType] || estimate.serviceType) : (job?.serviceType ? (serviceLabel[job.serviceType] || job.serviceType) : "");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0e7490; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #0e7490; }
        .logo-sub { font-size: 12px; color: #666; margin-top: 2px; }
        .doc-title { font-size: 28px; font-weight: bold; text-align: right; }
        .doc-num { font-size: 14px; color: #666; text-align: right; margin-top: 4px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .info-block { font-size: 13px; line-height: 1.6; }
        .info-label { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
        .info-value { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f0f4f5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 2px solid #0e7490; }
        td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e0e0e0; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 280px; margin-top: 10px; }
        .totals tr td { border: none; padding: 6px 12px; }
        .totals tr:last-child td { border-top: 2px solid #0e7490; font-weight: bold; font-size: 16px; padding-top: 10px; }
        .notes { margin-top: 30px; font-size: 13px; color: #555; border-top: 1px solid #e0e0e0; padding-top: 15px; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 15px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; background: #fef3e2; color: #92400e; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div><div class="logo">McDowells Specialty Repair</div><div class="logo-sub">Paintless Dent Repair | Hail | Interior | Upholstery | Tint</div></div>
        <div><div class="doc-title">INVOICE</div><div class="doc-num">${invoice.invoiceNumber}</div><div class="badge">${invoice.status}</div></div>
      </div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Bill To</div>
          <div class="info-value">${custName}</div>
          ${customer?.phone ? `<div>${customer.phone}</div>` : ""}
          ${customer?.email ? `<div>${customer.email}</div>` : ""}
          ${customer?.address ? `<div>${customer.address}</div>` : ""}
        </div>
        <div class="info-block" style="text-align:right">
          <div class="info-label">Issue Date</div>
          <div class="info-value">${formatCalendarDate(invoice.issueDate)}</div>
          ${dueDate ? `<div class="info-label" style="margin-top:10px">Due Date</div><div class="info-value">${dueDate}</div>` : ""}
          ${vehInfo ? `<div class="info-label" style="margin-top:10px">${vehLabel}</div><div class="info-value">${vehInfo}</div>${vehicle?.vin ? `<div style="font-size:12px">${idLabel}: ${vehicle.vin}</div>` : ""}` : ""}${assetInfo ? `<div class="info-label" style="margin-top:10px">Item</div><div class="info-value">${assetInfo}</div>` : ""}
          ${stLabel ? `<div class="info-label" style="margin-top:10px">Service Type</div><div class="info-value">${stLabel}</div>` : ""}
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${lineItems.map((item: any) => `<tr><td>${item.description}<br><small>${customerLineLabel(item)}</small></td><td class="text-right">${item.quantity} ${item.unit}</td><td class="text-right">$${(item.unitPrice || 0).toFixed(2)}</td><td class="text-right">$${(item.total || 0).toFixed(2)}</td></tr>`).join("")}
          ${lineItems.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">No line items</td></tr>' : ""}
        </tbody>
      </table>
      <table class="totals">
        ${breakdownHtml(lineItems,subtotal)}
        <tr><td>Subtotal</td><td class="text-right">$${subtotal.toFixed(2)}</td></tr>
        <tr><td>${documentBreakdown(lineItems,subtotal).taxLabel} (${invoice.taxRate || 0}%)</td><td class="text-right">$${taxAmount.toFixed(2)}</td></tr>
        ${invoice.discount ? `<tr><td>Discount</td><td class="text-right">-$${(invoice.discount || 0).toFixed(2)}</td></tr>` : ""}
        <tr><td>Total</td><td class="text-right">$${total.toFixed(2)}</td></tr>
        <tr><td>Paid</td><td class="text-right">$${(invoice.amountPaid || 0).toFixed(2)}</td></tr>
        <tr><td>Balance Due</td><td class="text-right">$${(invoice.balanceDue || 0).toFixed(2)}</td></tr>
      </table>
      ${invoice.notes ? `<div class="notes"><strong>Notes:</strong><br>${invoice.notes}</div>` : ""}
      <div class="footer">McDowells Specialty Repair | Boise, Idaho | Payment due within 30 days of issue date.</div>
      <script>${AUTO_PRINT_SCRIPT}</script>
      </body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  return _httpServer;
}
