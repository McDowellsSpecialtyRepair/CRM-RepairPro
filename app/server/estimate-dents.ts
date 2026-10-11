import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { addEstimateLines, editableEstimate, fail } from "./billing";
import {
  DENT_SIZES, DENT_SEVERITIES, LOCATION_DIFFICULTIES, PAINT_CORRECTABLE, DENT_BODY_STYLES,
  DENT_LENGTH_MIN, DENT_LENGTH_MAX, DENT_NOTES_MAX, DENT_SIZE_LABELS,
  dentMatrixCategory, dentNeedsManualPrice, dentLineDescription,
} from "../shared/dents";

// Individual PDR dent records. Money still lives only in estimate_line_items: a dent is either
// unbilled (line_item_id NULL) or counted in exactly one estimate line. Detail fields (length,
// severity, location difficulty, paint, notes) are recorded only and never change a price.
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
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_insert BEFORE INSERT ON estimate_dents
      WHEN EXISTS(SELECT 1 FROM invoices WHERE estimate_id=NEW.estimate_id) OR EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=NEW.estimate_id)
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_update BEFORE UPDATE ON estimate_dents
      WHEN EXISTS(SELECT 1 FROM invoices WHERE estimate_id=OLD.estimate_id) OR EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id)
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_lock_delete BEFORE DELETE ON estimate_dents
      WHEN EXISTS(SELECT 1 FROM invoices WHERE estimate_id=OLD.estimate_id) OR EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id)
      BEGIN SELECT RAISE(ABORT,'Estimate is invoiced or in production; dent records are locked'); END;
    CREATE TRIGGER IF NOT EXISTS estimate_dents_estimate_fixed BEFORE UPDATE OF estimate_id ON estimate_dents
      BEGIN SELECT RAISE(ABORT,'A dent cannot move to another estimate'); END;
  `);
}

const COLUMNS: Record<string, string> = {
  panelId: "panel_id", panelName: "panel_name", bodyStyle: "body_style", size: "size", lengthIn: "length_in",
  severity: "severity", locationDifficulty: "location_difficulty", paintCorrectable: "paint_correctable", notes: "notes",
};
// Fields that decide which estimate line a dent is counted in. Locked once the dent is billed.
const BILLING_FIELDS = ["panelId", "panelName", "bodyStyle", "size"];

const toDent = (r: any) => r && ({
  id: r.id, estimateId: r.estimate_id, panelId: r.panel_id, panelName: r.panel_name, bodyStyle: r.body_style, size: r.size,
  lengthIn: r.length_in, severity: r.severity, locationDifficulty: r.location_difficulty, paintCorrectable: r.paint_correctable,
  notes: r.notes, lineItemId: r.line_item_id, matrixUnitPrice: r.matrix_unit_price, priceSource: r.price_source,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const rawDent = (id: number) => sqlite.prepare("SELECT * FROM estimate_dents WHERE id=?").get(id) as any;
export const listDents = (estimateId: number) =>
  (sqlite.prepare("SELECT * FROM estimate_dents WHERE estimate_id=? ORDER BY id").all(estimateId) as any[]).map(toDent);

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

export function createDent(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    onlyKnownFields(body);
    const count = (sqlite.prepare("SELECT COUNT(*) n FROM estimate_dents WHERE estimate_id=?").get(estimateId) as any).n;
    if (count >= 1000) fail("An estimate can hold up to 1,000 dent records");
    const d = validDent(body), now = new Date().toISOString();
    const info = sqlite.prepare(`INSERT INTO estimate_dents(estimate_id,panel_id,panel_name,body_style,size,length_in,severity,location_difficulty,paint_correctable,notes,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(estimateId, d.panelId, d.panelName, d.bodyStyle, d.size, d.lengthIn, d.severity, d.locationDifficulty, d.paintCorrectable, d.notes, now, now);
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
    if (old.line_item_id && BILLING_FIELDS.some(k => Object.hasOwn(body, k) && body[k] !== (current as any)[k]))
      fail("This dent is already counted in an estimate line. Remove that line first to change its panel or size.", 409);
    const d = validDent({ ...current, ...body });
    // Detail-only edits do not change money, so an approved estimate stays approved (row audit records the change).
    sqlite.prepare(`UPDATE estimate_dents SET panel_id=?,panel_name=?,body_style=?,size=?,length_in=?,severity=?,location_difficulty=?,paint_correctable=?,notes=?,updated_at=? WHERE id=?`)
      .run(d.panelId, d.panelName, d.bodyStyle, d.size, d.lengthIn, d.severity, d.locationDifficulty, d.paintCorrectable, d.notes, new Date().toISOString(), id);
    return toDent(rawDent(id));
  }).immediate();
}

export function deleteDent(id: number) {
  return sqlite.transaction(() => {
    const old = rawDent(id);
    if (!old) fail("Dent not found", 404);
    dentEditableEstimate(old.estimate_id);
    if (old.line_item_id) fail("This dent is counted in an estimate line. Remove that line first, then delete the dent.", 409);
    sqlite.prepare("DELETE FROM estimate_dents WHERE id=?").run(id);
  }).immediate();
}

// The standard PDR matrix price for one dent, chosen the same way the damage map always has
// (first matching row). Creases and glass/plastic panels have no matrix price.
function matrixPrice(d: any): { price: number | null; source: string } {
  if (dentNeedsManualPrice(d.size, d.panel_id))
    return { price: null, source: d.size === "crease" ? "No crease matrix yet: entered price" : "Not a PDR panel: entered price" };
  const cat = dentMatrixCategory(d.body_style);
  const row = sqlite.prepare("SELECT price FROM pricing_matrices WHERE matrix_type='pdr_dent' AND size_category=? AND vehicle_category=? ORDER BY id LIMIT 1").get(d.size, cat) as any;
  return row ? { price: row.price, source: `Standard PDR matrix · ${DENT_SIZE_LABELS[d.size]} · ${cat}` } : { price: null, source: "No matrix row found" };
}

// Adds unbilled dents to the estimate: one line per panel and size (quantity = number of dents),
// exactly as the damage map has always billed them. The dents are linked to their line and keep
// the matrix price they were calculated from, even when the estimator entered a different price.
export function billDents(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    dentEditableEstimate(estimateId);
    const groups = body?.groups;
    if (!Array.isArray(groups) || !groups.length || groups.length > 200) fail("Choose 1 to 200 dent groups to add");
    const seen = new Set<number>();
    const prepared = groups.map((g: any) => {
      if (!g || !Array.isArray(g.dentIds) || !g.dentIds.length) fail("Each group needs at least one dent");
      const dents = g.dentIds.map((id: any) => {
        if (!Number.isInteger(id) || seen.has(id)) fail("Each dent can be added once");
        seen.add(id);
        const d = rawDent(id);
        if (!d || d.estimate_id !== estimateId) fail("Dent not found on this estimate", 404);
        if (d.line_item_id) fail("A dent is already counted in an estimate line. Reload the estimate.", 409);
        return d;
      });
      const first = dents[0];
      if (dents.some((d: any) => d.panel_id !== first.panel_id || d.size !== first.size || d.body_style !== first.body_style))
        fail("Group dents by the same panel and size");
      const matrix = matrixPrice(first);
      const unitPrice = g.unitPrice;
      if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) fail("Enter a valid unit price for each group");
      if (matrix.price === null && g.priceConfirmed !== true) fail(`Enter a price for ${dentLineDescription(first.panel_id, first.panel_name, first.size)}`);
      return { dents, matrix, line: {
        serviceCategory: "pdr_dent", lineType: "labor", repairAction: "repair",
        description: dentLineDescription(first.panel_id, first.panel_name, first.size),
        panelLocation: first.panel_name, damageSize: first.size, damageSeverity: "moderate",
        quantity: dents.length, unit: "each", unitPrice,
      } };
    });
    const created = addEstimateLines(estimateId, prepared.map(p => p.line));
    prepared.forEach((p, i) => {
      for (const d of p.dents)
        sqlite.prepare("UPDATE estimate_dents SET line_item_id=?,matrix_unit_price=?,price_source=?,updated_at=? WHERE id=?")
          .run(created[i].id, p.matrix.price, p.matrix.price !== null && p.matrix.price !== p.line.unitPrice ? `${p.matrix.source} (estimator entered ${p.line.unitPrice.toFixed(2)})` : p.matrix.source, new Date().toISOString(), d.id);
    });
    audit("estimate.dents_billed", "estimates", estimateId, null, { lines: created.map((l: any, i: number) => ({ lineId: l.id, dentIds: prepared[i].dents.map((d: any) => d.id), unitPrice: l.unitPrice, matrixUnitPrice: prepared[i].matrix.price })) });
    return { created: created.length, dents: listDents(estimateId) };
  }).immediate();
}

export function registerEstimateDents(app: Express) {
  app.get("/api/estimates/:id/dents", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found", 404);
    res.json(listDents(id));
  });
  app.post("/api/estimates/:id/dents", (req, res) => res.json(createDent(Number(req.params.id), req.body)));
  app.post("/api/estimates/:id/dents/bill", (req, res) => res.json(billDents(Number(req.params.id), req.body)));
  app.patch("/api/estimates/dents/:id", (req, res) => res.json(updateDent(Number(req.params.id), req.body)));
  app.delete("/api/estimates/dents/:id", (req, res) => { deleteDent(Number(req.params.id)); res.json({ success: true }); });
}
