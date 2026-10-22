import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail, editableEstimate } from "./billing";

// "How did the customer hear about us?" Management keeps the list of choices (marketing sources). Each
// estimate records one choice; a choice marked "asks who referred them" also records the referrer, and
// every referral appears on the referral thank-you list until someone marks it thanked.
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const now = () => new Date().toISOString();

// Starting choices for a new database; management renames, adds or turns them off on the Marketing page.
const STARTING_SOURCES: [string, boolean][] = [
  ["Referral", true], ["Repeat customer", false], ["Radio", false], ["Sign", false], ["Vans / vehicle lettering", false],
  ["Google search", false], ["Website", false], ["Facebook", false], ["Instagram", false], ["Yelp", false],
  ["Nextdoor", false], ["Dealership", false], ["Insurance company", false], ["Walk-in / drive-by", false],
  ["Home show / event", false], ["Other", false],
];

export function migrateMarketing() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS marketing_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 80),
      needs_referrer INTEGER NOT NULL DEFAULT 0 CHECK(needs_referrer IN (0,1)),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS estimate_marketing (
      estimate_id INTEGER PRIMARY KEY REFERENCES estimates(id),
      source_id INTEGER NOT NULL REFERENCES marketing_sources(id),
      referrer_customer_id INTEGER REFERENCES customers(id),
      referrer_name TEXT CHECK(referrer_name IS NULL OR length(referrer_name) <= 120),
      referrer_phone TEXT CHECK(referrer_phone IS NULL OR length(referrer_phone) <= 40),
      referrer_note TEXT CHECK(referrer_note IS NULL OR length(referrer_note) <= 500),
      thank_you_status TEXT NOT NULL DEFAULT 'not_needed' CHECK(thank_you_status IN ('not_needed','to_thank','thanked')),
      thanked_at TEXT, thanked_by TEXT, thanked_note TEXT CHECK(thanked_note IS NULL OR length(thanked_note) <= 500),
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS estimate_marketing_thanks ON estimate_marketing(thank_you_status);
  `);
  if (!one("SELECT id FROM marketing_sources LIMIT 1")) {
    const ins = sqlite.prepare("INSERT INTO marketing_sources(name,needs_referrer,sort_order,created_at,updated_at) VALUES(?,?,?,?,?)");
    STARTING_SOURCES.forEach(([name, ref], i) => ins.run(name, ref ? 1 : 0, (i + 1) * 10, now(), now()));
  }
}

const sourceShape = (r: any) => r && ({ id: r.id, name: r.name, needsReferrer: !!r.needs_referrer, active: !!r.active, sortOrder: r.sort_order });
const customerName = (c: any) => c ? (c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.customerNumber) : null;

export function estimateMarketing(estimateId: number) {
  const r = one("SELECT * FROM estimate_marketing WHERE estimate_id=?", estimateId);
  if (!r) return { estimateId, sourceId: null, source: null, needsReferrer: false, referrer: null };
  const s = one("SELECT * FROM marketing_sources WHERE id=?", r.source_id);
  const rc = r.referrer_customer_id ? storage.getCustomer(r.referrer_customer_id) : null;
  return {
    estimateId, sourceId: r.source_id, source: s?.name ?? null, needsReferrer: !!s?.needs_referrer,
    referrer: s?.needs_referrer ? { customerId: r.referrer_customer_id, name: rc ? customerName(rc) : r.referrer_name, phone: rc ? (rc.phone || rc.mobile || null) : r.referrer_phone, note: r.referrer_note } : null,
    thankYouStatus: r.thank_you_status, thankedAt: r.thanked_at, thankedBy: r.thanked_by,
  };
}

function setEstimateMarketing(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    const est = editableEstimate(estimateId);
    if (!body || typeof body !== "object" || Object.keys(body).some(k => !["sourceId", "referrerCustomerId", "referrerName", "referrerPhone", "referrerNote"].includes(k))) fail("Unexpected fields.");
    const before = estimateMarketing(estimateId);
    if (body.sourceId === null) {
      sqlite.prepare("DELETE FROM estimate_marketing WHERE estimate_id=?").run(estimateId);
      audit("marketing.updated", "estimates", estimateId, before, estimateMarketing(estimateId));
      return estimateMarketing(estimateId);
    }
    const s = one("SELECT * FROM marketing_sources WHERE id=?", body.sourceId);
    if (!s || (!s.active && s.id !== before.sourceId)) fail("Choose how the customer heard about us from the list.");
    let refCustomer: number | null = null, refName: string | null = null, refPhone: string | null = null, refNote: string | null = null;
    if (s.needs_referrer) {
      const text = (v: any, max: number) => v == null ? null : String(v).trim().slice(0, max) || null;
      refNote = text(body.referrerNote, 500);
      if (body.referrerCustomerId != null) {
        if (!Number.isSafeInteger(body.referrerCustomerId) || !storage.getCustomer(body.referrerCustomerId)) fail("Choose the referring customer again; that customer was not found.");
        if (body.referrerCustomerId === est.customerId) fail("A customer cannot refer themselves. Choose the person who referred them.");
        refCustomer = body.referrerCustomerId;
      } else {
        refName = text(body.referrerName, 120); refPhone = text(body.referrerPhone, 40);
        if (!refName) fail("Enter who referred this customer (choose a customer or type their name).");
      }
    }
    // A referral goes on the thank-you list. Changing who referred them puts it back on the list.
    const sameReferrer = before.referrer && before.sourceId === s.id && (before.referrer.customerId ?? null) === refCustomer &&
      (refCustomer || (before.referrer.name === refName));
    const status = !s.needs_referrer ? "not_needed" : sameReferrer && before.thankYouStatus ? before.thankYouStatus : "to_thank";
    const keepThanks = status === "thanked";
    sqlite.prepare(`INSERT INTO estimate_marketing(estimate_id,source_id,referrer_customer_id,referrer_name,referrer_phone,referrer_note,thank_you_status,thanked_at,thanked_by,thanked_note,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(estimate_id) DO UPDATE SET source_id=excluded.source_id,referrer_customer_id=excluded.referrer_customer_id,
      referrer_name=excluded.referrer_name,referrer_phone=excluded.referrer_phone,referrer_note=excluded.referrer_note,thank_you_status=excluded.thank_you_status,
      thanked_at=CASE WHEN ? THEN estimate_marketing.thanked_at ELSE NULL END,thanked_by=CASE WHEN ? THEN estimate_marketing.thanked_by ELSE NULL END,
      thanked_note=CASE WHEN ? THEN estimate_marketing.thanked_note ELSE NULL END,updated_at=excluded.updated_at`)
      .run(estimateId, s.id, refCustomer, refName, refPhone, refNote, status, null, null, null, now(), keepThanks ? 1 : 0, keepThanks ? 1 : 0, keepThanks ? 1 : 0);
    // The customer's record keeps the first known source; it is filled in only when it is empty.
    const cust = storage.getCustomer(est.customerId);
    if (cust && !cust.referralSource) storage.updateCustomer(cust.id, { referralSource: s.name });
    const after = estimateMarketing(estimateId);
    audit("marketing.updated", "estimates", estimateId, before, after);
    return after;
  }).immediate();
}

function referrals(status?: string) {
  const rows = all(`SELECT m.*, e.estimate_number, e.customer_id, e.created_at AS estimate_created, s.name AS source FROM estimate_marketing m
    JOIN estimates e ON e.id=m.estimate_id JOIN marketing_sources s ON s.id=m.source_id
    WHERE m.thank_you_status IN ('to_thank','thanked') ${status ? "AND m.thank_you_status=?" : ""} ORDER BY m.thank_you_status='thanked', m.updated_at DESC`, ...(status ? [status] : []));
  return rows.map(r => {
    const rc = r.referrer_customer_id ? storage.getCustomer(r.referrer_customer_id) : null, c = storage.getCustomer(r.customer_id);
    return { estimateId: r.estimate_id, estimateNumber: r.estimate_number, estimateDate: String(r.estimate_created || "").slice(0, 10),
      referredCustomerId: r.customer_id, referredCustomer: customerName(c), source: r.source,
      referrerCustomerId: r.referrer_customer_id, referrerName: rc ? customerName(rc) : r.referrer_name,
      referrerPhone: rc ? (rc.phone || rc.mobile || null) : r.referrer_phone, referrerEmail: rc?.email || null,
      referrerAddress: rc ? [rc.address, rc.city, rc.state, rc.zip].filter(Boolean).join(", ") || null : null,
      note: r.referrer_note, status: r.thank_you_status, thankedAt: r.thanked_at, thankedBy: r.thanked_by, thankedNote: r.thanked_note };
  });
}

function validatedSource(b: any, existing?: any) {
  const name = String(b.name ?? existing?.name ?? "").trim();
  if (!name || name.length > 80) fail("Enter a name of up to 80 characters.");
  const needs = b.needsReferrer === undefined ? !!existing?.needs_referrer : b.needsReferrer === true;
  const active = b.active === undefined ? (existing ? !!existing.active : true) : b.active === true;
  const sort = b.sortOrder === undefined ? (existing?.sort_order ?? ((one("SELECT max(sort_order) m FROM marketing_sources")?.m || 0) + 10)) : Number(b.sortOrder);
  if (!Number.isInteger(sort) || sort < 0 || sort > 100000) fail("Enter a whole-number position.");
  return { name, needs: needs ? 1 : 0, active: active ? 1 : 0, sort };
}

export function registerMarketing(app: Express) {
  app.get("/api/marketing-sources", (_req, res) => res.json(all("SELECT * FROM marketing_sources ORDER BY active DESC, sort_order, name").map(sourceShape)));
  app.post("/api/marketing-sources", (req, res) => {
    const v = validatedSource(req.body || {});
    if (one("SELECT id FROM marketing_sources WHERE name=?", v.name)) fail("That choice is already on the list.", 409);
    const id = Number(sqlite.prepare("INSERT INTO marketing_sources(name,needs_referrer,active,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(v.name, v.needs, v.active, v.sort, now(), now()).lastInsertRowid);
    const after = sourceShape(one("SELECT * FROM marketing_sources WHERE id=?", id));
    audit("marketing_source.created", "marketing_sources", id, null, after);
    res.status(201).json(after);
  });
  app.patch("/api/marketing-sources/:id", (req, res) => {
    const id = Number(req.params.id), existing = one("SELECT * FROM marketing_sources WHERE id=?", id);
    if (!existing) fail("Choice not found.", 404);
    const v = validatedSource(req.body || {}, existing);
    if (one("SELECT id FROM marketing_sources WHERE name=? AND id<>?", v.name, id)) fail("That choice is already on the list.", 409);
    sqlite.prepare("UPDATE marketing_sources SET name=?,needs_referrer=?,active=?,sort_order=?,updated_at=? WHERE id=?").run(v.name, v.needs, v.active, v.sort, now(), id);
    const after = sourceShape(one("SELECT * FROM marketing_sources WHERE id=?", id));
    audit("marketing_source.updated", "marketing_sources", id, sourceShape(existing), after);
    res.json(after);
  });
  app.get("/api/estimates/:id/marketing", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found.", 404);
    res.json(estimateMarketing(id));
  });
  app.put("/api/estimates/:id/marketing", (req, res) => res.json(setEstimateMarketing(Number(req.params.id), req.body)));
  app.get("/api/referrals", (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !["to_thank", "thanked"].includes(status)) fail("Unknown list.");
    res.json(referrals(status));
  });
  app.patch("/api/referrals/:estimateId", (req, res) => {
    const id = Number(req.params.estimateId), b = req.body || {};
    if (Object.keys(b).some(k => !["thanked", "note"].includes(k)) || typeof b.thanked !== "boolean") fail("Unexpected fields.");
    const before = one("SELECT * FROM estimate_marketing WHERE estimate_id=? AND thank_you_status IN ('to_thank','thanked')", id);
    if (!before) fail("That referral is not on the thank-you list.", 404);
    const note = b.note == null ? null : String(b.note).trim().slice(0, 500) || null;
    if (b.thanked) sqlite.prepare("UPDATE estimate_marketing SET thank_you_status='thanked',thanked_at=?,thanked_by=?,thanked_note=? WHERE estimate_id=?").run(now(), res.locals.staff?.full_name || null, note, id);
    else sqlite.prepare("UPDATE estimate_marketing SET thank_you_status='to_thank',thanked_at=NULL,thanked_by=NULL,thanked_note=NULL WHERE estimate_id=?").run(id);
    audit(b.thanked ? "referral.thanked" : "referral.reopened", "estimates", id, { status: before.thank_you_status }, { status: b.thanked ? "thanked" : "to_thank", note });
    res.json(referrals().find(r => r.estimateId === id));
  });
}
