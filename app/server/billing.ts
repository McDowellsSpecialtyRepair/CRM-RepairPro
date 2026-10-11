import { storage } from "./storage";
import { sqlite } from "./storage-db";
import { localToday, addDays } from "../shared/operations";
import {validDate} from "../shared/reporting";
import {SERVICES,DOMAIN_VEHICLE_TYPES} from "../shared/services";
import { lineNetCents, requireAllocations, apportion } from "./labor";
import { savedHailCarriers } from "../shared/hail-reference";
import { categoryAllowed, categoryTaxable, nonLaborCategory, repairActionsFor, templateAllowed } from "../shared/estimate-rules";
import { snapshotSales } from "./estimate-sales";

export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const money = (n: number) => cents(n) / 100;
function number(value: any, label: string, min = 0, max = 1e9) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`${label} is invalid`);
  return value;
}
const pick = (data: any, fields: string[]) => Object.fromEntries(fields.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
function validateTarget(body:any) {
  const svc=SERVICES.find(s=>s.value===body.serviceType);
  if(!svc)fail("Choose a supported service type");
  if(body.validUntil!=null&&body.validUntil!==""&&(typeof body.validUntil!=="string"||!validDate(body.validUntil)))fail("Enter a valid estimate expiration date");
  if(body.vehicleId&&body.assetId)fail("An estimate cannot target both a vehicle and an item");
  if(body.assetId) {
    const asset=storage.getAssets(body.customerId).find(a=>a.id===body.assetId);
    if(!asset||svc.target!=="asset")fail("Choose an item belonging to this customer and service");
  }
  if(body.vehicleId) {
    const vehicle=storage.getVehicle(body.vehicleId);
    if(!vehicle||vehicle.customerId!==body.customerId||svc.target!=="vehicle"||!DOMAIN_VEHICLE_TYPES[svc.domain]?.includes(vehicle.vehicleType))
      fail("Choose a vehicle belonging to this customer and service department");
  }
}
export function editableEstimate(id: number) {
  const est = storage.getEstimate(id);
  if (!est) fail("Estimate not found", 404);
  if (est.invoiceId || sqlite.prepare("SELECT id FROM invoices WHERE estimate_id=?").get(id))
    fail("This estimate is invoiced and locked. Use a separately approved adjustment.", 409);
  return est;
}
export function recalculateEstimate(id: number) {
  const est = storage.getEstimate(id)!;
  const lines = storage.getEstimateLineItems(id);
  const subtotalCents = lines.reduce((s, i) => s + cents(i.total), 0);
  const rate = number(est.taxRate, "Tax rate", 0, 100);
  const discount = cents(number(est.discount, "Discount"));
  if (discount > subtotalCents) fail("Discount cannot exceed the subtotal");
  const exempt = storage.getCustomer(est.customerId)?.taxExempt;
  const net = lineNetCents(lines, est.discount);
  const parts = lines.reduce((s,l,i) => s+(categoryTaxable(l.serviceCategory,l.lineType) ? net[i] : 0),0);
  const tax = exempt ? 0 : Math.round(parts * rate / 100);
  return storage.updateEstimate(id, { subtotal: subtotalCents / 100, taxAmount: tax / 100, total: (subtotalCents + tax - discount) / 100 })!;
}
export function createEstimateSafe(body: any) {
  return sqlite.transaction(() => {
    const customer = storage.getCustomer(body.customerId);
    if (!customer) fail("A valid customer is required");
    validateTarget(body);
    const next = (sqlite.prepare("SELECT coalesce(max(id),0)+1 n FROM estimates").get() as any).n;
    return storage.createEstimate({
      ...pick(body, ["customerId", "jobId", "vehicleId", "assetId", "serviceType", "notes", "validUntil"]),
      estimateNumber: `EST-${localToday().slice(0,4)}-${String(next).padStart(6, "0")}`,
      taxRate: number(body.taxRate ?? 6, "Tax rate", 0, 100),
      discount: 0, status: "draft", subtotal: 0, taxAmount: 0, total: 0,
    });
  }).immediate();
}
export function updateEstimateSafe(id: number, body: any) {
  return sqlite.transaction(() => {
    const est = editableEstimate(id);
    const allowed = ["notes", "validUntil", "vehicleId", "assetId", "jobId", "taxRate", "discount", "status", "approvedDate"];
    if (Object.keys(body).some(k => !allowed.includes(k))) fail("Unsupported or server-calculated estimate field");
    if (body.status && !["draft", "sent", "approved", "rejected", "expired"].includes(body.status)) fail("Invalid estimate status");
    if (body.status === "sent" && est.status !== "sent") fail("Sent status requires acceptance by a configured email provider.",409);
    if (body.status === "approved" && storage.getEstimateLineItems(id).some(i => i.lineType === "legacy"))
      fail("Classify every existing line as parts or labor before approving.",409);
    const data = { ...body };
    if(["vehicleId","assetId","validUntil"].some(k=>Object.hasOwn(body,k)))validateTarget({...est,...body});
    if(body.status==="approved"&&!storage.getEstimateLineItems(id).length)fail("Add line items before approving an estimate");
    if(body.status==="approved")validateEstimateServices(id);
    if (body.discount !== undefined) data.discount = money(number(body.discount, "Discount"));
    if (body.taxRate !== undefined) number(body.taxRate, "Tax rate", 0, 100);
    if (["discount","taxRate","vehicleId","assetId","jobId"].some(k=>Object.hasOwn(body,k)) && est.status === "approved") {
      data.status = "draft"; data.approvedDate = null;
    }
    if (data.status === "approved") data.approvedDate = localToday();
    else if(data.status&&["draft","rejected","expired"].includes(data.status))data.approvedDate=null;
    storage.updateEstimate(id, data);
    return recalculateEstimate(id);
  }).immediate();
}
export function validateEstimateServices(id:number){
  const est=storage.getEstimate(id)!;
  for(const line of storage.getEstimateLineItems(id)) {
    if(!categoryAllowed(est.serviceType,line.serviceCategory))fail(`Remove or correct the unrelated service line: ${line.description}`,409);
    if(nonLaborCategory(line.serviceCategory)&&line.lineType!=="parts")fail(`Materials, supplies and freight cannot be technician labor: ${line.description}`,409);
    if(!repairActionsFor(est.serviceType).includes(line.repairAction||"repair") ||
      line.repairAction==="fabricate"&&line.serviceCategory!=="fabrication" ||
      line.serviceCategory==="fabrication"&&line.lineType!=="labor")
      fail(`Correct the repair operation and tax classification: ${line.description}`,409);
  }
}
function validatedLine(it: any, estimateId: number) {
  if (!it || typeof it.description !== "string" || !it.description.trim() || typeof it.serviceCategory !== "string" || !it.serviceCategory)
    fail("Each line requires a description and service category");
  const quantity = number(it.quantity ?? 1, "Quantity", 0.000001, 1e6);
  const unitPrice = money(number(it.unitPrice ?? 0, "Unit price"));
  const total = money(quantity * unitPrice);
  const est=storage.getEstimate(estimateId)!;
  if(!categoryAllowed(est.serviceType,it.serviceCategory))fail("This line category does not belong to this estimate's service. Create a separate estimate for a different service.");
  if(it.templateId!=null){
    const template=storage.getServiceTemplates().find(t=>t.id===it.templateId);
    if(!template||!templateAllowed(est.serviceType,template))fail("This Quick Add template belongs to another service or is inactive.");
  }
  const lineType = it.lineType ?? (nonLaborCategory(it.serviceCategory) ? "parts" : "labor");
  if (!["parts","labor"].includes(lineType)) fail("Choose parts or labor for each line");
  if(nonLaborCategory(it.serviceCategory)&&lineType!=="parts")fail("Materials, supplies and freight must be non-labor charges.");
  const unitCost=money(number(it.unitCost??0,"Purchase unit cost"));
  number(money(unitCost*quantity),"Extended purchase cost");
  const useTaxRate=number(it.useTaxRate??0,"Use tax rate",0,100);
  const taxNote=String(it.taxNote??"").trim();
  const repairAction=it.repairAction??"repair";
  if(!repairActionsFor(est.serviceType).includes(repairAction))fail("Choose a repair operation offered by this service.");
  if(repairAction==="fabricate"&&it.serviceCategory!=="fabrication")fail("New fabrication must use the taxable fabrication category, not repair labor.");
  if(it.serviceCategory==="fabrication"&&lineType!=="labor")fail("Fabrication is labor, not a material charge.");
  if(useTaxRate>0&&(it.serviceCategory!=="supplies"||unitCost<=0||!taxNote))fail("Use tax requires a shop-consumed supply cost and a note confirming tax owed on the purchase. Do not apply it to resale materials.");
  if(taxNote.length>500||it.description.length>4000)fail("Description or tax note is too long");
  number(total, "Line total");
  return {serviceCategory:String(it.serviceCategory),unit:String(it.unit||"each"),panelLocation:String(it.panelLocation||""),damageSize:String(it.damageSize||""),damageSeverity:String(it.damageSeverity||""),description:it.description as string,lineType,estimateId,quantity,unitPrice,total,unitCost,useTaxRate,taxNote,repairAction};
}
export function updateEstimateLine(id:number,body:any){
  return sqlite.transaction(()=>{
    const raw=sqlite.prepare("SELECT estimate_id FROM estimate_line_items WHERE id=?").get(id) as any;
    if(!raw)fail("Line not found",404);
    const est=editableEstimate(raw.estimate_id),old=storage.getEstimateLineItems(est.id).find(l=>l.id===id)!;
    if(body.expectedVersion!==old.allocationVersion)fail("This line changed. Reload before editing.",409);
    const line=validatedLine({...old,...body},est.id);
    const dentCount=(sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE line_item_id=?").get(id) as any).n;
    if(dentCount&&(line.quantity!==old.quantity||line.panelLocation!==(old.panelLocation||"")||line.damageSize!==(old.damageSize||"")))
      fail(`This line counts ${dentCount} saved dent record${dentCount===1?"":"s"}. To change the dents, remove this line, edit them in the damage map, then add them again.`,409);
    if(savedHailCarriers([...storage.getEstimateLineItems(est.id).filter(l=>l.id!==id),line]).length>1)fail("Do not mix carrier-tagged hail lines",409);
    sqlite.prepare("UPDATE estimate_line_items SET service_category=?,description=?,line_type=?,quantity=?,unit=?,unit_price=?,total=?,unit_cost=?,use_tax_rate=?,tax_note=?,repair_action=?,panel_location=?,damage_size=?,damage_severity=?,allocation_version=allocation_version+1 WHERE id=?")
      .run(line.serviceCategory,line.description,line.lineType,line.quantity,line.unit||"each",line.unitPrice,line.total,line.unitCost,line.useTaxRate,line.taxNote,line.repairAction,line.panelLocation||null,line.damageSize||null,line.damageSeverity||null,id);
    if(line.lineType!=="labor")sqlite.prepare("DELETE FROM estimate_labor_allocations WHERE line_id=?").run(id);
    if(est.status==="approved")storage.updateEstimate(est.id,{status:"draft",approvedDate:null});
    recalculateEstimate(est.id);
    return storage.getEstimateLineItems(est.id).find(l=>l.id===id);
  }).immediate();
}
export function addEstimateLines(id: number, items: any[]) {
  return sqlite.transaction(() => {
    const est = editableEstimate(id);
    if (!Array.isArray(items) || !items.length || items.length > 200) fail("Supply 1 to 200 line items");
    const validated = items.map(i => validatedLine(i, id));
    if(savedHailCarriers([...storage.getEstimateLineItems(id),...validated]).length>1)
      fail("Do not mix carrier-tagged hail lines on one estimate. Remove the incorrect draft lines or create a separate estimate.",409);
    const created = validated.map(i => storage.createEstimateLineItem(i));
    if (est.status === "approved") storage.updateEstimate(id, { status: "draft", approvedDate: null });
    recalculateEstimate(id);
    return created;
  }).immediate();
}
export function deleteEstimateLine(id: number) {
  return sqlite.transaction(() => {
    const item = sqlite.prepare("SELECT estimate_id FROM estimate_line_items WHERE id=?").get(id) as any;
    if (!item) fail("Line item not found", 404);
    const est = editableEstimate(item.estimate_id);
    // Dent records stay; they become unbilled and can be added again from the damage map.
    sqlite.prepare("UPDATE estimate_dents SET line_item_id=NULL,updated_at=? WHERE line_item_id=?").run(new Date().toISOString(), id);
    storage.deleteEstimateLineItem(id);
    if (est.status === "approved") storage.updateEstimate(est.id, { status: "draft", approvedDate: null });
    recalculateEstimate(est.id);
  }).immediate();
}
export function convertEstimate(id: number) {
  return sqlite.transaction(() => {
    const existing = sqlite.prepare("SELECT id FROM invoices WHERE estimate_id=?").get(id) as any;
    if (existing) return storage.getInvoice(existing.id)!; // safe repeat, including response-loss retry
    if(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ops_cases'").get()) {
      const production=sqlite.prepare("SELECT j.status FROM ops_cases c JOIN jobs j ON j.id=c.job_id WHERE c.estimate_id=?").get(id) as any;
      if(production&&production.status!=="completed")fail("Finish production tasks and QC before invoicing this tracked repair order.",409);
    }
    const est = editableEstimate(id);
    if (est.status !== "approved") fail("Approve the estimate before creating an invoice", 409);
    const lines = storage.getEstimateLineItems(id);
    if (!lines.length) fail("An invoice must have line items");
    validateEstimateServices(id);
    if (lines.some(i => i.lineType === "legacy")) fail("Classify all lines as parts or labor before invoicing.",409);
    const splits = lines.map(requireAllocations);
    if (lines.some(i => i.quantity <= 0 || i.unitPrice < 0 || i.total < 0))
      fail("This legacy estimate contains a negative adjustment. Review and replace it with the discount field before invoicing.", 409);
    const calculated = recalculateEstimate(id);
    if (calculated.total <= 0) fail("Invoice total must be positive");
    const next = (sqlite.prepare("SELECT coalesce(max(id),0)+1 n FROM invoices").get() as any).n;
    const issueDay = localToday();
    const inv = storage.createInvoice({
      invoiceNumber: `INV-${issueDay.slice(0,4)}-${String(next).padStart(6, "0")}`,
      customerId: est.customerId, jobId: est.jobId, estimateId: id, status: "sent",
      subtotal: calculated.subtotal, taxRate: calculated.taxRate, taxAmount: calculated.taxAmount,
      discount: calculated.discount, total: calculated.total, amountPaid: 0, balanceDue: calculated.total,
      issueDate: issueDay,
      dueDate: addDays(issueDay, 30), notes: est.notes,
    });
    const net = lineNetCents(lines, calculated.discount);
    for (let index=0;index<lines.length;index++) {
      const it = lines[index];
      const issued = storage.createInvoiceLineItem({
        invoiceId: inv.id, lineType: it.lineType, description: it.description, quantity: it.quantity, unit: it.unit, unitPrice: it.unitPrice, total: it.total,
        serviceCategory:it.serviceCategory,unitCost:it.unitCost,useTaxRate:it.useTaxRate,taxNote:it.taxNote,repairAction:it.repairAction,
      });
      const credits = apportion(net[index],splits[index].map(a => a.share_bps));
      splits[index].forEach((a,i) => sqlite.prepare("INSERT INTO invoice_labor_credits(line_id,technician_id,technician_name,share_bps,net_labor_cents) VALUES(?,?,?,?,?)").run(issued.id,a.technician_id,a.name,a.share_bps,credits[i]));
    }
    snapshotSales(id,inv.id,cents(calculated.subtotal-calculated.discount));
    storage.updateEstimate(id, { status: "invoiced", invoiceId: inv.id });
    storage.createActivity({ customerId: est.customerId, invoiceId: inv.id, estimateId: id,
      activityType: "note", description: `Invoice ${inv.invoiceNumber} issued from approved estimate ${est.estimateNumber}. No delivery attempted.`,
      performedBy: "Preview advisor" });
    return inv;
  }).immediate();
}
export function postPayment(body: any) {
  return sqlite.transaction(() => {
    const key = String(body.idempotencyKey || body.paymentNumber || "").trim();
    if (!key || key.length > 128) fail("A payment retry key is required");
    const amount = number(body.amount, "Payment amount", 0.01);
    if (Math.abs(amount * 100 - cents(amount)) > 0.00001) fail("Payment must use whole cents");
    if (!["cash", "check", "credit_card", "ach", "insurance"].includes(body.paymentMethod)) fail("Invalid payment method");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate || "") ||
      !Number.isFinite(Date.parse(body.paymentDate)) || new Date(body.paymentDate).toISOString().slice(0, 10) !== body.paymentDate) fail("Invalid payment date");
    const reference = String(body.reference || "").trim();
    const prior = sqlite.prepare("SELECT id FROM payments WHERE idempotency_key=?").get(key) as any;
    if (prior) {
      const p = storage.getPayments().find(p => p.id === prior.id)!;
      if (p.invoiceId !== body.invoiceId || p.customerId !== body.customerId || cents(p.amount) !== cents(amount) ||
        p.paymentMethod !== body.paymentMethod || p.paymentDate !== body.paymentDate || (p.reference || "") !== reference)
        fail("This retry key was already used for different payment details", 409);
      return p;
    }
    const inv = storage.getInvoice(body.invoiceId);
    if (!inv || inv.customerId !== body.customerId) fail("Invoice does not belong to this customer");
    if (inv.status === "void" || inv.status === "draft") fail("Payments require an issued invoice");
    const paid = storage.getPaymentsByInvoice(inv.id).reduce((s, p) => s + cents(p.amount), 0);
    if (cents(amount) > cents(inv.total) - paid) fail("Payment exceeds the outstanding balance");
    if (reference && sqlite.prepare(`SELECT id FROM payments WHERE invoice_id=? AND payment_method=? AND payment_date=?
      AND lower(trim(reference))=lower(?) AND round(amount*100)=?`).get(inv.id, body.paymentMethod, body.paymentDate, reference, cents(amount)))
      fail("A matching payment reference, date, method and amount is already recorded. Review payment history.", 409);
    const p = storage.createPayment({
      paymentNumber: `PMT-${localToday().slice(0,4)}-${String((sqlite.prepare("SELECT coalesce(max(id),0)+1 n FROM payments").get() as any).n).padStart(6, "0")}`, idempotencyKey: key,
      invoiceId: inv.id, customerId: inv.customerId, amount, paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate, reference,
    });
    storage.createActivity({ customerId: inv.customerId, invoiceId: inv.id, activityType: "payment_received",
      description: `Recorded ${amount.toFixed(2)} by ${body.paymentMethod}; ${p.paymentNumber}.`, performedBy: "Preview advisor" });
    return p;
  }).immediate();
}
export function updateInvoiceSafe(id: number, body: any) {
  return sqlite.transaction(() => {
    const inv = storage.getInvoice(id);
    if (!inv) fail("Invoice not found", 404);
    if (Object.keys(body).some(k => !["notes", "dueDate", "status"].includes(k))) fail("Invoice financial fields are locked", 409);
    if(body.dueDate!=null&&body.dueDate!==""&&
      (typeof body.dueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)||!Number.isFinite(Date.parse(body.dueDate))||new Date(body.dueDate).toISOString().slice(0,10)!==body.dueDate))
      fail("Enter a valid invoice due date.");
    if (body.status && body.status !== inv.status) {
      fail("Record payment to change paid status. Voids and reversals require a separate audited workflow.", 409);
    }
    return Object.keys(body).length ? storage.updateInvoice(id, body)! : inv;
  }).immediate();
}
