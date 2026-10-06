import { sqlite } from "./storage-db";
export function migrateLabor(columnsOnly = false) {
  sqlite.transaction(() => {
    if (!(sqlite.prepare("PRAGMA table_info(jobs)").all() as any[]).some(c=>c.name==="assigned_tech_id"))
      sqlite.exec("ALTER TABLE jobs ADD COLUMN assigned_tech_id INTEGER REFERENCES technicians(id)");
    if (!(sqlite.prepare("PRAGMA table_info(estimate_line_items)").all() as any[]).some(c=>c.name==="allocation_version"))
      sqlite.exec("ALTER TABLE estimate_line_items ADD COLUMN allocation_version INTEGER NOT NULL DEFAULT 1");
    for (const table of ["estimate_line_items", "invoice_line_items"]) {
      if (!(sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[]).some(c => c.name === "line_type"))
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN line_type TEXT NOT NULL DEFAULT 'legacy' CHECK(line_type IN ('legacy','parts','labor'))`);
    }
    if (columnsOnly) return;
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS estimate_labor_allocations (
        id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES estimate_line_items(id) ON DELETE CASCADE,
        technician_id INTEGER NOT NULL REFERENCES technicians(id), share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),
        UNIQUE(line_id,technician_id));
      CREATE TABLE IF NOT EXISTS invoice_labor_credits (
        id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES invoice_line_items(id),
        technician_id INTEGER NOT NULL REFERENCES technicians(id), technician_name TEXT NOT NULL,
        share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),
        net_labor_cents INTEGER NOT NULL CHECK(net_labor_cents>=0), UNIQUE(line_id,technician_id));
      CREATE TRIGGER IF NOT EXISTS labor_credits_no_update BEFORE UPDATE ON invoice_labor_credits BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS labor_credits_no_delete BEFORE DELETE ON invoice_labor_credits BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS labor_credits_labor_only BEFORE INSERT ON invoice_labor_credits
        WHEN NOT EXISTS(SELECT 1 FROM invoice_line_items WHERE id=NEW.line_id AND line_type='labor')
        BEGIN SELECT RAISE(ABORT,'Only labor can be credited to a technician'); END;
      CREATE TABLE IF NOT EXISTS document_deliveries (
        id INTEGER PRIMARY KEY, document_type TEXT NOT NULL CHECK(document_type IN ('estimate','invoice')),
        document_id INTEGER NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('email','sms','whatsapp')),
        recipient TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('not_configured','failed','provider_accepted')),
        provider_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commerce_migrations (name TEXT PRIMARY KEY);
    `);
  })();
}
// Largest-remainder allocation: exact integer cents, stable ties by input order.
export function apportion(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || total<0 || weights.some(w=>!Number.isSafeInteger(w)||w<0))
    throw Object.assign(new Error("Allocation amounts must be nonnegative, safe whole cents. Review legacy adjustments."),{status:409});
  const sum = weights.reduce((a,b) => a+b,0);
  if (!Number.isSafeInteger(sum)) throw new Error("Allocation amount exceeds safe precision.");
  if (!sum) return weights.map(() => 0);
  const numerator = BigInt(total), denominator = BigInt(sum);
  const result = weights.map(w => Number(numerator*BigInt(w)/denominator));
  const rank = weights.map((w,i) => ({i,remainder:Number((numerator*BigInt(w))%denominator)})).sort((a,b) => b.remainder-a.remainder || a.i-b.i);
  let remaining = total-result.reduce((a,b) => a+b,0);
  for (const r of rank) if (remaining-- > 0) result[r.i]++;
  return result;
}
export function lineNetCents(lines: any[], discount: number) {
  const gross = lines.map(l => Math.round(l.total*100));
  const discounts = apportion(Math.round(discount*100),gross);
  return gross.map((g,i) => g-discounts[i]);
}
export const allocations = (id: number) => sqlite.prepare(`SELECT a.*,t.name FROM estimate_labor_allocations a JOIN technicians t ON t.id=a.technician_id WHERE line_id=? ORDER BY a.technician_id`).all(id) as any[];
export function requireAllocations(line: any) {
  if (line.lineType !== "labor" || line.total === 0) return [];
  const list = allocations(line.id);
  if (list.reduce((s,a) => s+a.share_bps,0) !== 10000 || list.some(a => !(sqlite.prepare("SELECT id FROM technicians WHERE id=? AND status='active'").get(a.technician_id))))
    throw Object.assign(new Error(`Assign exactly 100% of labor to active technicians: ${line.description}`), {status:409});
  return list;
}
export function deliveries(type: string, id: number) {
  return sqlite.prepare("SELECT * FROM document_deliveries WHERE document_type=? AND document_id=? ORDER BY id DESC").all(type,id);
}
export function recordDelivery(type: string,id: number,recipient: string,result: any,configured: boolean) {
  const accepted = !!result?.messageId && Array.isArray(result.accepted) && result.accepted.length > 0;
  sqlite.prepare("INSERT INTO document_deliveries(document_type,document_id,channel,recipient,state,provider_id,detail,created_at) VALUES(?,?,'email',?,?,?,?,?)")
    .run(type,id,recipient,accepted ? "provider_accepted" : configured ? "failed" : "not_configured",result?.messageId || null,accepted ? "Accepted by email server; recipient delivery not confirmed." : result?.error || "Email server not configured; nothing sent.",new Date().toISOString());
  return accepted;
}
