import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { securityContext, actorLabel } from "./security-context";
import { addEstimateLines, deleteEstimateLine, editableEstimate, fail, recalculateEstimate } from "./billing";
import { suggestDentPrice } from "./pdr-pricing";
import { packageStatus } from "./dent-approval";
import {
  DENT_SIZES, DENT_SEVERITIES, LOCATION_DIFFICULTIES, PAINT_CORRECTABLE, DENT_BODY_STYLES,
  DENT_LENGTH_MIN, DENT_LENGTH_MAX, DENT_NOTES_MAX, dentLineDescription, roundMoney,
} from "../shared/dents";

// Individual PDR dent records (Phase 2.1) and their pricing (Phase 2.2).
// Money still lives only in estimate_line_items. Each dent is either not billed (line_item_id NULL),
// billed on its own individual line, or part of exactly one active package (group_id + the package's line).
// Every dent keeps the price calculated from the master when it was priced (suggested_price), any
// manual override with who/why/when, and its billing relationship. Master changes never reprice an
// estimate unless someone explicitly reprices it.
const DENT_COLUMNS = [
  ["suggested_price", "REAL"], ["suggested_source", "TEXT"], ["suggested_at", "TEXT"],
  ["override_price", "REAL"], ["override_reason", "TEXT"], ["override_suggested_price", "REAL"],
  ["override_by_id", "INTEGER"], ["override_by", "TEXT"], ["override_at", "TEXT"], ["group_id", "INTEGER"],
] as const;
const LOCK = (alias: string) => `EXISTS(SELECT 1 FROM invoices WHERE estimate_id=${alias}.estimate_id) OR EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=${alias}.estimate_id)`;

export function migrateEstimateDents() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS estimate_dents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estimate_id INTEGER NOT NULL REFERENCES estimates(id) DEFERRABLE INITIALLY DEFERRED,
      panel_id TEXT NOT NULL CHECK(length(panel_id) BETWEEN 1 AND 80),
      panel_name TEXT NOT NULL CHECK(length(panel_name) BETWEEN 1 AND 200),
      body_style TEXT NOT NULL CHECK(body_style IN ('sedan','suv','pickup')),
      size TEXT NOT NULL CHECK(size IN ('dime','nickel','quarter','half_dollar','softball','crease')),
      length_in INTEGER CHECK(length_in IS NULL OR length_in BETWEEN ${DENT_LENGTH_MIN} AND ${DENT_LENGTH_MAX}),
      severity TEXT CHECK(severity IS NULL OR severity IN ('shallow','medium','deep')),
      location_difficulty TEXT CHECK(location_difficulty IS NULL OR location_difficulty IN ('easy','moderate','difficult','extreme')),
      paint_correctable TEXT CHECK(paint_correctable IS NULL OR paint_correctable IN ('yes','no')),
      notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= ${DENT_NOTES_MAX}),
      line_item_id INTEGER REFERENCES estimate_line_items(id) ON DELETE SET NULL,
      matrix_unit_price REAL CHECK(matrix_unit_price IS NULL OR matrix_unit_price >= 0),
      price_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(size != 'crease' OR length_in IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS estimate_dents_estimate ON estimate_dents(estimate_id);
    CREATE INDEX IF NOT EXISTS estimate_dents_line ON estimate_dents(line_item_id);
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_insert BEFORE INSERT ON estimate_dents WHEN ${LOCK("NEW")}
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_update BEFORE UPDATE ON estimate_dents WHEN ${LOCK("OLD")}
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_delete BEFORE DELETE ON estimate_dents WHEN ${LOCK("OLD")}
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_estimate_fixed BEFORE UPDATE OF estimate_id ON estimate_dents
      BEGIN SELECT RAISE(ABORT,'A dent cannot move to another estimate'); END;

    CREATE TABLE IF NOT EXISTS estimate_dent_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estimate_id INTEGER NOT NULL REFERENCES estimates(id) DEFERRABLE INITIALLY DEFERRED,
      scope TEXT NOT NULL CHECK(scope IN ('panel','vehicle')),
      panel_id TEXT, panel_name TEXT,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')),
      line_item_id INTEGER REFERENCES estimate_line_items(id) ON DELETE SET NULL,
      manual_price REAL NOT NULL CHECK(manual_price >= 0 AND manual_price <= 1000000),
      calculated_total REAL CHECK(calculated_total IS NULL OR calculated_total >= 0),
      approved_price REAL, approved_by_id INTEGER, approved_by TEXT, approved_at TEXT,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, removed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS estimate_dent_groups_estimate ON estimate_dent_groups(estimate_id);
    CREATE TRIGGER IF NOT EXISTS estimate_dent_groups_lock_insert BEFORE INSERT ON estimate_dent_groups WHEN ${LOCK("NEW")}
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; packages are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dent_groups_lock_update BEFORE UPDATE ON estimate_dent_groups WHEN ${LOCK("OLD")}
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; packages are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dent_groups_no_delete BEFORE DELETE ON estimate_dent_groups
      BEGIN SELECT RAISE(ABORT,'Package history is kept; mark it removed instead'); END;

    CREATE TABLE IF NOT EXISTS estimate_pricing_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id) DEFERRABLE INITIALLY DEFERRED,
      show_dent_details INTEGER NOT NULL DEFAULT 0 CHECK(show_dent_details IN (0,1)),
      updated_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS estimate_pricing_options_lock BEFORE UPDATE ON estimate_pricing_options
      WHEN EXISTS(SELECT 1 FROM invoices WHERE estimate_id=OLD.estimate_id)
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced; document options are locked'); END;

    -- Customer-facing dent details copied onto an invoice line when it is issued. Immutable like invoice lines.
    CREATE TABLE IF NOT EXISTS invoice_line_dent_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_line_id INTEGER NOT NULL REFERENCES invoice_line_items(id),
      position INTEGER NOT NULL,
      detail TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS invoice_line_dent_details_line ON invoice_line_dent_details(invoice_line_id);
    CREATE TRIGGER IF NOT EXISTS invoice_line_dent_details_no_update BEFORE UPDATE ON invoice_line_dent_details
      BEGIN SELECT RAISE(ABORT,'Issued invoice details are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS invoice_line_dent_details_no_delete BEFORE DELETE ON invoice_line_dent_details
      BEGIN SELECT RAISE(ABORT,'Issued invoice details are immutable'); END;
  `);
  const cols = (sqlite.prepare("PRAGMA table_info(estimate_dents)").all() as any[]).map(c => c.name);
  const missing = DENT_COLUMNS.filter(([c]) => !cols.includes(c));
  if (missing.length) {
    for (const [c, t] of missing) sqlite.exec(`ALTER TABLE estimate_dents ADD COLUMN ${c} ${t}`);
    // Row-level audit triggers list columns; let initializeSecurity() recreate them with the new ones.
    for (const op of ["insert", "update", "delete"]) sqlite.exec(`DROP TRIGGER IF EXISTS staff_audit_estimate_dents_${op}`);
  }
  sqlite.exec("CREATE INDEX IF NOT EXISTS estimate_dents_group ON estimate_dents(group_id)");
  upgradePhase21Dents();
}

// One time: dents saved in Phase 2.1 keep the price they were billed at. A billed dent's matrix price
// becomes its calculated price; if a different price was entered, that becomes a recorded override.
// Dents not yet billed are priced from the current master (they never had a price).
function upgradePhase21Dents() {
  if (sqlite.prepare("SELECT 1 FROM app_migrations WHERE version='estimate-dent-pricing-v1'").get()) return;
  sqlite.transaction(() => {
    const stamp = new Date().toISOString();
    for (const d of sqlite.prepare("SELECT d.*,l.unit_price line_price FROM estimate_dents d LEFT JOIN estimate_line_items l ON l.id=d.line_item_id WHERE d.suggested_at IS NULL").all() as any[]) {
      if (sqlite.prepare("SELECT 1 FROM invoices WHERE estimate_id=? UNION SELECT 1 FROM ops_cases WHERE estimate_id=?").get(d.estimate_id, d.estimate_id)) {
        // Locked estimates are left exactly as they are.
        continue;
      }
      if (d.line_item_id) {
        const source = (d.price_source || "Phase 2.1 matrix price").replace(/ \(estimator entered [^)]*\)$/, "");
        const overridden = d.matrix_unit_price === null || d.line_price !== d.matrix_unit_price;
        sqlite.prepare(`UPDATE estimate_dents SET suggested_price=?,suggested_source=?,suggested_at=?,
          override_price=?,override_reason=?,override_suggested_price=?,override_by=?,override_at=? WHERE id=?`)
          .run(d.matrix_unit_price, source, stamp, overridden ? d.line_price : null,
            overridden ? "Price entered when the dent was added to the estimate (before Phase 2.2)" : null,
            overridden ? d.matrix_unit_price : null, overridden ? "Phase 2.2 upgrade" : null, overridden ? stamp : null, d.id);
      } else {
        const s = suggestDentPrice(d);
        sqlite.prepare("UPDATE estimate_dents SET suggested_price=?,suggested_source=?,suggested_at=? WHERE id=?").run(s.price, s.source, stamp, d.id);
      }
    }
    sqlite.prepare("INSERT INTO app_migrations(version,applied_at) VALUES('estimate-dent-pricing-v1',?)").run(stamp);
  })();
}

const COLUMNS: Record<string, string> = {
  panelId: "panel_id", panelName: "panel_name", bodyStyle: "body_style", size: "size", lengthIn: "length_in",
  severity: "severity", locationDifficulty: "location_difficulty", paintCorrectable: "paint_correctable", notes: "notes",
};
// Fields that decide a dent's price. Locked while the dent is billed; changing them re-prices an unbilled dent.
const PRICING_FIELDS = ["panelId", "panelName", "bodyStyle", "size", "lengthIn", "severity", "locationDifficulty"];

const referencePrice = (r: any): number | null => r.override_price ?? r.suggested_price ?? null;
const toDent = (r: any) => {
  if (!r) return r;
  const current = r.line_item_id ? null : suggestDentPrice(r);
  return {
    id: r.id, estimateId: r.estimate_id, panelId: r.panel_id, panelName: r.panel_name, bodyStyle: r.body_style, size: r.size,
    lengthIn: r.length_in, severity: r.severity, locationDifficulty: r.location_difficulty, paintCorrectable: r.paint_correctable,
    notes: r.notes, lineItemId: r.line_item_id, groupId: r.group_id,
    suggestedPrice: r.suggested_price, suggestedSource: r.suggested_source, suggestedAt: r.suggested_at,
    overridePrice: r.override_price, overrideReason: r.override_reason, overrideSuggestedPrice: r.override_suggested_price,
    overrideBy: r.override_by, overrideAt: r.override_at,
    referencePrice: referencePrice(r),
    // For unbilled dents: what the master would suggest now, so the screen can offer an explicit reprice.
    currentSuggestedPrice: current?.price ?? null, currentSuggestedSource: current?.source ?? null,
    matrixChanged: !!current && (current.price !== r.suggested_price || current.source !== r.suggested_source),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
};
const rawDent = (id: number) => sqlite.prepare("SELECT * FROM estimate_dents WHERE id=?").get(id) as any;
export const listDents = (estimateId: number) =>
  (sqlite.prepare("SELECT * FROM estimate_dents WHERE estimate_id=? ORDER BY id").all(estimateId) as any[]).map(toDent);
const actor = () => ({ id: securityContext.getStore()?.userId ?? null, label: actorLabel() });
const stamp = () => new Date().toISOString();

// Same rules as estimate lines: no changes once invoiced or once production has started.
function dentEditableEstimate(id: number) {
  const est = editableEstimate(id);
  if (est.serviceType !== "pdr") fail("Individual dent records are available on Paintless Dent Repair estimates only.");
  if (sqlite.prepare("SELECT 1 FROM ops_cases WHERE estimate_id=?").get(id))
    fail("Production started; dent records are locked. Use a separate approved supplement.", 409);
  return est;
}

function choice(value: any, allowed: readonly string[], label: string, nullable = true) {
  if ((value === null || value === undefined || value === "") && nullable) return null;
  if (typeof value !== "string" || !allowed.includes(value)) fail(`Choose a valid ${label}`);
  return value;
}
function text(value: any, label: string, max: number, required: boolean) {
  const v = value == null ? "" : value;
  if (typeof v !== "string") fail(`${label} is invalid`);
  const trimmed = v.trim();
  if (required && !trimmed) fail(`${label} is required`);
  if (trimmed.length > max) fail(`${label} is too long`);
  return trimmed;
}
const price = (v: any, label: string) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1000000) fail(`${label} must be a dollar amount from 0 to 1,000,000`);
  return roundMoney(v);
};
// Validates a complete dent (after merging an update onto the stored values).
function validDent(d: any) {
  const lengthIn = d.lengthIn === null || d.lengthIn === undefined || d.lengthIn === "" ? null : d.lengthIn;
  if (lengthIn !== null && (!Number.isInteger(lengthIn) || lengthIn < DENT_LENGTH_MIN || lengthIn > DENT_LENGTH_MAX))
    fail(`Length must be a whole number of inches from ${DENT_LENGTH_MIN} to ${DENT_LENGTH_MAX}`);
  const size = choice(d.size, DENT_SIZES, "dent size", false)!;
  if (size === "crease" && lengthIn === null) fail("Enter the crease length (1 to 36 inches)");
  return {
    panelId: text(d.panelId, "Panel", 80, true), panelName: text(d.panelName, "Panel name", 200, true),
    bodyStyle: choice(d.bodyStyle, DENT_BODY_STYLES, "body style", false)!, size, lengthIn,
    severity: choice(d.severity, DENT_SEVERITIES, "severity"),
    locationDifficulty: choice(d.locationDifficulty, LOCATION_DIFFICULTIES, "location difficulty"),
    paintCorrectable: choice(d.paintCorrectable, PAINT_CORRECTABLE, "paint damage correctable answer"),
    notes: text(d.notes, "Notes", DENT_NOTES_MAX, false),
  };
}
function onlyKnownFields(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid dent details");
  const unknown = Object.keys(body).filter(k => !(k in COLUMNS));
  if (unknown.length) fail(`Unsupported dent field: ${unknown[0]}`);
}
const snake = (d: ReturnType<typeof validDent>) => ({ panel_id: d.panelId, body_style: d.bodyStyle, size: d.size, length_in: d.lengthIn, severity: d.severity, location_difficulty: d.locationDifficulty });

export function createDent(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    onlyKnownFields(body);
    const count = (sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE estimate_id=?").get(estimateId) as any).n;
    if (count >= 1000) fail("An estimate can hold up to 1,000 dent records");
    const d = validDent(body), now = stamp(), s = suggestDentPrice(snake(d));
    const info = sqlite.prepare(`INSERT INTO estimate_dents(estimate_id,panel_id,panel_name,body_style,size,length_in,severity,location_difficulty,paint_correctable,notes,suggested_price,suggested_source,suggested_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(estimateId, d.panelId, d.panelName, d.bodyStyle, d.size, d.lengthIn, d.severity, d.locationDifficulty, d.paintCorrectable, d.notes, s.price, s.source, now, now, now);
    return toDent(rawDent(Number(info.lastInsertRowid)));
  }).immediate();
}

export function updateDent(id: number, body: any) {
  return sqlite.transaction(() => {
    const old = rawDent(id);
    if (!old) fail("Dent not found", 404);
    dentEditableEstimate(old.estimate_id);
    onlyKnownFields(body);
    const current = toDent(old);
    const pricingChanged = PRICING_FIELDS.some(k => Object.hasOwn(body, k) && body[k] !== (current as any)[k]);
    if (old.line_item_id && pricingChanged)
      fail("This dent is already billed. Remove its estimate line or package first to change details that affect its price.", 409);
    const d = validDent({ ...current, ...body });
    sqlite.prepare(`UPDATE estimate_dents SET panel_id=?,panel_name=?,body_style=?,size=?,length_in=?,severity=?,location_difficulty=?,paint_correctable=?,notes=?,updated_at=? WHERE id=?`)
      .run(d.panelId, d.panelName, d.bodyStyle, d.size, d.lengthIn, d.severity, d.locationDifficulty, d.paintCorrectable, d.notes, stamp(), id);
    if (pricingChanged) {
      // New measurements: price this dent from the current master. An override was for the old details, so it is cleared (the audit history keeps it).
      const s = suggestDentPrice(snake(d));
      sqlite.prepare(`UPDATE estimate_dents SET suggested_price=?,suggested_source=?,suggested_at=?,override_price=NULL,override_reason=NULL,
        override_suggested_price=NULL,override_by_id=NULL,override_by=NULL,override_at=NULL WHERE id=?`).run(s.price, s.source, stamp(), id);
    }
    return toDent(rawDent(id));
  }).immediate();
}

export function deleteDent(id: number) {
  return sqlite.transaction(() => {
    const old = rawDent(id);
    if (!old) fail("Dent not found", 404);
    dentEditableEstimate(old.estimate_id);
    if (old.line_item_id) fail("This dent is billed. Remove its estimate line or package first, then delete the dent.", 409);
    sqlite.prepare("DELETE FROM estimate_dents WHERE id=?").run(id);
  }).immediate();
}

// Manual price for one dent. Records the suggested price at that moment, the final price, who and why.
export function overrideDentPrice(id: number, body: any) {
  return sqlite.transaction(() => {
    const old = rawDent(id);
    if (!old) fail("Dent not found", 404);
    dentEditableEstimate(old.estimate_id);
    if (old.line_item_id) fail("This dent is billed. Remove its estimate line or package first to change its price.", 409);
    if (body?.price === null) {
      sqlite.prepare(`UPDATE estimate_dents SET override_price=NULL,override_reason=NULL,override_suggested_price=NULL,override_by_id=NULL,override_by=NULL,override_at=NULL,updated_at=? WHERE id=?`).run(stamp(), id);
      audit("estimate.dent_price_override_cleared", "estimate_dents", id, { price: old.override_price, reason: old.override_reason }, null);
      return toDent(rawDent(id));
    }
    const final = price(body?.price, "Price");
    let reason = text(body?.reason, "Reason", 500, false);
    if (!reason) {
      if (old.suggested_price !== null) fail("Enter a reason for changing the suggested price");
      reason = "No matrix price available";
    }
    const who = actor();
    sqlite.prepare(`UPDATE estimate_dents SET override_price=?,override_reason=?,override_suggested_price=?,override_by_id=?,override_by=?,override_at=?,updated_at=? WHERE id=?`)
      .run(final, reason, old.suggested_price, who.id, who.label, stamp(), stamp(), id);
    audit("estimate.dent_price_override", "estimate_dents", id, { suggestedPrice: old.suggested_price, previousOverride: old.override_price }, { price: final, reason, by: who.label });
    return toDent(rawDent(id));
  }).immediate();
}

// Explicit repricing: apply the current master to every dent that is not billed. Overrides stay.
export function repriceDents(estimateId: number) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    const changes: any[] = [];
    for (const d of sqlite.prepare("SELECT * FROM estimate_dents WHERE estimate_id=? AND line_item_id IS NULL").all(estimateId) as any[]) {
      const s = suggestDentPrice(d);
      if (s.price === d.suggested_price && s.source === d.suggested_source) continue;
      sqlite.prepare("UPDATE estimate_dents SET suggested_price=?,suggested_source=?,suggested_at=?,updated_at=? WHERE id=?").run(s.price, s.source, stamp(), stamp(), d.id);
      changes.push({ dentId: d.id, before: d.suggested_price, after: s.price, source: s.source });
    }
    audit("estimate.dents_repriced", "estimates", estimateId, null, { changes });
    return { changed: changes.length, dents: listDents(estimateId) };
  }).immediate();
}

function loadDents(estimateId: number, ids: any, allowIndividuallyBilled = false) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) fail("Choose 1 to 500 dents");
  const seen = new Set<number>();
  return ids.map((id: any) => {
    if (!Number.isInteger(id) || seen.has(id)) fail("Each dent can be chosen once");
    seen.add(id);
    const d = rawDent(id);
    if (!d || d.estimate_id !== estimateId) fail("Dent not found on this estimate", 404);
    if (d.line_item_id) {
      const shared = (sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE line_item_id=?").get(d.line_item_id) as any).n;
      if (!allowIndividuallyBilled || d.group_id || shared !== 1)
        fail(d.group_id ? "A chosen dent is already in a package. Remove that package first." :
          shared !== 1 ? "A chosen dent is on a combined line from before Phase 2.2. Remove that line first." :
          "A chosen dent is already billed. Reload the estimate.", 409);
    }
    return d;
  });
}
const label = (d: any) => dentLineDescription(d.panel_id, d.panel_name, d.size);

// Individual billing: one separately priced line per dent, at its own price (override or calculated).
export function billIndividually(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    const dents = loadDents(estimateId, body?.dentIds);
    const missing = dents.filter((d: any) => referencePrice(d) === null);
    if (missing.length) fail(`Pricing incomplete: enter a price for ${missing.map(label).join(", ")}`);
    const ordinal = (d: any) => (sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE estimate_id=? AND panel_id=? AND id<=?").get(estimateId, d.panel_id, d.id) as any).n;
    const multi = (d: any) => (sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE estimate_id=? AND panel_id=?").get(estimateId, d.panel_id) as any).n > 1;
    const created = addEstimateLines(estimateId, dents.map((d: any) => ({
      serviceCategory: "pdr_dent", lineType: "labor", repairAction: "repair",
      description: `${label(d)}${multi(d) ? ` #${ordinal(d)}` : ""}`,
      panelLocation: d.panel_name, damageSize: d.size, damageSeverity: "moderate",
      quantity: 1, unit: "each", unitPrice: referencePrice(d),
    })));
    dents.forEach((d: any, i: number) => sqlite.prepare("UPDATE estimate_dents SET line_item_id=?,group_id=NULL,matrix_unit_price=?,price_source=?,updated_at=? WHERE id=?")
      .run(created[i].id, d.suggested_price, d.suggested_source, stamp(), d.id));
    audit("estimate.dents_billed_individually", "estimates", estimateId, null, { lines: created.map((l: any, i: number) => ({ lineId: l.id, dentId: dents[i].id, price: l.unitPrice })) });
    return { created: created.length, dents: listDents(estimateId) };
  }).immediate();
}

const groupRow = (id: number) => sqlite.prepare("SELECT * FROM estimate_dent_groups WHERE id=?").get(id) as any;
const toGroup = (g: any) => {
  const st = packageStatus(g);
  return {
    id: g.id, estimateId: g.estimate_id, scope: g.scope, panelId: g.panel_id, panelName: g.panel_name, label: g.label, status: g.status,
    lineItemId: g.line_item_id, manualPrice: g.manual_price, calculatedTotal: g.calculated_total,
    pricingComplete: st.comparison.complete, difference: st.comparison.difference, differencePercent: st.comparison.percent,
    approvalRequired: st.approvalRequired, approved: st.approved, approvedPrice: g.approved_price, approvedBy: g.approved_by, approvedAt: g.approved_at,
    createdBy: g.created_by, createdAt: g.created_at, removedAt: g.removed_at,
    dentIds: (sqlite.prepare("SELECT id FROM estimate_dents WHERE group_id=? ORDER BY id").all(g.id) as any[]).map(r => r.id),
  };
};
export const listGroups = (estimateId: number) =>
  (sqlite.prepare("SELECT * FROM estimate_dent_groups WHERE estimate_id=? AND status='active' ORDER BY id").all(estimateId) as any[]).map(toGroup);

// Panel or whole-vehicle package: one line at the price the estimator enters. Never discounted automatically.
// Dents billed on their own individual lines may be moved into the package; those lines are removed in the same step.
export function createPackage(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    const scope = body?.scope;
    if (!["panel", "vehicle"].includes(scope)) fail("Choose a panel package or a whole-vehicle package");
    const manual = price(body?.manualPrice, "Package price");
    const dents = loadDents(estimateId, body?.dentIds, true);
    if (scope === "panel" && dents.some((d: any) => d.panel_id !== dents[0].panel_id)) fail("A panel package can only include dents on one panel");
    for (const lineId of Array.from(new Set(dents.map((d: any) => d.line_item_id).filter(Boolean)))) deleteEstimateLine(lineId as number);
    const refs = dents.map(referencePrice);
    const calculated = refs.some((p: number | null) => p === null) ? null : roundMoney(refs.reduce((s: number, p: number | null) => s + (p as number), 0));
    const n = dents.length, noun = `${n} dent${n === 1 ? "" : "s"}`;
    const lbl = scope === "panel" ? `${dents[0].panel_name}: dent repair package (${noun})` : `Whole-vehicle dent repair package (${noun})`;
    const [line] = addEstimateLines(estimateId, [{
      serviceCategory: "pdr_dent", lineType: "labor", repairAction: "repair", description: lbl,
      panelLocation: scope === "panel" ? dents[0].panel_name : "Whole vehicle", damageSize: "package", damageSeverity: "moderate",
      quantity: 1, unit: "package", unitPrice: manual,
    }]);
    const who = actor(), now = stamp();
    const info = sqlite.prepare(`INSERT INTO estimate_dent_groups(estimate_id,scope,panel_id,panel_name,label,line_item_id,manual_price,calculated_total,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(estimateId, scope, scope === "panel" ? dents[0].panel_id : null, scope === "panel" ? dents[0].panel_name : null, lbl, line.id, manual, calculated, who.label, now, now);
    const gid = Number(info.lastInsertRowid);
    for (const d of dents) sqlite.prepare("UPDATE estimate_dents SET line_item_id=?,group_id=?,matrix_unit_price=?,price_source=?,updated_at=? WHERE id=?")
      .run(line.id, gid, d.suggested_price, d.suggested_source, now, d.id);
    const g = toGroup(groupRow(gid));
    audit("estimate.dent_package_created", "estimate_dent_groups", gid, null, { estimateId, scope, dentIds: g.dentIds, calculatedTotal: calculated, manualPrice: manual, approvalRequired: g.approvalRequired });
    return g;
  }).immediate();
}

function activeGroup(id: number) {
  const g = groupRow(id);
  if (!g || g.status !== "active") fail("Package not found", 404);
  dentEditableEstimate(g.estimate_id);
  return g;
}

// Changing a package price updates its line and needs a fresh approval for the new price.
export function repricePackage(id: number, body: any) {
  return sqlite.transaction(() => {
    const g = activeGroup(id);
    const manual = price(body?.manualPrice, "Package price");
    if (manual === g.manual_price) return toGroup(g);
    const est = editableEstimate(g.estimate_id);
    sqlite.prepare("UPDATE estimate_line_items SET unit_price=?,total=?,allocation_version=allocation_version+1 WHERE id=?").run(manual, manual, g.line_item_id);
    sqlite.prepare("UPDATE estimate_dent_groups SET manual_price=?,approved_price=NULL,approved_by_id=NULL,approved_by=NULL,approved_at=NULL,updated_at=? WHERE id=?").run(manual, stamp(), id);
    if (est.status === "approved") storage.updateEstimate(est.id, { status: "draft", approvedDate: null });
    recalculateEstimate(est.id);
    audit("estimate.dent_package_repriced", "estimate_dent_groups", id, { manualPrice: g.manual_price, approvedPrice: g.approved_price }, { manualPrice: manual });
    return toGroup(groupRow(id));
  }).immediate();
}

// Management approval of the exact package price shown on screen.
export function approvePackage(id: number, body: any) {
  return sqlite.transaction(() => {
    const g = activeGroup(id);
    if (body?.manualPrice !== g.manual_price) fail("The package price changed. Reload and review it before approving.", 409);
    if (!packageStatus(g).approvalRequired) fail("This package price does not need approval.", 409);
    const who = actor();
    sqlite.prepare("UPDATE estimate_dent_groups SET approved_price=?,approved_by_id=?,approved_by=?,approved_at=?,updated_at=? WHERE id=?")
      .run(g.manual_price, who.id, who.label, stamp(), stamp(), id);
    audit("estimate.dent_package_approved", "estimate_dent_groups", id, null, { price: g.manual_price, calculatedTotal: g.calculated_total, by: who.label });
    return toGroup(groupRow(id));
  }).immediate();
}

// Removing a package removes its line; its dents keep their prices and become not billed.
export function removePackage(id: number) {
  return sqlite.transaction(() => {
    const g = activeGroup(id);
    if (g.line_item_id) deleteEstimateLine(g.line_item_id);
    else markPackageRemoved(g.id);
    audit("estimate.dent_package_removed", "estimate_dent_groups", id, { manualPrice: g.manual_price }, null);
    return { dents: listDents(g.estimate_id) };
  }).immediate();
}
export function markPackageRemoved(groupId: number) {
  sqlite.prepare("UPDATE estimate_dents SET group_id=NULL,line_item_id=NULL,updated_at=? WHERE group_id=?").run(stamp(), groupId);
  sqlite.prepare("UPDATE estimate_dent_groups SET status='removed',line_item_id=NULL,removed_at=?,updated_at=? WHERE id=?").run(stamp(), stamp(), groupId);
}

export const showDentDetails = (estimateId: number) =>
  !!(sqlite.prepare("SELECT show_dent_details s FROM estimate_pricing_options WHERE estimate_id=?").get(estimateId) as any)?.s;

export function registerEstimateDents(app: Express) {
  app.get("/api/estimates/:id/dents", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found", 404);
    res.json(listDents(id));
  });
  app.post("/api/estimates/:id/dents", (req, res) => res.json(createDent(Number(req.params.id), req.body)));
  app.post("/api/estimates/:id/dents/bill", (req, res) => res.json(billIndividually(Number(req.params.id), req.body)));
  app.post("/api/estimates/:id/dents/reprice", (req, res) => res.json(repriceDents(Number(req.params.id))));
  app.patch("/api/estimates/dents/:id", (req, res) => res.json(updateDent(Number(req.params.id), req.body)));
  app.put("/api/estimates/dents/:id/price", (req, res) => res.json(overrideDentPrice(Number(req.params.id), req.body)));
  app.delete("/api/estimates/dents/:id", (req, res) => { deleteDent(Number(req.params.id)); res.json({ success: true }); });

  app.get("/api/estimates/:id/dent-groups", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found", 404);
    res.json(listGroups(id));
  });
  app.post("/api/estimates/:id/dent-groups", (req, res) => res.json(createPackage(Number(req.params.id), req.body)));
  app.patch("/api/estimates/dent-groups/:id", (req, res) => res.json(repricePackage(Number(req.params.id), req.body)));
  app.post("/api/estimates/dent-groups/:id/approve", (req, res) => res.json(approvePackage(Number(req.params.id), req.body)));
  app.delete("/api/estimates/dent-groups/:id", (req, res) => res.json(removePackage(Number(req.params.id))));

  app.get("/api/estimates/:id/pricing-options", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found", 404);
    res.json({ showDentDetails: showDentDetails(id) });
  });
  // Document option only: it never changes the amount billed, so approval is unaffected.
  app.put("/api/estimates/:id/pricing-options", (req, res) => res.json(sqlite.transaction(() => {
    const id = Number(req.params.id);
    editableEstimate(id);
    const body = req.body || {};
    if (Object.keys(body).some(k => k !== "showDentDetails") || typeof body.showDentDetails !== "boolean") fail("Choose whether to show dent details to the customer");
    sqlite.prepare(`INSERT INTO estimate_pricing_options(estimate_id,show_dent_details,updated_at) VALUES(?,?,?)
      ON CONFLICT(estimate_id) DO UPDATE SET show_dent_details=excluded.show_dent_details,updated_at=excluded.updated_at`).run(id, body.showDentDetails ? 1 : 0, stamp());
    return { showDentDetails: showDentDetails(id) };
  }).immediate()));
}
