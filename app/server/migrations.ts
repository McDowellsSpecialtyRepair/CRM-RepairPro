// Single database migration entry point. Server startup, `npm run db:migrate` and
// `npm run db:seed-demo` all call runMigrations(); nothing else may change the schema.
//
// Step order is significant and matches the original startup sequence: the base tables are
// created when storage-db is opened, early labor columns are added, one-time data is loaded,
// then the integrity rebuild adds ownership constraints and financial triggers before the
// later subsystems are layered on. Every schema step is idempotent and safe to repeat on
// each start. One-time steps are recorded in the app_migrations ledger.
//
// Never run generic `drizzle-kit push` against an operating database: it would discard the
// deferred ownership constraints, immutable financial triggers and audit triggers created here.
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { migrateIntegrity } from "./integrity-migration";
import { migrateLabor, recordDelivery } from "./labor";
import { initializeSecurity, audit } from "./security";
import { migrateEstimateSales } from "./estimate-sales";
import { migrateOperations } from "./operations";
import { migrateCapacity } from "./capacity";
import { migrateWorkOrders } from "./work-orders";
import { migrateReporting } from "./reporting";
import { migrateEstimateDents } from "./estimate-dents";
import { TEST_EMAIL } from "./delivery-config";

export const REFERENCE_CATALOG = "reference-catalog-v1";
export const DEMO_DATA = "demo-data-v1";
const INTEGRITY = "integrity-v1"; // recorded by migrateIntegrity()

const applied = (version: string) => !!sqlite.prepare("SELECT 1 FROM app_migrations WHERE version=?").get(version);
const record = (version: string) =>
  sqlite.prepare("INSERT OR IGNORE INTO app_migrations(version,applied_at) VALUES(?,?)").run(version, new Date().toISOString());
const count = (table: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as any).n as number;

export function runMigrations(options: { seedDemo?: boolean } = {}) {
  // Same definition migrateIntegrity() uses; created first so one-time steps can be recorded.
  sqlite.exec("CREATE TABLE IF NOT EXISTS app_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  if (options.seedDemo && (applied(INTEGRITY) || count("customers") > 0))
    throw new Error("Demo data can only be added to a brand-new, empty database.");

  migrateLabor(true);

  // Reference catalog (service templates, pricing matrices, tax jurisdictions) is loaded once,
  // and only into a brand-new database. An existing database is marked without changes.
  if (!applied(REFERENCE_CATALOG)) sqlite.transaction(() => {
    if (["customers", "service_templates", "pricing_matrices", "tax_jurisdictions"].every(t => count(t) === 0))
      storage.seedReferenceData();
    record(REFERENCE_CATALOG);
  })();

  // Demonstration records are never loaded by server startup; only by an explicit request.
  if (options.seedDemo) sqlite.transaction(() => {
    storage.seedDemoData();
    record(DEMO_DATA);
  })();

  migrateIntegrity(sqlite);
  migrateLabor();
  initializeSecurity();
  migrateEstimateSales();
  migrateOperations();
  migrateCapacity();
  migrateWorkOrders();
  migrateReporting();
  migrateEstimateDents();
  initializeSecurity(); // Include report definitions, ops_* tables and dent records in row-level auditing.
  correctFalseSentEstimate23();

  if (applied(DEMO_DATA))
    console.warn("WARNING: this database contains demonstration data loaded by db:seed-demo. Do not use it for real business records.");
}

// Preserve approvals; correct only the known false-sent estimate, without rewriting history.
function correctFalseSentEstimate23() {
  sqlite.transaction(() => {
    if (!sqlite.prepare("SELECT 1 FROM commerce_migrations WHERE name='delivery-correction-23'").get()) {
      const e = sqlite.prepare("SELECT * FROM estimates WHERE estimate_number='EST-2026-000023'").get() as any;
      const evidence = sqlite.prepare("SELECT id FROM activities WHERE description LIKE '%EST-2026-000023 marked sent%' AND description LIKE '%server email not set up%'").get();
      if (e && evidence) {
        recordDelivery("estimate",e.id,TEST_EMAIL,null,false);
        if (e.status === "sent" && !e.invoice_id) sqlite.prepare("UPDATE estimates SET status='draft' WHERE id=?").run(e.id);
        audit("delivery.corrected","estimates",e.id,{status:e.status},{status:e.status === "sent" && !e.invoice_id ? "draft" : e.status,delivery:"not_configured",reason:"Prior activity confirms email was not sent."});
      }
      sqlite.prepare("INSERT INTO commerce_migrations(name) VALUES('delivery-correction-23')").run();
    }
  })();
}
