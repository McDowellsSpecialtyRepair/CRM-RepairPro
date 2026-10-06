// Explicit database migration: `DB_PATH=/path/to/data.db npm run db:migrate`
// Runs the same runMigrations() the server runs on startup (server/migrations.ts).
// It never loads demonstration data. An existing database is backed up first.
import Database from "better-sqlite3";
import { existsSync, statSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = process.env.DB_PATH;
if (!dbPath) throw new Error("Set DB_PATH explicitly to the database you intend to migrate.");
const target = resolve(dbPath);

if (existsSync(target) && statSync(target).size > 0) {
  const backup = `${target}.pre-migrate-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
  if (existsSync(backup)) throw new Error("Refusing to overwrite an existing backup file.");
  const source = new Database(target, { readonly: true, fileMustExist: true });
  try { await source.backup(backup); } finally { source.close(); }
  chmodSync(backup, 0o600);
  console.log(`Consistent pre-migration backup written to ${backup} (contains private data; not encrypted).`);
}

// Import only after the backup so opening the database cannot change it first.
const { sqlite } = await import("../server/storage-db");
const { runMigrations } = await import("../server/migrations");
runMigrations();
const integrity = sqlite.pragma("integrity_check") as any[];
const foreignKeys = sqlite.pragma("foreign_key_check") as any[];
sqlite.close();
if (integrity.some(r => r.integrity_check !== "ok")) throw new Error("SQLite integrity check failed after migration.");
if (foreignKeys.length) throw new Error("Foreign key verification failed after migration.");
console.log("Migration complete; integrity and foreign key checks passed.");
