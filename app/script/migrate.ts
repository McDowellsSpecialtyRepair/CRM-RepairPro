// Versioned migrations are authoritative. Generic schema push would discard
// deferred ownership constraints and financial triggers.
import { sqlite } from "../server/storage-db";
import { storage } from "../server/storage";
import { migrateIntegrity } from "../server/integrity-migration";
import { migrateLabor } from "../server/labor";
import { initializeSecurity } from "../server/security";
import { migrateOperations } from "../server/operations";
import { migrateCapacity } from "../server/capacity";
migrateLabor(true);
storage.seedData();
migrateIntegrity(sqlite);
migrateLabor();
initializeSecurity();
migrateOperations();
migrateCapacity();
initializeSecurity();
const foreignKeys = sqlite.pragma("foreign_key_check") as any[];
if (foreignKeys.length) throw new Error("Foreign key verification failed");
console.log("Versioned migration complete; foreign key verification passed.");
sqlite.close();
