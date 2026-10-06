// Explicit, opt-in demonstration data for local development and automated tests only:
//   DB_PATH=./demo.db npm run db:seed-demo
// Loads sample customers, technicians, jobs, invoices, legacy users with dummy passwords, etc.
// Refuses to run in production or against any database that already exists.
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = process.env.DB_PATH;
if (!dbPath) throw new Error("Set DB_PATH explicitly to a new database file for demonstration data.");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to load demonstration data with NODE_ENV=production.");
const target = resolve(dbPath);
for (const file of [target, `${target}-wal`, `${target}-journal`])
  if (existsSync(file) && statSync(file).size > 0)
    throw new Error(`Refusing to load demonstration data into an existing database (${file}). Choose a new DB_PATH.`);

const { sqlite } = await import("../server/storage-db");
const { runMigrations } = await import("../server/migrations");
runMigrations({ seedDemo: true });
sqlite.close();
console.log(`Demonstration database created at ${target}. Never use it for real business records.`);
