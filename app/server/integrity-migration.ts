import type Database from "better-sqlite3";
import { relationshipTargets } from "@shared/integrity";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function migrateIntegrity(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS app_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS integrity_audit (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL, record_table TEXT NOT NULL,
      record_id INTEGER NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );`);
  if (db.prepare("SELECT 1 FROM app_migrations WHERE version=?").get("integrity-v1")) return;
  const backup = resolve(process.env.DB_PATH || "data.db") + ".pre-integrity-v1.bak";
  if (!existsSync(backup)) db.prepare("VACUUM INTO ?").run(backup);
  const audit = (kind: string, table: string, id: number, before: any, after: any) =>
    db.prepare("INSERT INTO integrity_audit(kind,record_table,record_id,before_json,after_json) VALUES(?,?,?,?,?)")
      .run(kind, table, id, JSON.stringify(before), JSON.stringify(after));
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      // Work orders are the authoritative owner for their schedule reservations.
      const slots = db.prepare(`SELECT s.id,s.customer_id,j.customer_id AS owner
        FROM schedule_slots s JOIN jobs j ON j.id=s.job_id
        WHERE s.customer_id IS NOT j.customer_id`).all() as any[];
      for (const s of slots) {
        audit("schedule-owner-reconciliation", "schedule_slots", s.id, { customerId: s.customer_id }, { customerId: s.owner });
        db.prepare("UPDATE schedule_slots SET customer_id=? WHERE id=?").run(s.owner, s.id);
      }
      if (!(db.prepare("PRAGMA table_info(payments)").all() as any[]).some(c => c.name === "idempotency_key"))
        db.exec("ALTER TABLE payments ADD COLUMN idempotency_key TEXT");
      const tables = db.prepare(`SELECT name,sql FROM sqlite_master WHERE type='table'
        AND name NOT LIKE 'sqlite_%' AND name NOT IN ('app_migrations','integrity_audit')`).all() as any[];
      const columns: Record<string, string[]> = Object.fromEntries(tables.map(t =>
        [t.name, (db.prepare(`PRAGMA table_info("${t.name}")`).all() as any[]).map(c => c.name)]));
      // Preserve explicit indexes/triggers and AUTOINCREMENT high-water marks.
      const objects = db.prepare("SELECT sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL").all() as any[];
      const sequences = db.prepare("SELECT name,seq FROM sqlite_sequence").all() as any[];
      for (const t of tables) {
        const clauses: string[] = [];
        const cols = columns[t.name];
        if (cols.includes("customer_id")) clauses.push("UNIQUE(id,customer_id)");
        for (const col of cols) {
          const parent = relationshipTargets[col];
          if (!parent) continue;
          clauses.push(`FOREIGN KEY("${col}") REFERENCES "${parent}"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`);
          if (col !== "customer_id" && cols.includes("customer_id") && columns[parent]?.includes("customer_id"))
            clauses.push(`FOREIGN KEY("${col}",customer_id) REFERENCES "${parent}"(id,customer_id) DEFERRABLE INITIALLY DEFERRED`);
        }
        if (t.name === "payments") clauses.push("UNIQUE(idempotency_key)", "CHECK(amount>0 AND amount=round(amount,2))");
        if (["estimate_line_items", "invoice_line_items"].includes(t.name))
          clauses.push("CHECK(quantity>0)");
        if (["estimates", "invoices"].includes(t.name))
          clauses.push("CHECK(subtotal>=0 AND tax_rate>=0 AND tax_rate<=100 AND tax_amount>=0 AND discount>=0 AND total>=0)");
        if (!clauses.length) continue;
        const sql = t.sql.replace(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"[^"]+"|\w+)/i, `CREATE TABLE "__new_${t.name}"`)
          .replace(/\)\s*$/, `,${clauses.join(",")})`);
        db.exec(sql);
        db.exec(`INSERT INTO "__new_${t.name}" SELECT * FROM "${t.name}"; DROP TABLE "${t.name}";
          ALTER TABLE "__new_${t.name}" RENAME TO "${t.name}"`);
      }
      for (const obj of objects) db.exec(obj.sql);
      for (const seq of sequences) {
        db.prepare("UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name=?").run(seq.seq, seq.name);
      }
      for (const t of tables) for (const col of columns[t.name]) if (relationshipTargets[col])
        db.exec(`CREATE INDEX IF NOT EXISTS "rel_${t.name}_${col}" ON "${t.name}"("${col}")`);
      db.exec("CREATE UNIQUE INDEX invoices_one_per_estimate ON invoices(estimate_id) WHERE estimate_id IS NOT NULL");
      for (const row of db.prepare(`SELECT e.id,e.status,e.invoice_id,i.id AS linked_invoice
        FROM estimates e JOIN invoices i ON i.estimate_id=e.id
        WHERE e.status!='invoiced' OR e.invoice_id IS NOT i.id`).all() as any[]) {
        audit("estimate-invoice-reconciliation", "estimates", row.id,
          { status: row.status, invoiceId: row.invoice_id },
          { status: "invoiced", invoiceId: row.linked_invoice });
        db.prepare("UPDATE estimates SET status='invoiced',invoice_id=? WHERE id=?").run(row.linked_invoice, row.id);
      }
      const violations = db.pragma("foreign_key_check");
      if ((violations as any[]).length) throw new Error("Migration stopped: existing relationship violations require review");
      for (const inv of db.prepare("SELECT * FROM invoices").all() as any[]) {
        const paid = (db.prepare("SELECT round(coalesce(sum(amount),0),2) n FROM payments WHERE invoice_id=?").get(inv.id) as any).n;
        if (paid > Math.round(inv.total * 100) / 100 || (inv.status === "void" && paid > 0))
          throw new Error(`Invoice ${inv.id} requires manual payment reconciliation`);
        const balance = Math.round((inv.total - paid) * 100) / 100;
        const status = inv.status === "void" ? "void" : paid > 0 ? (balance === 0 ? "paid" : "partial") : inv.status === "paid" || inv.status === "partial" ? "sent" : inv.status;
        if (inv.amount_paid !== paid || inv.balance_due !== balance || inv.status !== status) {
          audit("payment-ledger-reconciliation", "invoices", inv.id,
            { amountPaid: inv.amount_paid, balanceDue: inv.balance_due, status: inv.status },
            { amountPaid: paid, balanceDue: balance, status });
          db.prepare("UPDATE invoices SET amount_paid=?,balance_due=?,status=? WHERE id=?").run(paid, balance, status, inv.id);
        }
      }
      db.exec(`
        CREATE TRIGGER estimate_line_prices_insert BEFORE INSERT ON estimate_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Use the discount field, not negative line items'); END;
        CREATE TRIGGER estimate_line_prices_update BEFORE UPDATE OF unit_price,total ON estimate_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Use the discount field, not negative line items'); END;
        CREATE TRIGGER invoice_line_prices_insert BEFORE INSERT ON invoice_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Negative invoice lines require an adjustment workflow'); END;
        CREATE TRIGGER invoice_insert_guard BEFORE INSERT ON invoices BEGIN
          SELECT CASE WHEN NEW.amount_paid!=0 OR round(NEW.balance_due*100)!=round(NEW.total*100)
            OR NEW.status NOT IN ('draft','sent') THEN RAISE(ABORT,'New invoices must begin unpaid') END;
        END;
        CREATE TRIGGER invoice_totals_immutable BEFORE UPDATE OF subtotal,tax_rate,tax_amount,discount,total,estimate_id,invoice_number ON invoices
          BEGIN SELECT RAISE(ABORT,'Issued invoice financial details are immutable'); END;
        CREATE TRIGGER invoice_lines_no_update BEFORE UPDATE ON invoice_line_items
          BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;
        CREATE TRIGGER invoice_lines_no_delete BEFORE DELETE ON invoice_line_items
          BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;
        CREATE TRIGGER payment_validate BEFORE INSERT ON payments BEGIN
          SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM invoices WHERE id=NEW.invoice_id AND customer_id=NEW.customer_id AND status NOT IN ('void','draft'))
            THEN RAISE(ABORT,'Payment requires an issued invoice for this customer') END;
          SELECT CASE WHEN round(NEW.amount*100)>round((SELECT total FROM invoices WHERE id=NEW.invoice_id)*100)
            -coalesce((SELECT round(sum(amount)*100) FROM payments WHERE invoice_id=NEW.invoice_id),0)
            THEN RAISE(ABORT,'Payment exceeds outstanding balance') END;
        END;
        CREATE TRIGGER payment_balance AFTER INSERT ON payments BEGIN
          UPDATE invoices SET amount_paid=round((SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id),2),
            balance_due=round(total-(SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id),2),
            status=CASE WHEN round(total*100)=round((SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id)*100) THEN 'paid' ELSE 'partial' END
            WHERE id=NEW.invoice_id;
        END;
        CREATE TRIGGER payment_no_mutation BEFORE UPDATE OF invoice_id,amount,payment_number,payment_method,payment_date,reference,idempotency_key ON payments
          BEGIN SELECT RAISE(ABORT,'Posted payments are immutable; an audited reversal workflow is required'); END;
        CREATE TRIGGER payment_no_delete BEFORE DELETE ON payments
          BEGIN SELECT RAISE(ABORT,'Posted payments cannot be deleted'); END;
        CREATE TRIGGER invoice_ledger_guard BEFORE UPDATE OF amount_paid,balance_due,status,total ON invoices BEGIN
          SELECT CASE WHEN round(NEW.amount_paid*100)!=coalesce((SELECT round(sum(amount)*100) FROM payments WHERE invoice_id=NEW.id),0)
            OR round(NEW.balance_due*100)!=round((NEW.total-NEW.amount_paid)*100)
            OR (NEW.status='paid' AND (NEW.balance_due!=0 OR NEW.amount_paid<=0))
            OR (NEW.status='void' AND NEW.amount_paid>0)
            THEN RAISE(ABORT,'Invoice must reconcile to posted payments') END;
        END;
      `);
      db.prepare("INSERT INTO app_migrations VALUES(?,?)").run("integrity-v1", new Date().toISOString());
    }).immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
