import type { Express } from "express";
import { sqlite } from "./storage-db";
import { audit } from "./security";
import {
  DENT_BODY_STYLES, DENT_SEVERITIES, DENT_SEVERITY_LABELS, DENT_SIZE_LABELS, LOCATION_DIFFICULTIES, LOCATION_DIFFICULTY_LABELS,
  NON_PDR_PANELS, PDR_PANELS, STANDARD_DENT_SIZES, ADJUSTMENT_DIMENSIONS, DENT_LENGTH_MIN, DENT_LENGTH_MAX,
  lengthRangeLabel, roundMoney,
} from "../shared/dents";

// Paintless dent repair price master (Phase 2.2). Management edits it; no amounts are invented here.
// - Vehicle categories: Sedan and SUV/Truck as before, expandable. Each diagram body style belongs to one category.
// - Standard dent prices: the existing pricing_matrices 'pdr_dent' rows (size x vehicle category).
// - Crease prices: management-defined length ranges x severity x vehicle category. Empty until entered.
// - Optional adjustments (dollar amount or percent of the base price). Blank means no adjustment.
// Estimates keep the price calculated when each dent was priced; master changes never reprice them
// unless someone explicitly reprices the estimate.
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const all = (sql: string, ...a: any[]) => sqlite.prepare(sql).all(...a) as any[];
const one = (sql: string, ...a: any[]) => sqlite.prepare(sql).get(...a) as any;

export function migratePdrPricing() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pdr_vehicle_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE CHECK(length(key) BETWEEN 1 AND 40),
      label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 60),
      body_styles TEXT NOT NULL DEFAULT '',
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pdr_length_ranges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_in INTEGER NOT NULL CHECK(min_in BETWEEN ${DENT_LENGTH_MIN} AND ${DENT_LENGTH_MAX}),
      max_in INTEGER NOT NULL CHECK(max_in BETWEEN ${DENT_LENGTH_MIN} AND ${DENT_LENGTH_MAX}),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      CHECK(min_in <= max_in)
    );
    CREATE TABLE IF NOT EXISTS pdr_crease_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      range_id INTEGER NOT NULL REFERENCES pdr_length_ranges(id) ON DELETE CASCADE,
      severity TEXT NOT NULL CHECK(severity IN ('shallow','medium','deep')),
      vehicle_category TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0 AND price <= 1000000),
      updated_at TEXT NOT NULL,
      UNIQUE(range_id, severity, vehicle_category)
    );
    CREATE TABLE IF NOT EXISTS pdr_price_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applies_to TEXT NOT NULL CHECK(applies_to IN ('crease','standard')),
      dimension TEXT NOT NULL CHECK(dimension IN ('location_difficulty','panel','severity','length_range')),
      value TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('amount','percent')),
      amount REAL NOT NULL CHECK(amount BETWEEN -1000000 AND 1000000),
      updated_at TEXT NOT NULL,
      UNIQUE(applies_to, dimension, value)
    );
    CREATE TABLE IF NOT EXISTS pdr_pricing_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  // The two existing categories, exactly as the standard matrix has always used them.
  if (!one("SELECT 1 FROM pdr_vehicle_categories LIMIT 1")) {
    const ins = sqlite.prepare("INSERT INTO pdr_vehicle_categories(key,label,body_styles,sort,created_at,updated_at) VALUES(?,?,?,?,?,?)");
    ins.run("sedan", "Sedan", "sedan", 1, now(), now());
    ins.run("suv", "SUV/Truck", "suv,pickup", 2, now(), now());
  }
}

// ---------- reading the master ----------
export type Category = { key: string; label: string; bodyStyles: string[]; sort: number };
export const categories = (): Category[] => all("SELECT * FROM pdr_vehicle_categories ORDER BY sort, id")
  .map(c => ({ key: c.key, label: c.label, bodyStyles: c.body_styles ? c.body_styles.split(",") : [], sort: c.sort }));
export const categoryFor = (bodyStyle: string) => categories().find(c => c.bodyStyles.includes(bodyStyle)) || null;
const ranges = () => all("SELECT id,min_in minIn,max_in maxIn FROM pdr_length_ranges ORDER BY min_in, id");
const rangeFor = (lengthIn: number) => ranges().find(r => lengthIn >= r.minIn && lengthIn <= r.maxIn) || null;
const adjustment = (appliesTo: string, dimension: string, value: string | null) =>
  value == null ? null : one("SELECT kind,amount FROM pdr_price_adjustments WHERE applies_to=? AND dimension=? AND value=?", appliesTo, dimension, value);
export const thresholdPercent = (): number | null => {
  const v = one("SELECT value FROM pdr_pricing_settings WHERE key='package_approval_threshold_percent'")?.value;
  return v == null || v === "" ? null : Number(v);
};
// First matching row, the same row the damage map has always used.
const standardRow = (size: string, category: string) =>
  one("SELECT id,price FROM pricing_matrices WHERE matrix_type='pdr_dent' AND size_category=? AND vehicle_category=? ORDER BY id LIMIT 1", size, category);

export function pricingMaster() {
  return {
    categories: categories(),
    standard: all("SELECT id,size_category size,vehicle_category category,price FROM pricing_matrices WHERE matrix_type='pdr_dent' ORDER BY id"),
    ranges: ranges(),
    creasePrices: all("SELECT range_id rangeId,severity,vehicle_category category,price FROM pdr_crease_prices"),
    adjustments: all("SELECT applies_to appliesTo,dimension,value,kind,amount FROM pdr_price_adjustments ORDER BY applies_to,dimension,value"),
    settings: { packageApprovalThresholdPercent: thresholdPercent() },
  };
}

// ---------- the suggested price for one dent ----------
// base + dollar adjustments + percent adjustments (each a percent of the base). Any missing piece
// returns price null with the reason: an unpriced dent is "pricing incomplete", never $0.
export function suggestDentPrice(d: { panel_id: string; body_style: string; size: string; length_in: number | null; severity: string | null; location_difficulty: string | null }):
  { price: number | null; source: string } {
  if (NON_PDR_PANELS.has(d.panel_id)) return { price: null, source: "Glass or plastic panel: no PDR matrix price" };
  const cat = categoryFor(d.body_style);
  if (!cat) return { price: null, source: `No pricing vehicle category includes ${d.body_style}` };
  let base: number, label: string, appliesTo: "crease" | "standard";
  const rng = d.length_in ? rangeFor(d.length_in) : null;
  if (d.size === "crease") {
    appliesTo = "crease";
    if (!d.length_in) return { price: null, source: "Crease length missing" };
    if (!rng) return { price: null, source: `No crease length range covers ${d.length_in}"` };
    if (!d.severity) return { price: null, source: "Choose a severity to price this crease" };
    const cell = one("SELECT price FROM pdr_crease_prices WHERE range_id=? AND severity=? AND vehicle_category=?", rng.id, d.severity, cat.key);
    if (!cell) return { price: null, source: `No crease price for ${lengthRangeLabel(rng)} · ${DENT_SEVERITY_LABELS[d.severity]} · ${cat.label}` };
    base = cell.price; label = `Crease ${lengthRangeLabel(rng)} · ${DENT_SEVERITY_LABELS[d.severity]} · ${cat.label}`;
  } else {
    appliesTo = "standard";
    const row = standardRow(d.size, cat.key);
    if (!row) return { price: null, source: `No standard price for ${DENT_SIZE_LABELS[d.size]} · ${cat.label}` };
    base = row.price; label = `Standard ${DENT_SIZE_LABELS[d.size]} · ${cat.label}`;
  }
  const applied: string[] = [];
  let total = base;
  const apply = (dimension: string, value: string | null, name: string) => {
    const a = adjustment(appliesTo, dimension, value);
    if (!a) return;
    const delta = a.kind === "percent" ? roundMoney(base * a.amount / 100) : a.amount;
    total += delta;
    applied.push(`${name} ${a.kind === "percent" ? `${a.amount >= 0 ? "+" : ""}${a.amount}%` : `${a.amount >= 0 ? "+" : "−"}$${Math.abs(a.amount).toFixed(2)}`}`);
  };
  if (appliesTo === "standard") apply("severity", d.severity, d.severity ? DENT_SEVERITY_LABELS[d.severity] : "");
  apply("location_difficulty", d.location_difficulty, d.location_difficulty ? `${LOCATION_DIFFICULTY_LABELS[d.location_difficulty]} location` : "");
  if (appliesTo === "standard" && rng) apply("length_range", String(rng.id), `Length ${lengthRangeLabel(rng)}`);
  apply("panel", d.panel_id, PDR_PANELS.find(p => p.id === d.panel_id)?.name || d.panel_id);
  total = roundMoney(total);
  if (total < 0) return { price: null, source: `${label}: adjustments make the price negative; check the matrix` };
  return { price: total, source: `${label} $${base.toFixed(2)}${applied.length ? "; " + applied.join("; ") : ""}` };
}

// ---------- management editing ----------
const money = (v: any, label: string) => {
  if (v === null || v === "") return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1000000) fail(`${label} must be a dollar amount from 0 to 1,000,000, or blank`);
  return roundMoney(v);
};
const checkCategory = (key: any) => { if (!categories().some(c => c.key === key)) fail("Choose an existing vehicle category"); return key as string; };
const checkRanges = (list: { id?: number; minIn: number; maxIn: number }[]) => {
  const sorted = [...list].sort((a, b) => a.minIn - b.minIn);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].minIn <= sorted[i - 1].maxIn)
    fail(`Length ranges cannot overlap: ${lengthRangeLabel(sorted[i - 1])} and ${lengthRangeLabel(sorted[i])} share inches. Each inch belongs to one range, so start the later range at ${sorted[i - 1].maxIn + 1}".`);
};
const rangeBounds = (b: any) => {
  const minIn = b?.minIn, maxIn = b?.maxIn;
  if (![minIn, maxIn].every(n => Number.isInteger(n) && n >= DENT_LENGTH_MIN && n <= DENT_LENGTH_MAX) || minIn > maxIn)
    fail(`Enter whole inches from ${DENT_LENGTH_MIN} to ${DENT_LENGTH_MAX}, with "from" not greater than "to"`);
  return { minIn, maxIn };
};

export function registerPdrPricing(app: Express) {
  const tx = <T>(fn: () => T) => sqlite.transaction(fn).immediate();
  app.get("/api/pdr-pricing", (_req, res) => res.json(pricingMaster()));

  app.put("/api/pdr-pricing/standard", (req, res) => res.json(tx(() => {
    const { size, category } = req.body || {};
    if (!STANDARD_DENT_SIZES.includes(size)) fail("Choose a standard dent size");
    checkCategory(category);
    const price = money(req.body.price, "Price");
    const rows = all("SELECT * FROM pricing_matrices WHERE matrix_type='pdr_dent' AND size_category=? AND vehicle_category=?", size, category);
    if (price === null) sqlite.prepare("DELETE FROM pricing_matrices WHERE matrix_type='pdr_dent' AND size_category=? AND vehicle_category=?").run(size, category);
    else if (rows.length) sqlite.prepare("UPDATE pricing_matrices SET price=? WHERE matrix_type='pdr_dent' AND size_category=? AND vehicle_category=?").run(price, size, category);
    else sqlite.prepare("INSERT INTO pricing_matrices(name,matrix_type,panel,size_category,price,vehicle_category,unit_type) VALUES(?,?,?,?,?,?,?)")
      .run(`Standard PDR Dent Pricing (${categories().find(c => c.key === category)!.label})`, "pdr_dent", "Any", size, price, category, "each");
    audit("pricing.standard_dent_price", "pricing_matrices", `${size}/${category}`, rows.map(r => r.price), price);
    return pricingMaster();
  })));

  app.post("/api/pdr-pricing/categories", (req, res) => res.json(tx(() => {
    const label = String(req.body?.label || "").trim();
    if (!label || label.length > 60) fail("Enter a category name (up to 60 characters)");
    if (categories().some(c => c.label.toLowerCase() === label.toLowerCase())) fail("A category with that name already exists");
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "category";
    while (categories().some(c => c.key === key)) key += "_2";
    const sort = (one("SELECT MAX(sort) m FROM pdr_vehicle_categories")?.m || 0) + 1;
    sqlite.prepare("INSERT INTO pdr_vehicle_categories(key,label,body_styles,sort,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(key, label, "", sort, now(), now());
    return pricingMaster();
  })));

  // Rename a category, or choose which diagram body styles it prices. A body style belongs to one category,
  // so assigning it here moves it from wherever it was.
  app.patch("/api/pdr-pricing/categories/:key", (req, res) => res.json(tx(() => {
    const key = checkCategory(req.params.key), body = req.body || {};
    if (Object.keys(body).some(k => !["label", "bodyStyles"].includes(k))) fail("Unsupported category field");
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label || label.length > 60) fail("Enter a category name (up to 60 characters)");
      if (categories().some(c => c.key !== key && c.label.toLowerCase() === label.toLowerCase())) fail("A category with that name already exists");
      sqlite.prepare("UPDATE pdr_vehicle_categories SET label=?,updated_at=? WHERE key=?").run(label, now(), key);
    }
    if (body.bodyStyles !== undefined) {
      if (!Array.isArray(body.bodyStyles) || body.bodyStyles.some((b: any) => !DENT_BODY_STYLES.includes(b))) fail("Choose body styles from Sedan, SUV and Pickup");
      const wanted = Array.from(new Set(body.bodyStyles as string[]));
      for (const c of categories()) if (c.key !== key) {
        const kept = c.bodyStyles.filter(b => !wanted.includes(b));
        if (kept.length !== c.bodyStyles.length) sqlite.prepare("UPDATE pdr_vehicle_categories SET body_styles=?,updated_at=? WHERE key=?").run(kept.join(","), now(), c.key);
      }
      sqlite.prepare("UPDATE pdr_vehicle_categories SET body_styles=?,updated_at=? WHERE key=?").run(wanted.join(","), now(), key);
    }
    return pricingMaster();
  })));

  app.post("/api/pdr-pricing/ranges", (req, res) => res.json(tx(() => {
    const r = rangeBounds(req.body);
    checkRanges([...ranges(), r]);
    sqlite.prepare("INSERT INTO pdr_length_ranges(min_in,max_in,created_at,updated_at) VALUES(?,?,?,?)").run(r.minIn, r.maxIn, now(), now());
    return pricingMaster();
  })));
  app.patch("/api/pdr-pricing/ranges/:id", (req, res) => res.json(tx(() => {
    const id = Number(req.params.id);
    if (!one("SELECT 1 FROM pdr_length_ranges WHERE id=?", id)) fail("Length range not found", 404);
    const r = rangeBounds(req.body);
    checkRanges([...ranges().filter(x => x.id !== id), r]);
    sqlite.prepare("UPDATE pdr_length_ranges SET min_in=?,max_in=?,updated_at=? WHERE id=?").run(r.minIn, r.maxIn, now(), id);
    return pricingMaster();
  })));
  // Removing a range also removes its crease prices and length adjustments (the screen asks first).
  app.delete("/api/pdr-pricing/ranges/:id", (req, res) => res.json(tx(() => {
    const id = Number(req.params.id);
    if (!one("SELECT 1 FROM pdr_length_ranges WHERE id=?", id)) fail("Length range not found", 404);
    sqlite.prepare("DELETE FROM pdr_crease_prices WHERE range_id=?").run(id);
    sqlite.prepare("DELETE FROM pdr_price_adjustments WHERE dimension='length_range' AND value=?").run(String(id));
    sqlite.prepare("DELETE FROM pdr_length_ranges WHERE id=?").run(id);
    return pricingMaster();
  })));

  app.put("/api/pdr-pricing/crease", (req, res) => res.json(tx(() => {
    const { rangeId, severity, category } = req.body || {};
    if (!one("SELECT 1 FROM pdr_length_ranges WHERE id=?", rangeId)) fail("Choose an existing length range");
    if (!DENT_SEVERITIES.includes(severity)) fail("Choose Shallow, Medium or Deep");
    checkCategory(category);
    const price = money(req.body.price, "Price");
    if (price === null) sqlite.prepare("DELETE FROM pdr_crease_prices WHERE range_id=? AND severity=? AND vehicle_category=?").run(rangeId, severity, category);
    else sqlite.prepare(`INSERT INTO pdr_crease_prices(range_id,severity,vehicle_category,price,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(range_id,severity,vehicle_category) DO UPDATE SET price=excluded.price,updated_at=excluded.updated_at`).run(rangeId, severity, category, price, now());
    return pricingMaster();
  })));

  app.put("/api/pdr-pricing/adjustments", (req, res) => res.json(tx(() => {
    const { appliesTo, dimension, value, kind } = req.body || {};
    if (!["crease", "standard"].includes(appliesTo)) fail("Choose crease or standard dents");
    if (!ADJUSTMENT_DIMENSIONS[appliesTo as "crease"].some(d => d.key === dimension)) fail("This adjustment is not available for that matrix");
    const validValue = dimension === "panel" ? PDR_PANELS.some(p => p.id === value)
      : dimension === "severity" ? DENT_SEVERITIES.includes(value)
      : dimension === "location_difficulty" ? LOCATION_DIFFICULTIES.includes(value)
      : !!one("SELECT 1 FROM pdr_length_ranges WHERE id=?", Number(value));
    if (typeof value !== "string" || !validValue) fail("Choose a valid value for this adjustment");
    const amount = req.body.amount;
    if (amount === null || amount === "") sqlite.prepare("DELETE FROM pdr_price_adjustments WHERE applies_to=? AND dimension=? AND value=?").run(appliesTo, dimension, value);
    else {
      if (!["amount", "percent"].includes(kind)) fail("Choose a dollar amount or a percentage");
      if (typeof amount !== "number" || !Number.isFinite(amount) || (kind === "percent" ? amount < -100 || amount > 1000 : Math.abs(amount) > 1000000))
        fail(kind === "percent" ? "Percent must be from -100 to 1000" : "Enter a valid dollar amount");
      sqlite.prepare(`INSERT INTO pdr_price_adjustments(applies_to,dimension,value,kind,amount,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(applies_to,dimension,value) DO UPDATE SET kind=excluded.kind,amount=excluded.amount,updated_at=excluded.updated_at`)
        .run(appliesTo, dimension, value, kind, kind === "percent" ? Math.round(amount * 100) / 100 : roundMoney(amount), now());
    }
    return pricingMaster();
  })));

  app.put("/api/pdr-pricing/settings", (req, res) => res.json(tx(() => {
    const body = req.body || {};
    if (Object.keys(body).some(k => k !== "packageApprovalThresholdPercent")) fail("Unsupported pricing setting");
    const v = body.packageApprovalThresholdPercent;
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) fail("Enter a percentage from 0 to 100, or leave it blank");
    sqlite.prepare(`INSERT INTO pdr_pricing_settings(key,value,updated_at) VALUES('package_approval_threshold_percent',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(v === null ? null : String(v), now());
    return pricingMaster();
  })));
}
