import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { audit } from "./security";
import { fail, editableEstimate } from "./billing";

// Marketing tags: "How did the customer hear about us?" and more. Management keeps the list of tags, each in
// one of four groups. An estimate can carry several tags (as in RoadFS), for example Radio + Lobby - In Person
// + New Customer. A tag marked "asks who referred them" also records the referrer, and every referral appears
// on the referral thank-you list until someone marks it thanked.
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const all = (sql: string, ...p: any[]) => sqlite.prepare(sql).all(...p) as any[];
const now = () => new Date().toISOString();

export const TAG_GROUPS = ["How they found us", "Referred by", "How the estimate came in", "Customer"] as const;
// Starting tags: the owner's RoadFS tags (screenshots 2026-10-23) plus Referral, Vans, Phone call and Email.
const STARTING_TAGS: [string, (typeof TAG_GROUPS)[number], boolean][] = [
  ["Radio", "How they found us", false], ["Building Sign", "How they found us", false], ["Vans / vehicle lettering", "How they found us", false],
  ["Search Engine", "How they found us", false], ["Social Media", "How they found us", false], ["Email Campaign", "How they found us", false],
  ["Mail Campaign", "How they found us", false], ["Text Campaign", "How they found us", false], ["HAIL", "How they found us", false],
  ["Referral", "Referred by", true], ["Referral Program", "Referred by", true], ["Bodyshop Referral", "Referred by", true],
  ["Dealer Referral", "Referred by", true], ["Furniture Store Referral", "Referred by", true], ["Insurance Referral", "Referred by", true],
  ["Paul", "Referred by", false], ["Stacy", "Referred by", false],
  ["Lobby - In Person", "How the estimate came in", false], ["Lobby - Lead", "How the estimate came in", false], ["Phone call", "How the estimate came in", false],
  ["Email", "How the estimate came in", false], ["Web Form", "How the estimate came in", false], ["Online Scheduling", "How the estimate came in", false],
  ["New Customer", "Customer", false], ["Repeat Customer", "Customer", false], ["2nd Work Order", "Customer", false], ["Callback Sale", "Customer", false],
];
const TAGS_V2 = "marketing-tags-v2";

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
    CREATE TABLE IF NOT EXISTS estimate_marketing_tags (
      estimate_id INTEGER NOT NULL REFERENCES estimates(id),
      source_id INTEGER NOT NULL REFERENCES marketing_sources(id),
      PRIMARY KEY (estimate_id, source_id)
    );
  `);
  if (!all("PRAGMA table_info(marketing_sources)").some(c => c.name === "tag_group"))
    sqlite.exec("ALTER TABLE marketing_sources ADD COLUMN tag_group TEXT NOT NULL DEFAULT 'How they found us'");
  sqlite.exec("CREATE TABLE IF NOT EXISTS app_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  if (one("SELECT 1 FROM app_migrations WHERE version=?", TAGS_V2)) return;
  sqlite.transaction(() => {
    // One-time: the single answer each estimate had becomes its first tag.
    sqlite.exec("INSERT OR IGNORE INTO estimate_marketing_tags(estimate_id,source_id) SELECT estimate_id,source_id FROM estimate_marketing");
    const fresh = !one("SELECT id FROM marketing_sources LIMIT 1");
    const ins = sqlite.prepare("INSERT INTO marketing_sources(name,needs_referrer,tag_group,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?)");
    const names = new Set(STARTING_TAGS.map(t => t[0].toLowerCase()));
    STARTING_TAGS.forEach(([name, group, ref], i) => {
      const found = one("SELECT id FROM marketing_sources WHERE name=?", name);
      if (found) sqlite.prepare("UPDATE marketing_sources SET tag_group=?,needs_referrer=?,sort_order=?,updated_at=? WHERE id=?").run(group, ref ? 1 : 0, (i + 1) * 10, now(), found.id);
      else ins.run(name, ref ? 1 : 0, group, (i + 1) * 10, now(), now());
    });
    // The first, made-up starting list is turned off where unused (kept on any estimate that already uses it).
    if (!fresh) for (const r of all("SELECT id,name FROM marketing_sources")) {
      if (names.has(String(r.name).toLowerCase()) || String(r.name).toLowerCase() === "other") continue;
      if (!one("SELECT 1 FROM estimate_marketing_tags WHERE source_id=?", r.id)) sqlite.prepare("UPDATE marketing_sources SET active=0,updated_at=? WHERE id=?").run(now(), r.id);
    }
    sqlite.prepare("INSERT INTO app_migrations(version,applied_at) VALUES(?,?)").run(TAGS_V2, now());
  })();
}

const sourceShape = (r: any) => r && ({ id: r.id, name: r.name, group: r.tag_group, needsReferrer: !!r.needs_referrer, active: !!r.active, sortOrder: r.sort_order });
const customerName = (c: any) => c ? (c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.customerNumber) : null;
const tagsOf = (estimateId: number) => all(`SELECT s.* FROM estimate_marketing_tags t JOIN marketing_sources s ON s.id=t.source_id
  WHERE t.estimate_id=? ORDER BY CASE s.tag_group WHEN 'How they found us' THEN 1 WHEN 'Referred by' THEN 2 WHEN 'How the estimate came in' THEN 3 ELSE 4 END, s.sort_order, s.name`, estimateId);

export function estimateMarketing(estimateId: number) {
  const tags = tagsOf(estimateId), r = one("SELECT * FROM estimate_marketing WHERE estimate_id=?", estimateId);
  const needsReferrer = tags.some(t => t.needs_referrer);
  const rc = r?.referrer_customer_id ? storage.getCustomer(r.referrer_customer_id) : null;
  return {
    estimateId, tags: tags.map(sourceShape), source: tags.map(t => t.name).join(", ") || null, needsReferrer,
    referrer: needsReferrer && r ? { customerId: r.referrer_customer_id, name: rc ? customerName(rc) : r.referrer_name, phone: rc ? (rc.phone || rc.mobile || null) : r.referrer_phone, note: r.referrer_note } : null,
    thankYouStatus: r?.thank_you_status ?? null, thankedAt: r?.thanked_at ?? null, thankedBy: r?.thanked_by ?? null,
  };
}

function setEstimateMarketing(estimateId: number, body: any) {
  return sqlite.transaction(() => {
    const est = editableEstimate(estimateId);
    if (!body || typeof body !== "object" || Object.keys(body).some(k => !["sourceIds", "sourceId", "referrerCustomerId", "referrerName", "referrerPhone", "referrerNote"].includes(k))) fail("Unexpected fields.");
    const before = estimateMarketing(estimateId);
    const ids: number[] = Array.isArray(body.sourceIds) ? body.sourceIds : body.sourceId == null ? [] : [body.sourceId];
    if (ids.length > 20 || ids.some(x => !Number.isSafeInteger(x))) fail("Choose up to 20 tags from the list.");
    const had = new Set(before.tags.map((t: any) => t.id));
    const chosen = Array.from(new Set(ids)).map(id => {
      const s = one("SELECT * FROM marketing_sources WHERE id=?", id);
      if (!s || (!s.active && !had.has(s.id))) fail("Choose tags from the list (a tag that has been turned off can't be added).");
      return s;
    });
    sqlite.prepare("DELETE FROM estimate_marketing_tags WHERE estimate_id=?").run(estimateId);
    if (!chosen.length) {
      sqlite.prepare("DELETE FROM estimate_marketing WHERE estimate_id=?").run(estimateId);
      const after = estimateMarketing(estimateId);
      audit("marketing.updated", "estimates", estimateId, pick(before), pick(after));
      return after;
    }
    for (const s of chosen) sqlite.prepare("INSERT INTO estimate_marketing_tags(estimate_id,source_id) VALUES(?,?)").run(estimateId, s.id);
    const referral = chosen.find(s => s.needs_referrer);
    let refCustomer: number | null = null, refName: string | null = null, refPhone: string | null = null, refNote: string | null = null;
    if (referral) {
      const text = (v: any, max: number) => v == null ? null : String(v).trim().slice(0, max) || null;
      refNote = text(body.referrerNote, 500);
      if (body.referrerCustomerId != null) {
        if (!Number.isSafeInteger(body.referrerCustomerId) || !storage.getCustomer(body.referrerCustomerId)) fail("Choose the referring customer again; that customer was not found.");
        if (body.referrerCustomerId === est.customerId) fail("A customer cannot refer themselves. Choose the person who referred them.");
        refCustomer = body.referrerCustomerId;
      } else {
        refName = text(body.referrerName, 120); refPhone = text(body.referrerPhone, 40);
        if (!refName) fail(`Enter who referred this customer for "${referral.name}" (choose a customer or type their name).`);
      }
    }
    // A referral goes on the thank-you list. Changing who referred them puts it back on the list.
    const sameReferrer = !!before.referrer && (before.referrer.customerId ?? null) === refCustomer && (refCustomer != null || before.referrer.name === refName);
    const status = !referral ? "not_needed" : sameReferrer && before.thankYouStatus && before.thankYouStatus !== "not_needed" ? before.thankYouStatus : "to_thank";
    const keepThanks = status === "thanked" ? 1 : 0;
    // source_id keeps the main tag (the referral tag when there is one) for older reports.
    sqlite.prepare(`INSERT INTO estimate_marketing(estimate_id,source_id,referrer_customer_id,referrer_name,referrer_phone,referrer_note,thank_you_status,thanked_at,thanked_by,thanked_note,updated_at)
      VALUES(?,?,?,?,?,?,?,NULL,NULL,NULL,?) ON CONFLICT(estimate_id) DO UPDATE SET source_id=excluded.source_id,referrer_customer_id=excluded.referrer_customer_id,
      referrer_name=excluded.referrer_name,referrer_phone=excluded.referrer_phone,referrer_note=excluded.referrer_note,thank_you_status=excluded.thank_you_status,
      thanked_at=CASE WHEN ? THEN estimate_marketing.thanked_at ELSE NULL END,thanked_by=CASE WHEN ? THEN estimate_marketing.thanked_by ELSE NULL END,
      thanked_note=CASE WHEN ? THEN estimate_marketing.thanked_note ELSE NULL END,updated_at=excluded.updated_at`)
      .run(estimateId, (referral || chosen[0]).id, refCustomer, refName, refPhone, refNote, status, now(), keepThanks, keepThanks, keepThanks);
    // The customer's record keeps the first known source ("how they found us" tag first); filled in only when empty.
    const cust = storage.getCustomer(est.customerId);
    const main = chosen.find(s => s.tag_group === "How they found us") || referral || chosen[0];
    if (cust && !cust.referralSource) storage.updateCustomer(cust.id, { referralSource: main.name });
    const after = estimateMarketing(estimateId);
    audit("marketing.updated", "estimates", estimateId, pick(before), pick(after));
    return after;
  }).immediate();
}
// What the change history shows: the tag names, who referred them and the thank-you state.
const pick = (m: any) => ({ tags: m.tags.map((t: any) => t.name), referrer: m.referrer, thankYouStatus: m.thankYouStatus });

function referrals(status?: string) {
  const rows = all(`SELECT m.*, e.estimate_number, e.customer_id, e.created_at AS estimate_created,
      (SELECT group_concat(s.name, ', ') FROM estimate_marketing_tags t JOIN marketing_sources s ON s.id=t.source_id WHERE t.estimate_id=m.estimate_id AND s.needs_referrer=1) AS source
    FROM estimate_marketing m JOIN estimates e ON e.id=m.estimate_id
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
  const group = b.group ?? existing?.tag_group ?? TAG_GROUPS[0];
  if (!TAG_GROUPS.includes(group)) fail(`Choose a group: ${TAG_GROUPS.join(", ")}.`);
  const active = b.active === undefined ? (existing ? !!existing.active : true) : b.active === true;
  const sort = b.sortOrder === undefined ? (existing?.sort_order ?? ((one("SELECT max(sort_order) m FROM marketing_sources")?.m || 0) + 10)) : Number(b.sortOrder);
  if (!Number.isInteger(sort) || sort < 0 || sort > 100000) fail("Enter a whole-number position.");
  return { name, needs: needs ? 1 : 0, active: active ? 1 : 0, sort, group };
}

export function registerMarketing(app: Express) {
  app.get("/api/marketing-sources", (_req, res) => res.json(all("SELECT * FROM marketing_sources ORDER BY active DESC, CASE tag_group WHEN 'How they found us' THEN 1 WHEN 'Referred by' THEN 2 WHEN 'How the estimate came in' THEN 3 ELSE 4 END, sort_order, name").map(sourceShape)));
  app.post("/api/marketing-sources", (req, res) => {
    const v = validatedSource(req.body || {});
    if (one("SELECT id FROM marketing_sources WHERE name=?", v.name)) fail("That choice is already on the list.", 409);
    const id = Number(sqlite.prepare("INSERT INTO marketing_sources(name,needs_referrer,active,sort_order,tag_group,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(v.name, v.needs, v.active, v.sort, v.group, now(), now()).lastInsertRowid);
    const after = sourceShape(one("SELECT * FROM marketing_sources WHERE id=?", id));
    audit("marketing_source.created", "marketing_sources", id, null, after);
    res.status(201).json(after);
  });
  app.patch("/api/marketing-sources/:id", (req, res) => {
    const id = Number(req.params.id), existing = one("SELECT * FROM marketing_sources WHERE id=?", id);
    if (!existing) fail("Choice not found.", 404);
    const v = validatedSource(req.body || {}, existing);
    if (one("SELECT id FROM marketing_sources WHERE name=? AND id<>?", v.name, id)) fail("That choice is already on the list.", 409);
    sqlite.prepare("UPDATE marketing_sources SET name=?,needs_referrer=?,active=?,sort_order=?,tag_group=?,updated_at=? WHERE id=?").run(v.name, v.needs, v.active, v.sort, v.group, now(), id);
    const after = sourceShape(one("SELECT * FROM marketing_sources WHERE id=?", id));
    audit("marketing_source.updated", "marketing_sources", id, sourceShape(existing), after);
    res.json(after);
  });
  app.get("/api/estimates/:id/marketing", (req, res) => {
    const id = Number(req.params.id);
    if (!storage.getEstimate(id)) fail("Estimate not found.", 404);
    res.json({ ...estimateMarketing(id), groups: TAG_GROUPS });
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
