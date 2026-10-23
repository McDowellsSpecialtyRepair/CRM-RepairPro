import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail, cents } from "./billing";
import { apportion, lineNetCents } from "./labor";
import { categoryTaxable, categoriesFor } from "../shared/estimate-rules";

// Invoice corrections (owner request 2026-10-23): a bookkeeper or manager can correct an issued invoice (lines,
// discount, tax rate, dates, notes) until it is marked "Entered in QuickBooks". After that it is locked again and
// changes need a separate adjustment. The database still refuses any other change to an issued invoice: the
// guards are lifted only for the one invoice being corrected, inside the correction itself, and every change is
// in the change history with the login and a required reason.
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const now = () => new Date().toISOString();
const MARK = "invoice-corrections-v1";

export function migrateInvoiceCorrections() {
  sqlite.exec("CREATE TABLE IF NOT EXISTS app_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  sqlite.exec("CREATE TABLE IF NOT EXISTS invoice_correction_gate (invoice_id INTEGER PRIMARY KEY)");
  const cols = all("PRAGMA table_info(invoices)").map(c => c.name);
  for (const [c, ddl] of [["qb_entered_at", "qb_entered_at TEXT"], ["qb_entered_by", "qb_entered_by TEXT"]]) {
    if (cols.includes(c)) continue;
    sqlite.exec(`ALTER TABLE invoices ADD COLUMN ${ddl}`);
    for (const op of ["insert", "update", "delete"]) sqlite.exec(`DROP TRIGGER IF EXISTS staff_audit_invoices_${op}`);
  }
  if (one("SELECT 1 FROM app_migrations WHERE version=?", MARK)) return;
  sqlite.transaction(() => {
    const gateInvoice = (expr: string) => `NOT EXISTS (SELECT 1 FROM invoice_correction_gate g JOIN invoices i ON i.id=g.invoice_id WHERE g.invoice_id=${expr} AND i.qb_entered_at IS NULL)`;
    const gateLine = (expr: string) => gateInvoice(`(SELECT invoice_id FROM invoice_line_items WHERE id=${expr})`);
    sqlite.exec(`
      DROP TRIGGER IF EXISTS invoice_totals_immutable;
      CREATE TRIGGER invoice_identity_immutable BEFORE UPDATE OF estimate_id,invoice_number ON invoices
        BEGIN SELECT RAISE(ABORT,'Invoice number and estimate cannot change'); END;
      CREATE TRIGGER invoice_totals_immutable BEFORE UPDATE OF subtotal,tax_rate,tax_amount,discount,total ON invoices WHEN ${gateInvoice("OLD.id")}
        BEGIN SELECT RAISE(ABORT,'Issued invoice financial details are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_lines_no_update;
      CREATE TRIGGER invoice_lines_no_update BEFORE UPDATE ON invoice_line_items WHEN ${gateInvoice("OLD.invoice_id")}
        BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_lines_no_delete;
      CREATE TRIGGER invoice_lines_no_delete BEFORE DELETE ON invoice_line_items WHEN ${gateInvoice("OLD.invoice_id")}
        BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;
      DROP TRIGGER IF EXISTS labor_credits_no_update;
      CREATE TRIGGER labor_credits_no_update BEFORE UPDATE ON invoice_labor_credits WHEN ${gateLine("OLD.line_id")}
        BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;
      DROP TRIGGER IF EXISTS labor_credits_no_delete;
      CREATE TRIGGER labor_credits_no_delete BEFORE DELETE ON invoice_labor_credits WHEN ${gateLine("OLD.line_id")}
        BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_sales_immutable_update;
      CREATE TRIGGER invoice_sales_immutable_update BEFORE UPDATE ON invoice_sales_credits WHEN ${gateInvoice("OLD.invoice_id")}
        BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_sales_immutable_delete;
      CREATE TRIGGER invoice_sales_immutable_delete BEFORE DELETE ON invoice_sales_credits WHEN ${gateInvoice("OLD.invoice_id")}
        BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_line_dent_details_no_update;
      CREATE TRIGGER invoice_line_dent_details_no_update BEFORE UPDATE ON invoice_line_dent_details WHEN ${gateLine("OLD.invoice_line_id")}
        BEGIN SELECT RAISE(ABORT,'Issued invoice details are immutable'); END;
      DROP TRIGGER IF EXISTS invoice_line_dent_details_no_delete;
      CREATE TRIGGER invoice_line_dent_details_no_delete BEFORE DELETE ON invoice_line_dent_details WHEN ${gateLine("OLD.invoice_line_id")}
        BEGIN SELECT RAISE(ABORT,'Issued invoice details are immutable'); END;
      CREATE TRIGGER invoice_qb_entered_only_forward BEFORE UPDATE OF qb_entered_at ON invoices
        WHEN OLD.qb_entered_at IS NOT NULL AND NEW.qb_entered_at IS NULL AND ${gateInvoice("OLD.id").replace("AND i.qb_entered_at IS NULL", "")}
        BEGIN SELECT RAISE(ABORT,'Only a manager can undo "Entered in QuickBooks"'); END;
    `);
    sqlite.prepare("INSERT INTO app_migrations(version,applied_at) VALUES(?,?)").run(MARK, now());
  })();
}

const qbState = (id: number) => one("SELECT qb_entered_at AS enteredAt, qb_entered_by AS enteredBy FROM invoices WHERE id=?", id) || {};
const summary = (id: number) => {
  const inv: any = storage.getInvoice(id);
  return { subtotal: inv.subtotal, discount: inv.discount, taxRate: inv.taxRate, taxAmount: inv.taxAmount, total: inv.total, dueDate: inv.dueDate, issueDate: inv.issueDate,
    lines: storage.getInvoiceLineItems(id).map(l => `${l.description} · ${l.quantity} × ${l.unitPrice} = ${l.total} (${l.lineType})`) };
};
const validDate = (v: any, label: string) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T12:00:00Z"))) fail(`Enter a valid ${label}.`);
  return v;
};

export function correctInvoice(id: number, body: any, actor: string) {
  return sqlite.transaction(() => {
    const inv: any = storage.getInvoice(id);
    if (!inv) fail("Invoice not found.", 404);
    if (qbState(id).enteredAt) fail("This invoice is marked as entered in QuickBooks, so it is locked. A manager can undo that first, or make the change in QuickBooks as an adjustment.", 409);
    if (inv.status === "void") fail("A void invoice cannot be corrected.", 409);
    const b = body || {};
    if (Object.keys(b).some(k => !["lines", "discount", "discountNote", "taxRate", "notes", "dueDate", "issueDate", "reason"].includes(k))) fail("Unexpected fields.");
    const reason = String(b.reason ?? "").trim();
    if (!reason || reason.length > 500) fail("Enter the reason for the correction (it is kept in the change history).");
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 200) fail("An invoice needs at least one line.");
    const est = inv.estimateId ? storage.getEstimate(inv.estimateId) : null;
    const service = est?.serviceType || (inv.jobId ? storage.getJob(inv.jobId)?.serviceType : "") || "";
    const allowedCats = new Set(categoriesFor(service).map(c => c.value));
    const existing = new Map(storage.getInvoiceLineItems(id).map(l => [l.id, l]));
    const before = summary(id);
    // Technician split used for new labor lines: the invoice's existing labor split (the most common one).
    const oldCredits = all("SELECT c.* FROM invoice_labor_credits c JOIN invoice_line_items l ON l.id=c.line_id WHERE l.invoice_id=? ORDER BY c.line_id, c.technician_id", id);
    const splitFor = (lineId: number) => oldCredits.filter(c => c.line_id === lineId);
    const defaultSplit = (() => { const first = oldCredits[0]?.line_id; return first ? splitFor(first) : []; })();
    const salesShares = all("SELECT * FROM invoice_sales_credits WHERE invoice_id=? ORDER BY staff_id", id);

    sqlite.prepare("INSERT INTO invoice_correction_gate(invoice_id) VALUES(?)").run(id);
    const keep = new Set<number>(), splits = new Map<number, any[]>();
    for (const raw of b.lines) {
      const description = String(raw?.description ?? "").trim();
      if (!description || description.length > 500) fail("Every line needs a description (up to 500 characters).");
      const quantity = Number(raw.quantity), unitPrice = Number(raw.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) fail(`Enter a quantity above 0 for "${description}".`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1e7) fail(`Enter a price of 0 or more for "${description}".`);
      const lineType = raw.lineType === "parts" ? "parts" : raw.lineType === "labor" ? "labor" : null;
      if (!lineType) fail(`Choose labor or parts for "${description}".`);
      const total = cents(quantity * unitPrice) / 100;
      if (raw.id != null) {
        const old: any = existing.get(Number(raw.id));
        if (!old) fail("A line on this invoice was changed by someone else. Reload the invoice and try again.", 409);
        const category = raw.serviceCategory ?? old.serviceCategory;
        sqlite.prepare("UPDATE invoice_line_items SET description=?,quantity=?,unit_price=?,total=?,line_type=?,service_category=? WHERE id=?")
          .run(description, quantity, unitPrice, total, lineType, category, old.id);
        keep.add(old.id);
        splits.set(old.id, splitFor(old.id).length ? splitFor(old.id) : defaultSplit);
      } else {
        const category = String(raw.serviceCategory || (lineType === "parts" ? "material" : (categoriesFor(service)[0]?.value || "labor")));
        if (allowedCats.size && !allowedCats.has(category)) fail(`"${category}" is not a category for this service.`);
        const created = storage.createInvoiceLineItem({ invoiceId: id, lineType, description, quantity, unit: String(raw.unit || "each"), unitPrice, total, serviceCategory: category } as any);
        keep.add(created.id);
        splits.set(created.id, defaultSplit);
      }
    }
    for (const [lineId] of Array.from(existing)) if (!keep.has(lineId)) {
      sqlite.prepare("DELETE FROM invoice_line_dent_details WHERE invoice_line_id=?").run(lineId);
      sqlite.prepare("DELETE FROM invoice_labor_credits WHERE line_id=?").run(lineId);
      sqlite.prepare("DELETE FROM invoice_line_items WHERE id=?").run(lineId);
    }
    // Totals, exactly as when the invoice was issued: discount by the estimate's basis, tax on taxable lines.
    const lines = storage.getInvoiceLineItems(id);
    const discount = b.discount === undefined ? inv.discount : Number(b.discount);
    if (!Number.isFinite(discount) || discount < 0) fail("Enter a discount of 0 or more.");
    const taxRate = b.taxRate === undefined ? inv.taxRate : Number(b.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) fail("Enter a tax rate from 0 to 100.");
    const basis = (est as any)?.discountBasis || "all";
    const subtotalC = lines.reduce((s, l) => s + cents(l.total), 0), discountC = cents(discount);
    const laborC = lines.reduce((s, l) => s + (l.lineType === "labor" ? cents(l.total) : 0), 0);
    if (discountC > (basis === "labor" ? laborC : subtotalC)) fail(basis === "labor" ? "The labor discount is larger than the labor on this invoice." : "The discount is larger than the subtotal.");
    const net = lineNetCents(lines, discountC / 100, basis);
    const exempt = storage.getCustomer(inv.customerId)?.taxExempt;
    const taxC = exempt ? 0 : Math.round(lines.reduce((s, l, i) => s + (categoryTaxable(l.serviceCategory, l.lineType) ? net[i] : 0), 0) * taxRate / 100);
    const totalC = subtotalC + taxC - discountC, paidC = cents(inv.amountPaid || 0);
    if (totalC <= 0) fail("The invoice total must be more than $0.00.");
    if (totalC < paidC) fail(`The corrected total ($${(totalC / 100).toFixed(2)}) would be less than the $${(paidC / 100).toFixed(2)} already paid. Record a refund first.`);
    const status = paidC === 0 ? (inv.status === "draft" ? "draft" : "sent") : paidC === totalC ? "paid" : "partial";
    const discountNote = b.discountNote === undefined ? inv.discountNote : (String(b.discountNote ?? "").trim().slice(0, 200) || null);
    sqlite.prepare(`UPDATE invoices SET subtotal=?,tax_rate=?,tax_amount=?,discount=?,discount_note=?,total=?,balance_due=?,status=?,notes=?,due_date=?,issue_date=? WHERE id=?`)
      .run(subtotalC / 100, taxRate, taxC / 100, discountC / 100, discountNote, totalC / 100, (totalC - paidC) / 100, status,
        b.notes === undefined ? inv.notes : (String(b.notes ?? "").slice(0, 10000) || null),
        b.dueDate === undefined ? inv.dueDate : validDate(b.dueDate, "due date"), b.issueDate === undefined ? inv.issueDate : validDate(b.issueDate, "invoice date"), id);
    // Technician production and sales credit follow the corrected net labor and net sales.
    for (const l of lines) sqlite.prepare("DELETE FROM invoice_labor_credits WHERE line_id=?").run(l.id);
    lines.forEach((l, i) => {
      if (l.lineType !== "labor") return;
      const split = splits.get(l.id) || [];
      if (!split.length) return;
      const credits = apportion(net[i], split.map(s => s.share_bps));
      split.forEach((s, k) => sqlite.prepare("INSERT INTO invoice_labor_credits(line_id,technician_id,technician_name,share_bps,net_labor_cents) VALUES(?,?,?,?,?)").run(l.id, s.technician_id, s.technician_name, s.share_bps, credits[k]));
    });
    if (salesShares.length) {
      sqlite.prepare("DELETE FROM invoice_sales_credits WHERE invoice_id=?").run(id);
      const shares = apportion(subtotalC - discountC, salesShares.map(s => s.share_bps));
      salesShares.forEach((s, k) => sqlite.prepare("INSERT INTO invoice_sales_credits VALUES(?,?,?,?,?)").run(id, s.staff_id, s.staff_name, s.share_bps, shares[k]));
    }
    sqlite.prepare("DELETE FROM invoice_correction_gate WHERE invoice_id=?").run(id);
    const after = summary(id);
    audit("invoice.corrected", "invoices", id, before, { ...after, reason });
    const unsplit = lines.filter(l => l.lineType === "labor" && !(splits.get(l.id) || []).length).map(l => l.description);
    return { invoice: storage.getInvoice(id), warnings: unsplit.length ? [`No technician split for: ${unsplit.join(", ")}. Technician production for those lines is not counted.`] : [], actor };
  }).immediate();
}

export function registerInvoiceCorrections(app: Express) {
  app.get("/api/invoices/:id/quickbooks", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getInvoice(id)) fail("Invoice not found.", 404);
    res.json(qbState(id));
  });
  app.put("/api/invoices/:id/correction", (req, res) => res.json(correctInvoice(Number(req.params.id), req.body, res.locals.staff?.full_name || "")));
  app.post("/api/invoices/:id/quickbooks", (req, res) => {
    const id = Number(req.params.id), b = req.body || {};
    if (Object.keys(b).some(k => k !== "entered") || typeof b.entered !== "boolean") fail("Unexpected fields.");
    const inv = storage.getInvoice(id);
    if (!inv) fail("Invoice not found.", 404);
    const before = qbState(id);
    if (b.entered) {
      if (before.enteredAt) return res.json(before);
      sqlite.prepare("UPDATE invoices SET qb_entered_at=?,qb_entered_by=? WHERE id=?").run(now(), res.locals.staff?.full_name || null, id);
      audit("invoice.entered_in_quickbooks", "invoices", id, before, qbState(id));
    } else {
      const role = res.locals.staff?.role;
      if (!["owner", "admin", "manager"].includes(role)) fail("Only an owner, administrator or manager can undo \"Entered in QuickBooks\".", 403);
      sqlite.transaction(() => {
        sqlite.prepare("INSERT OR IGNORE INTO invoice_correction_gate(invoice_id) VALUES(?)").run(id);
        sqlite.prepare("UPDATE invoices SET qb_entered_at=NULL,qb_entered_by=NULL WHERE id=?").run(id);
        sqlite.prepare("DELETE FROM invoice_correction_gate WHERE invoice_id=?").run(id);
      })();
      audit("invoice.quickbooks_entry_undone", "invoices", id, before, qbState(id));
    }
    res.json(qbState(id));
  });
}
