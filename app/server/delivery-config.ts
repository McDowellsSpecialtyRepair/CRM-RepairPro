import fs from "node:fs";
import path from "node:path";

// Test mailbox used for every outbound estimate/invoice email until customer delivery is approved.
export const TEST_EMAIL = "service@mcdowellsrepair.com";

// Rendered email copies are written here. Set EMAIL_OUTPUT_DIR explicitly in each environment;
// the fallback is an `emails` folder under the server's working directory (already git-ignored).
export function emailOutputDir() {
  return path.resolve(process.env.EMAIL_OUTPUT_DIR || "emails");
}

// Email copies contain customer data: owner-only folders and files. Each copy is classified:
//  - test-copies/  : addressed only to the internal TEST_EMAIL mailbox. Temporary; deleted after
//                    EMAIL_TEST_COPY_RETENTION_DAYS (default 30; 0 keeps them).
//  - sent-records/ : addressed to anyone else (a customer). The record of what was sent; never
//                    deleted automatically.
// Copies saved before this change sit directly in the folder and are never touched. The
// authoritative invoices, estimates and delivery attempts live in the database regardless.
export const TEST_COPY_DIR = "test-copies", SENT_RECORD_DIR = "sent-records";
export const isTestMailboxOnly = (recipients: string) =>
  recipients.split(/\s*,\s*/).filter(Boolean).every(r => r.trim().toLowerCase() === TEST_EMAIL);

export function saveEmailCopy(fileName: string, html: string, recipients: string) {
  const temporary = isTestMailboxOnly(recipients);
  const dir = path.join(emailOutputDir(), temporary ? TEST_COPY_DIR : SENT_RECORD_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const d of [emailOutputDir(), dir]) {
    try { fs.chmodSync(d, 0o700); } catch { /* not owned by this process; leave as configured */ }
  }
  if (temporary) pruneTestCopies(dir);
  const file = path.join(dir, path.basename(fileName));
  fs.writeFileSync(file, html, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

export function testCopyRetentionDays(value = process.env.EMAIL_TEST_COPY_RETENTION_DAYS) {
  if (value === undefined || value.trim() === "") return 30;
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

// Only ever looks inside test-copies/; customer-facing records and older files are never pruned.
function pruneTestCopies(dir: string) {
  const days = testCopyRetentionDays();
  if (!days) return;
  const cutoff = Date.now() - days * 86400000;
  for (const name of fs.readdirSync(dir)) {
    if (!/^(invoice|estimate)-.+\.html$/.test(name)) continue;
    const file = path.join(dir, name);
    try { if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true }); }
    catch { /* removed concurrently; retention must never block sending */ }
  }
}
