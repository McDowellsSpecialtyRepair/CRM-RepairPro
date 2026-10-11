import type { Express, Request, Response } from "express";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { sqlite } from "./storage-db";
import { securityContext, actorLabel } from "./security-context";
import { ROLES, routePermission, hasPermission, type Role, type StaffUser } from "../shared/security";
const HOUR = 3600000, IDLE = 30 * 60000;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");
const now = () => new Date().toISOString();
const rows = (sql: string, ...args: any[]) => sqlite.prepare(sql).all(...args) as any[];
const row = (sql: string, ...args: any[]) => sqlite.prepare(sql).get(...args) as any;
const exec = (sql: string, ...args: any[]) => sqlite.prepare(sql).run(...args);
function error(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
function fields(body: any, allowed: string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) error("Unexpected request fields.");
}
function emailValue(v: unknown) { const s = String(v || "").trim().toLowerCase(); if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) error("Enter a valid email address."); return s; }
function textValue(v: unknown, label: string, max = 100) { if (typeof v !== "string" || !v.trim() || v.length > max) error(`${label} is required (maximum ${max} characters).`); return v.trim(); }
const safeUser = (u: any): StaffUser => ({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, status: u.status, technicianId: u.technician_id, permissions: [...ROLES[u.role as Role].permissions] });
export function audit(event: string, entity = "", recordId: string | number = "", before: any = null, after: any = null) {
  const ctx = securityContext.getStore();
  exec("INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ctx?.userId || null, actorLabel(), event, entity, String(recordId), before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), ctx?.requestId || "system", now());
}
// Register before startup migrations so prior-version audit triggers remain usable.
sqlite.function("staff_actor_id", () => securityContext.getStore()?.userId || null);
sqlite.function("staff_actor_label", () => actorLabel());
sqlite.function("staff_request_id", () => securityContext.getStore()?.requestId || "system");

export function initializeSecurity() {
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS staff_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        full_name TEXT NOT NULL, password_hash TEXT, role TEXT NOT NULL CHECK(role IN ('owner','admin','manager','advisor','technician','support','accountant','auditor')),
        status TEXT NOT NULL CHECK(status IN ('invited','active','disabled')), technician_id INTEGER UNIQUE REFERENCES technicians(id),
        version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT,
        CHECK(role != 'technician' OR technician_id IS NOT NULL)
      );
      CREATE TABLE IF NOT EXISTS staff_sessions (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES staff_accounts(id),
        created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        user_agent TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS staff_sessions_user ON staff_sessions(user_id);
      CREATE TABLE IF NOT EXISTS staff_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES staff_accounts(id),
        token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used_at INTEGER, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS staff_rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS security_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES staff_accounts(id),
        actor_label TEXT NOT NULL, event TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL,
        before_json TEXT, after_json TEXT, request_id TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS security_audit_actor_date ON security_audit(actor_id,occurred_at);
      CREATE TRIGGER IF NOT EXISTS security_audit_no_update BEFORE UPDATE ON security_audit BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS security_audit_no_delete BEFORE DELETE ON security_audit BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END;
    `);
    if (!rows("PRAGMA table_info(jobs)").some(c => c.name === "assigned_tech_id")) {
      sqlite.exec("ALTER TABLE jobs ADD COLUMN assigned_tech_id INTEGER REFERENCES technicians(id)");
    }
    exec(`UPDATE jobs SET assigned_tech_id=(SELECT MIN(id) FROM technicians WHERE name=jobs.assigned_tech)
      WHERE assigned_tech_id IS NULL AND (SELECT COUNT(*) FROM technicians WHERE name=jobs.assigned_tech)=1`);
    // Row triggers make before/after auditing atomic with the write. Never audit credentials.
    const tables = ["customers","contacts","vehicles","assets","jobs","estimates","estimate_line_items","invoices","invoice_line_items","payments","campaigns","activities","technicians","schedule_slots","bookings","service_history","coi_certificates","third_party_payers","fleet_accounts","fleet_authorized_contacts","warranty_claims","asset_details","tax_jurisdictions","report_definitions"];
    tables.push("estimate_labor_allocations","invoice_labor_credits","document_deliveries","estimate_dents");
    tables.push(...rows("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ops_%'").map(t=>t.name));
    for (const table of tables) {
      const cols = rows(`PRAGMA table_info("${table}")`).map(c => c.name);
      if (!cols.length) continue;
      const json = (alias: string) => `json_object(${cols.flatMap(c => [`'${c}'`, `${alias}."${c}"`]).join(",")})`;
      for (const op of ["INSERT","UPDATE","DELETE"]) {
        if(["estimate_line_items","invoice_line_items"].includes(table))
          sqlite.exec(`DROP TRIGGER IF EXISTS staff_audit_${table}_${op.toLowerCase()}`);
        sqlite.exec(`CREATE TRIGGER IF NOT EXISTS staff_audit_${table}_${op.toLowerCase()} AFTER ${op} ON "${table}"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.${op.toLowerCase()}','${table}',${op === "DELETE" ? "OLD" : "NEW"}.id,
          ${op === "INSERT" ? "NULL" : json("OLD")},${op === "DELETE" ? "NULL" : json("NEW")},staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`);
      }
    }
  })();
}
function checkTech(role: Role, tech: any) {
  if (role === "technician" && (!Number.isInteger(tech) || !row("SELECT id FROM technicians WHERE id=? AND status='active'", tech))) error("Choose an active technician profile for this account.");
  return role === "technician" ? tech : null;
}
function invite(userId: number) {
  const code = opaque(), expiry = Date.now() + 24 * HOUR;
  exec("UPDATE staff_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL", Date.now(), userId);
  exec("INSERT INTO staff_invitations(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)", userId, tokenHash(code), expiry, now());
  return { activationCode: code, expiresAt: new Date(expiry).toISOString() };
}
export function bootstrapOwner(email: string) {
  initializeSecurity();
  return sqlite.transaction(() => {
    if (row("SELECT COUNT(*) AS n FROM staff_accounts").n) error("An owner has already been provisioned. Use an existing owner or the documented offline recovery procedure.");
    const info = exec("INSERT INTO staff_accounts(email,full_name,role,status,created_at,updated_at) VALUES(?,'Owner','owner','invited',?,?)", emailValue(email), now(), now());
    const id = Number(info.lastInsertRowid), invitation = invite(id);
    audit("staff.bootstrap", "staff_accounts", id, null, { email: emailValue(email), role: "owner", status: "invited" });
    return { email: emailValue(email), ...invitation };
  })();
}
let hashing = 0;
async function derive(password: string, salt: string) {
  if (hashing >= 8) error("Sign-in service is busy. Please retry shortly.", 429);
  hashing++;
  try { return await new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key))); }
  finally { hashing--; }
}
function passwordValue(p: unknown, email: string) {
  if (typeof p !== "string") error("Enter a password.");
  const normalized = p.normalize("NFC");
  if (Array.from(normalized).length < 15 || Array.from(normalized).length > 128) error("Use a password or passphrase of 15–128 characters.");
  const weak = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^(.)\1+$/.test(weak) || /password|123456|qwerty|letmein|repairpro|mcdowell/.test(weak) || weak === email.split("@")[0]) error("Choose a less predictable passphrase without common passwords or the company name.");
  return normalized;
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
async function passwordMatches(password: unknown, hash: string | null) {
  const valid = typeof password === "string" && Array.from(password).length <= 128;
  const pieces = hash?.split("$"), supported = pieces?.length === 4 && pieces[0] === "scrypt" && pieces[1] === "32768";
  const salt = supported ? pieces![2] : "00000000000000000000000000000000";
  const actual = await derive(valid ? (password as string).normalize("NFC") : "", salt);
  const expected = supported ? Buffer.from(pieces![3], "hex") : Buffer.alloc(64);
  return valid && !!supported && expected.length === actual.length && timingSafeEqual(actual, expected);
}
// Structured (JSON) keys: an email containing ":" or an address cannot collide with another key.
const rateKey = (...parts: unknown[]) => tokenHash(JSON.stringify(["rate-limit", ...parts]));
function rateCheck(key: string, limit: number) {
  const r = row("SELECT * FROM staff_rate_limits WHERE key=?", key);
  if (r && Date.now() - r.window_start < 15 * 60000 && r.failures >= limit) error("Too many unsuccessful attempts. Try again in 15 minutes.", 429);
}
function failedRate(key: string) {
  exec(`INSERT INTO staff_rate_limits(key,window_start,failures) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN ?-window_start>=900000 THEN 1 ELSE failures+1 END,
    window_start=CASE WHEN ?-window_start>=900000 THEN ? ELSE window_start END`, key, Date.now(), Date.now(), Date.now(), Date.now());
}
function sessionFor(u: any, agent: string) {
  const token = opaque(), time = Date.now();
  exec("DELETE FROM staff_sessions WHERE expires_at<? OR last_seen<?", time, time - IDLE);
  const old = rows("SELECT id FROM staff_sessions WHERE user_id=? ORDER BY created_at DESC", u.id);
  for (const s of old.slice(4)) exec("DELETE FROM staff_sessions WHERE id=?", s.id);
  exec("INSERT INTO staff_sessions(id,token_hash,user_id,created_at,last_seen,expires_at,user_agent) VALUES(?,?,?,?,?,?,?)", randomUUID(), tokenHash(token), u.id, time, time, time + 8 * HOUR, agent.slice(0, 250));
  exec("UPDATE staff_accounts SET last_login_at=? WHERE id=?", now(), u.id);
  return { token, user: safeUser(u), expiresAt: new Date(time + 8 * HOUR).toISOString(), idleMinutes: 30 };
}
// Unauthenticated requests are not written to the audit table one by one (that let anyone grow
// the database). Requests without a session token get UNAUTHENTICATED_LIMIT rejections per client
// address per fixed window; beyond that they receive 429, and one audit event is recorded per
// address per window. Requests that carry a (stale) token always get 401 so the app returns to
// sign-in. Memory is bounded: the table is cleared each window and holds at most MAX addresses.
const UNAUTHENTICATED_LIMIT = 120, UNAUTHENTICATED_WINDOW = 15 * 60000, UNAUTHENTICATED_MAX_ADDRESSES = 50000;
const unauthenticated = new Map<string, { count: number; logged: boolean }>();
let unauthenticatedWindow = Date.now();
function unauthenticatedThrottled(req: Request) {
  const time = Date.now(), key = req.ip || "unknown";
  if (time - unauthenticatedWindow >= UNAUTHENTICATED_WINDOW) { unauthenticated.clear(); unauthenticatedWindow = time; }
  let entry = unauthenticated.get(key);
  if (!entry) {
    if (unauthenticated.size >= UNAUTHENTICATED_MAX_ADDRESSES) return false;
    unauthenticated.set(key, entry = { count: 0, logged: false });
  }
  if (++entry.count <= UNAUTHENTICATED_LIMIT) return false;
  if (!entry.logged) { entry.logged = true; audit("access.unauthenticated_throttled", "route", req.path, null, { method: req.method, network: tokenHash(`network:${key}`).slice(0, 16) }); }
  return true;
}
function deny(req: Request, res: Response, status: number, message: string, throttle = false) {
  if (status === 401) {
    if (throttle && unauthenticatedThrottled(req)) return res.status(429).json({ error: "Too many requests. Try again later." });
  } else audit("access.denied", "route", req.path, null, { method: req.method });
  return res.status(status).json({ error: message });
}
// Support users need contact/operational information, not typed financial fields.
function redactFinancial(value: any): any {
  if (Array.isArray(value)) return value.map(redactFinancial);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => !/(price|amount|subtotal|total|balance|credit|cost|discount|budget|rate|revenue|value)/i.test(k) && !["activities","thirdPartyPayers","fleetAccounts"].includes(k)).map(([k, v]) => [k, redactFinancial(v)]));
  return value;
}
// Purchase costs, use tax and cost notes are hidden from roles without costs.read. Any key that
// looks like one is removed (so new cost fields are hidden by default); only the keys listed in
// VISIBLE_COST_KEYS are known not to be purchase costs and stay visible.
const PURCHASE_COST_KEY = /cost|use_?tax|tax_?note/i;
const VISIBLE_COST_KEYS = new Set([
  "cost",                         // service_history.cost: the customer's charge for the visit
  "costComplete", "cost_complete" // yes/no flag that cost review is finished, not an amount
  // Warranty claim costs (claimCost) are internal costs: hidden like other purchase costs.
]);
export const isPurchaseCostKey = (key: string) => PURCHASE_COST_KEY.test(key) && !VISIBLE_COST_KEYS.has(key);
function redactPurchaseCosts(value:any):any{
  if(Array.isArray(value))return value.map(redactPurchaseCosts);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([k])=>!isPurchaseCostKey(k)).map(([k,v])=>[k,redactPurchaseCosts(v)]));
  return value;
}
export function assignmentPatch(body: any) {
  const copy = { ...body }; delete copy.assignedTechId;
  if (Object.hasOwn(body, "assignedTech")) {
    if (!body.assignedTech) { copy.assignedTech = null; copy.assignedTechId = null; }
    else {
      const matches = rows("SELECT id,name FROM technicians WHERE name=? AND status='active'", body.assignedTech);
      if (matches.length !== 1) error("Choose one uniquely named active technician.");
      copy.assignedTechId = matches[0].id;
    }
  }
  return copy;
}
// Security tables and audit triggers are created by runMigrations() (server/migrations.ts).
export function registerSecurity(app: Express) {
  app.use((req, res, next) => {
    if (!/^\/(?:api|print)(?:\/|$)/i.test(req.path)) return next();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    return securityContext.run({ requestId: randomUUID() }, () => {
      if (req.method === "GET" && req.path === "/api/auth/status" || req.method === "POST" && ["/api/auth/login","/api/auth/activate"].includes(req.path)) return next();
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      const s = token ? row("SELECT s.*,u.status,u.role,u.full_name,u.email,u.technician_id,u.version,u.id AS account_id FROM staff_sessions s JOIN staff_accounts u ON u.id=s.user_id WHERE token_hash=?", tokenHash(token)) : null;
      if (!s || s.status !== "active" || s.expires_at <= Date.now() || s.last_seen <= Date.now() - IDLE) {
        if (s) { exec("DELETE FROM staff_sessions WHERE id=?", s.id); audit("session.expired", "staff_accounts", s.account_id); }
        return deny(req, res, 401, "Sign in to continue.", !token);
      }
      const ctx = securityContext.getStore()!; ctx.userId = s.account_id; ctx.label = s.full_name;
      res.locals.staff = { ...s, id: s.account_id }; res.locals.sessionId = s.id;
      if(!hasPermission(s.role,"costs.read")){
        const original=res.json.bind(res);
        res.json=((body:any)=>original(redactPurchaseCosts(body))) as any;
      }
      if(["POST","PATCH"].includes(req.method)&&/^\/api\/estimates\/(?:\d+\/line-items|line-items\/\d+)/.test(req.path)&&!hasPermission(s.role,"costs.write")){
        const items=Array.isArray(req.body?.items)?req.body.items:[req.body];
        if(items.some((item:any)=>item&&["unitCost","useTaxRate","taxNote"].some(k=>Object.hasOwn(item,k))))
          return deny(req,res,403,"Purchase costs and use tax require cost-management permission.");
      }
      const permission = routePermission(req.method, req.path);
      if (!permission || permission !== "authenticated" && !hasPermission(s.role, permission)) return deny(req, res, 403, "Your role does not allow this action.");
      if (permission === "mywork" && s.role === "technician" && !row("SELECT id FROM technicians WHERE id=? AND status='active'", s.technician_id)) return deny(req, res, 403, "Your technician profile is inactive. Contact an administrator.");
      if (!["/api/auth/me", "/api/auth/sessions"].includes(req.path))
        exec("UPDATE staff_sessions SET last_seen=? WHERE id=?", Date.now(), s.id);
      if (s.role === "support") {
        const original = res.json.bind(res);
        res.json = ((body: any) => original(redactFinancial(body))) as any;
        if (["POST","PATCH"].includes(req.method) && req.body && Object.keys(req.body).some(k => /(price|amount|subtotal|total|balance|credit|cost|discount|budget|rate|revenue|value)/i.test(k) && Number(req.body[k] || 0) !== 0)) return deny(req, res, 403, "Financial fields require additional authorization.");
      }
      if (req.body && Object.hasOwn(req.body, "performedBy")) req.body.performedBy = s.full_name;
      if (req.path.startsWith("/print/")) audit("document.print", "route", req.path);
      next();
    });
  });
  const handle = (fn: (req: Request, res: Response) => any) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (e: any) { res.status(e.status || 400).json({ error: String(e.message || "Request failed.") }); }
  };
  app.get("/api/auth/status", (_req, res) => res.json({ authenticationRequired: true, setupRequired:row("SELECT COUNT(*) n FROM staff_accounts").n===0, selfRegistration: false, idleMinutes: 30, sessionHours: 8 }));
  app.post("/api/auth/login", handle(async (req, res) => {
    fields(req.body, ["email","password"]);
    // Lockout is per email *and* network address, so another client cannot lock a staff member
    // out. A high per-email ceiling still slows guessing spread across many addresses.
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 254), ip = tokenHash(`network:${req.ip}`);
    const key = rateKey("login", email, req.ip), emailKey = rateKey("login-email", email);
    rateCheck(key, 5); rateCheck(emailKey, 100); rateCheck(ip, 60);
    const u = row("SELECT * FROM staff_accounts WHERE email=?", email);
    const version = u?.version;
    if (!await passwordMatches(req.body.password, u?.password_hash) || u?.status !== "active") {
      failedRate(key); failedRate(emailKey); failedRate(ip); audit("login.failed", "staff_accounts", u?.id || "", null, { attemptedEmail: email }); error("Invalid email or password.", 401);
    }
    const fresh = row("SELECT * FROM staff_accounts WHERE id=?", u.id);
    if (fresh.version !== version || fresh.status !== "active") error("Invalid email or password.", 401);
    securityContext.getStore()!.userId = u.id; securityContext.getStore()!.label = u.full_name;
    const session = sqlite.transaction(() => { exec("DELETE FROM staff_rate_limits WHERE key IN (?,?)", key, emailKey); const s = sessionFor(fresh, req.get("user-agent") || "Unknown browser"); audit("login.succeeded", "staff_accounts", u.id); return s; })();
    res.json(session);
  }));
  app.post("/api/auth/activate", handle(async (req, res) => {
    fields(req.body, ["email","activationCode","password"]);
    const email = emailValue(req.body.email), code = String(req.body.activationCode || ""), key = rateKey("activation", email, req.ip), ip = tokenHash(`network:${req.ip}`);
    rateCheck(key, 5); rateCheck(ip, 60);
    const inv = code.length === 43 ? row("SELECT i.*,u.email,u.version,u.status FROM staff_invitations i JOIN staff_accounts u ON u.id=i.user_id WHERE token_hash=?", tokenHash(code)) : null;
    if (!inv || inv.email !== email || inv.used_at || inv.expires_at <= Date.now() || inv.status === "disabled") { failedRate(key); failedRate(ip); audit("activation.failed", "staff_accounts", "", null, { email }); error("Activation code is invalid, expired or already used."); }
    const hash = await passwordHash(passwordValue(req.body.password, email));
    const session = sqlite.transaction(() => {
      const current = row("SELECT i.*,u.version,u.status FROM staff_invitations i JOIN staff_accounts u ON u.id=i.user_id WHERE i.id=?", inv.id);
      if (current.used_at || current.expires_at <= Date.now() || current.version !== inv.version || current.status === "disabled") error("Activation code is invalid, expired or already used.");
      exec("UPDATE staff_invitations SET used_at=? WHERE id=?", Date.now(), inv.id);
      exec("UPDATE staff_accounts SET password_hash=?,status='active',version=version+1,updated_at=? WHERE id=?", hash, now(), inv.user_id);
      exec("DELETE FROM staff_sessions WHERE user_id=?", inv.user_id);
      exec("DELETE FROM staff_rate_limits WHERE key IN (?,?,?)", key, rateKey("login-email", email), rateKey("login", email, req.ip));
      const u = row("SELECT * FROM staff_accounts WHERE id=?", inv.user_id);
      securityContext.getStore()!.userId = u.id; securityContext.getStore()!.label = u.full_name;
      audit("staff.activated", "staff_accounts", u.id, null, { email, role: u.role });
      audit("login.succeeded", "staff_accounts", u.id);
      return sessionFor(u, req.get("user-agent") || "Unknown browser");
    })();
    res.json(session);
  }));
  app.get("/api/auth/me", (_req, res) => res.json(safeUser(res.locals.staff)));
  app.post("/api/auth/logout", (_req, res) => {
    sqlite.transaction(() => { exec("DELETE FROM staff_sessions WHERE id=?", res.locals.sessionId); audit("logout", "staff_accounts", res.locals.staff.id); })();
    res.json({ success: true });
  });
  app.get("/api/auth/sessions", (_req, res) => res.json(rows("SELECT id,created_at,last_seen,expires_at,user_agent FROM staff_sessions WHERE user_id=? AND expires_at>? AND last_seen>? ORDER BY created_at DESC", res.locals.staff.id, Date.now(), Date.now() - IDLE).map(s => ({ ...s, current: s.id === res.locals.sessionId }))));
  app.post("/api/auth/revoke-others", (_req, res) => {
    sqlite.transaction(() => { exec("DELETE FROM staff_sessions WHERE user_id=? AND id<>?", res.locals.staff.id, res.locals.sessionId); audit("sessions.revoke_others", "staff_accounts", res.locals.staff.id); })();
    res.json({ success: true });
  });
  app.post("/api/auth/change-password", handle(async (req, res) => {
    fields(req.body, ["currentPassword","newPassword"]);
    const user = row("SELECT * FROM staff_accounts WHERE id=?", res.locals.staff.id), key = tokenHash(`change:${user.id}`);
    rateCheck(key, 5);
    if (!await passwordMatches(req.body.currentPassword, user.password_hash)) { failedRate(key); audit("password.change_failed", "staff_accounts", user.id); error("Current password is incorrect."); }
    const hash = await passwordHash(passwordValue(req.body.newPassword, user.email));
    sqlite.transaction(() => {
      const fresh = row("SELECT version,status FROM staff_accounts WHERE id=?", user.id);
      if (fresh.version !== user.version || fresh.status !== "active" || !row("SELECT id FROM staff_sessions WHERE id=?", res.locals.sessionId)) error("Session changed. Sign in again.", 401);
      exec("UPDATE staff_accounts SET password_hash=?,version=version+1,updated_at=? WHERE id=?", hash, now(), user.id);
      exec("DELETE FROM staff_sessions WHERE user_id=?", user.id);
      exec("UPDATE staff_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL", Date.now(), user.id);
      exec("DELETE FROM staff_rate_limits WHERE key=?", key); audit("password.changed", "staff_accounts", user.id);
    })();
    res.json({ success: true, signInRequired: true });
  }));
  app.get("/api/staff/roles", (_req, res) => res.json(ROLES));
  app.get("/api/staff", (_req, res) => res.json(rows("SELECT * FROM staff_accounts ORDER BY full_name").map(u => ({
    ...safeUser(u), version: u.version, createdAt: u.created_at, lastLoginAt: u.last_login_at,
    activeSessions: row("SELECT COUNT(*) AS n FROM staff_sessions WHERE user_id=? AND expires_at>? AND last_seen>?", u.id, Date.now(), Date.now() - IDLE).n,
  }))));
  app.post("/api/staff", handle((req, res) => {
    fields(req.body, ["email","fullName","role","technicianId"]);
    const role = req.body.role as Role;
    if (!Object.hasOwn(ROLES, role)) error("Choose a valid role.");
    if (role === "owner" && res.locals.staff.role !== "owner") error("Only an owner can appoint owners.", 403);
    const email = emailValue(req.body.email), name = textValue(req.body.fullName, "Name"), tech = checkTech(role, req.body.technicianId);
    if (row("SELECT id FROM staff_accounts WHERE email=?", email)) error("An account already uses that email.", 409);
    const result = sqlite.transaction(() => {
      const u = exec("INSERT INTO staff_accounts(email,full_name,role,status,technician_id,created_at,updated_at) VALUES(?,?,?,'invited',?,?,?)", email, name, role, tech, now(), now());
      const id = Number(u.lastInsertRowid); audit("staff.invited", "staff_accounts", id, null, { email, fullName: name, role, technicianId: tech });
      return { user: safeUser(row("SELECT * FROM staff_accounts WHERE id=?", id)), ...invite(id) };
    })();
    res.status(201).json(result);
  }));
  function target(req: Request, res: Response) {
    const u = row("SELECT * FROM staff_accounts WHERE id=?", Number(req.params.id));
    if (!u) error("Account not found.", 404);
    if (u.role === "owner" && res.locals.staff.role !== "owner") error("Only an owner may change another owner.", 403);
    return u;
  }
  app.patch("/api/staff/:id", handle((req, res) => {
    fields(req.body, ["role","status","technicianId","version","reason"]);
    const u = target(req, res), role = req.body.role as Role, status = req.body.status;
    if (!Object.hasOwn(ROLES, role) || !["active","disabled","invited"].includes(status)) error("Choose a valid role and status.");
    if (role === "owner" && res.locals.staff.role !== "owner") error("Only an owner can appoint owners.", 403);
    if (u.version !== req.body.version) error("This account changed. Refresh before saving.", 409);
    if (u.id === res.locals.staff.id && (role !== u.role || status !== "active")) error("Use another owner/administrator to change your own access.");
    if (status === "active" && !u.password_hash) error("The employee must activate their account first.");
    if (status === "invited" && u.status !== "invited") error("Use Reset / new invitation instead.");
    if (u.role === "owner" && u.status === "active" && (role !== "owner" || status !== "active") && row("SELECT COUNT(*) AS n FROM staff_accounts WHERE role='owner' AND status='active'").n <= 1) error("The last active owner cannot be removed.");
    const reason = textValue(req.body.reason, "Reason", 250), tech = status === "disabled" && role === "technician" && req.body.technicianId === u.technician_id ? u.technician_id : checkTech(role, req.body.technicianId);
    sqlite.transaction(() => {
      exec("UPDATE staff_accounts SET role=?,status=?,technician_id=?,version=version+1,updated_at=? WHERE id=?", role, status, tech, now(), u.id);
      exec("DELETE FROM staff_sessions WHERE user_id=?", u.id);
      exec("UPDATE staff_invitations SET used_at=? WHERE user_id=? AND used_at IS NULL", Date.now(), u.id);
      audit("staff.access_changed", "staff_accounts", u.id, safeUser(u), { ...safeUser(row("SELECT * FROM staff_accounts WHERE id=?", u.id)), reason });
    })();
    res.json({ success: true });
  }));
  app.post("/api/staff/:id/invitation", handle((req, res) => {
    fields(req.body, ["reason"]);
    const u = target(req, res), reason = textValue(req.body.reason, "Reason", 250);
    if (u.id === res.locals.staff.id) error("Use Change password for your own account.");
    if (u.role === "owner" && u.status === "active" && row("SELECT COUNT(*) AS n FROM staff_accounts WHERE role='owner' AND status='active'").n <= 1) error("The last active owner cannot be reset this way.");
    const result = sqlite.transaction(() => {
      exec("UPDATE staff_accounts SET status='invited',password_hash=NULL,version=version+1,updated_at=? WHERE id=?", now(), u.id);
      exec("DELETE FROM staff_sessions WHERE user_id=?", u.id);
      const invitation = invite(u.id); audit("staff.invitation_reissued", "staff_accounts", u.id, null, { reason });
      return invitation;
    })();
    res.json(result);
  }));
  app.post("/api/staff/:id/revoke-sessions", handle((req, res) => {
    fields(req.body, ["reason"]); const u = target(req, res), reason = textValue(req.body.reason, "Reason", 250);
    sqlite.transaction(() => { exec("DELETE FROM staff_sessions WHERE user_id=?", u.id); exec("UPDATE staff_accounts SET version=version+1 WHERE id=?", u.id); audit("sessions.revoked", "staff_accounts", u.id, null, { reason }); })();
    res.json({ success: true });
  }));
  app.get("/api/staff/audit", handle((req, res) => {
    const offset = Math.max(0, Math.min(1000000, Number(req.query.offset) || 0));
    const clauses: string[] = [], args: any[] = [];
    for (const [q, col] of [["actor","actor_id"],["entity","entity"],["event","event"]] as const) if (req.query[q]) { clauses.push(`${col}=?`); args.push(String(req.query[q]).slice(0, 100)); }
    for (const [q, op] of [["from",">="],["to","<="]] as const) if (req.query[q]) {
      const date = String(req.query[q]); if (!/^\d{4}-\d\d-\d\d$/.test(date)) error("Use YYYY-MM-DD audit dates.");
      clauses.push(`substr(occurred_at,1,10)${op}?`); args.push(date);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = row(`SELECT COUNT(*) AS n FROM security_audit ${where}`, ...args).n;
    const events = rows(`SELECT * FROM security_audit ${where} ORDER BY id DESC LIMIT 50 OFFSET ?`, ...args, Math.floor(offset));
    audit("audit.viewed", "security_audit", "", null, { offset, filters: clauses.length });
    res.json({ total, events, offset, pageSize: 50 });
  }));
  app.get("/api/my-work", (_req, res) => {
    const id = res.locals.staff.technician_id;
    if (!id) return res.json([]);
    // No invoices, pricing, private customer notes or unrelated records.
    res.json(rows(`SELECT j.id,j.job_number AS jobNumber,j.title,j.service_type AS serviceType,j.status,j.scheduled_date AS scheduledDate,j.completed_date AS completedDate,
      c.company_name AS companyName,c.first_name AS firstName,c.last_name AS lastName,
      v.year,v.make,v.model,v.vin FROM jobs j JOIN customers c ON c.id=j.customer_id LEFT JOIN vehicles v ON v.id=j.vehicle_id
      WHERE j.assigned_tech_id=? ORDER BY j.scheduled_date,j.id`, id));
  });
  app.post("/api/my-work/:id/:action", handle((req, res) => {
    const job = row("SELECT * FROM jobs WHERE id=? AND assigned_tech_id=?", Number(req.params.id), res.locals.staff.technician_id || -1);
    if (!job) error("Assigned work order not found.", 404);
    if (req.params.action === "status") {
      fields(req.body, ["status"]);
      const allowed = job.status === "in_progress" ? ["completed"] : ["pending","scheduled"].includes(job.status) ? ["in_progress"] : [];
      if (!allowed.includes(req.body.status)) error("This work-order transition is not permitted.");
      exec("UPDATE jobs SET status=?,completed_date=? WHERE id=?", req.body.status, req.body.status === "completed" ? now().slice(0, 10) : job.completed_date, job.id);
    } else if (req.params.action === "notes") {
      fields(req.body, ["note"]); const note = textValue(req.body.note, "Note", 2000);
      exec("INSERT INTO activities(customer_id,job_id,activity_type,description,performed_by,created_at) VALUES(?,?,'note',?,?,?)", job.customer_id, job.id, note, actorLabel(), now());
    } else error("Action not found.", 404);
    res.json({ success: true });
  }));
  app.get("/api/my-work/:id/scope", handle((req, res) => {
    const job = row("SELECT id,title,description,priority FROM jobs WHERE id=? AND assigned_tech_id=?", Number(req.params.id), res.locals.staff.technician_id || -1);
    if (!job) error("Assigned work order not found.", 404);
    res.json({ ...job,
      lines: rows(`SELECT e.estimate_number AS estimateNumber,e.status,l.description,l.quantity,l.unit,l.panel_location AS panelLocation
        FROM estimates e JOIN estimate_line_items l ON l.estimate_id=e.id WHERE e.job_id=? ORDER BY e.id,l.id`, job.id),
      notes: rows("SELECT description,performed_by AS author,created_at AS createdAt FROM activities WHERE job_id=? AND activity_type='note' ORDER BY id DESC LIMIT 50", job.id) });
  }));
  app.post("/api/reports/export-log", handle((req, res) => {
    fields(req.body, ["source","count"]); audit("report.export", "reports", String(req.body.source || "").slice(0, 50), null, { rows: Number(req.body.count) || 0 }); res.json({ success: true });
  }));
}
