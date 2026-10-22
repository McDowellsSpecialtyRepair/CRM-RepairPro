import type { Express } from "express";
import { sqlite } from "./storage-db";
import { audit } from "./security";
import { fail } from "./billing";

// Discount codes (management-maintained): a code, a description and an amount, either a percentage of the
// estimate's labor or a fixed dollar amount. Discounts chosen on new estimates are labor discounts: they
// reduce labor only, so taxable parts, materials and freight (and their sales tax) are not changed.
// Discounts entered before this existed keep their original spread across all lines ("all").
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const now = () => new Date().toISOString();

export function migrateDiscounts() {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS discount_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(code) BETWEEN 1 AND 30),
    description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 200),
    kind TEXT NOT NULL CHECK(kind IN ('percent','amount')),
    amount REAL NOT NULL CHECK(amount > 0),
    applies_to TEXT NOT NULL DEFAULT 'labor' CHECK(applies_to IN ('labor')),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    CHECK(kind != 'percent' OR amount <= 100)
  )`);
  const add = (table: string, column: string, ddl: string) => {
    if (all(`PRAGMA table_info(${table})`).some(c => c.name === column)) return;
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    // Rebuild this table's row-audit triggers (initializeSecurity runs next) so the new column is audited too.
    for (const op of ["insert", "update", "delete"]) sqlite.exec(`DROP TRIGGER IF EXISTS staff_audit_${table}_${op}`);
  };
  add("estimates", "discount_basis", "discount_basis TEXT NOT NULL DEFAULT 'all'");
  add("estimates", "discount_code", "discount_code TEXT");
  add("estimates", "discount_note", "discount_note TEXT");
  add("estimates", "discount_percent", "discount_percent REAL");
  add("invoices", "discount_note", "discount_note TEXT");
}

const shape = (r: any) => r && ({ id: r.id, code: r.code, description: r.description, kind: r.kind, amount: r.amount, appliesTo: r.applies_to, active: !!r.active });
export const discountCode = (code: string) => shape(one("SELECT * FROM discount_codes WHERE code=? AND active=1", code));

function validated(b: any, existing?: any) {
  const code = String(b.code ?? existing?.code ?? "").trim().toUpperCase();
  const description = String(b.description ?? existing?.description ?? "").trim();
  const kind = b.kind ?? existing?.kind, amount = b.amount ?? existing?.amount;
  if (!/^[A-Z0-9_-]{1,30}$/.test(code)) fail("Enter a discount code of up to 30 letters, numbers, dashes or underscores.");
  if (!description || description.length > 200) fail("Enter a description of up to 200 characters.");
  if (!["percent", "amount"].includes(kind)) fail("Choose whether the discount is a percentage of labor or a dollar amount.");
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || (kind === "percent" && amount > 100) || amount > 1e6)
    fail(kind === "percent" ? "Enter a percentage above 0 and up to 100." : "Enter a dollar amount above 0.");
  const active = b.active === undefined ? (existing ? !!existing.active : true) : b.active === true;
  return { code, description, kind, amount: Math.round(amount * 100) / 100, active: active ? 1 : 0 };
}

export function registerDiscounts(app: Express) {
  app.get("/api/discount-codes", (_req, res) => res.json(all("SELECT * FROM discount_codes ORDER BY active DESC, code").map(shape)));
  app.post("/api/discount-codes", (req, res) => {
    const v = validated(req.body || {});
    if (one("SELECT id FROM discount_codes WHERE code=?", v.code)) fail("That discount code already exists.", 409);
    const id = Number(sqlite.prepare("INSERT INTO discount_codes(code,description,kind,amount,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run(v.code, v.description, v.kind, v.amount, v.active, now(), now()).lastInsertRowid);
    const after = shape(one("SELECT * FROM discount_codes WHERE id=?", id));
    audit("discount_code.created", "discount_codes", id, null, after);
    res.status(201).json(after);
  });
  app.patch("/api/discount-codes/:id", (req, res) => {
    const id = Number(req.params.id), existing = one("SELECT * FROM discount_codes WHERE id=?", id);
    if (!existing) fail("Discount code not found.", 404);
    const v = validated(req.body || {}, existing);
    if (one("SELECT id FROM discount_codes WHERE code=? AND id<>?", v.code, id)) fail("That discount code already exists.", 409);
    sqlite.prepare("UPDATE discount_codes SET code=?,description=?,kind=?,amount=?,active=?,updated_at=? WHERE id=?").run(v.code, v.description, v.kind, v.amount, v.active, now(), id);
    const after = shape(one("SELECT * FROM discount_codes WHERE id=?", id));
    // Estimates keep the amount they were given; changing a code never reprices an existing estimate.
    audit("discount_code.updated", "discount_codes", id, shape(existing), after);
    res.json(after);
  });
}
