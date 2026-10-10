import fs from "node:fs";
import path from "node:path";

// Test mailbox used for every outbound estimate/invoice email until customer delivery is approved.
export const TEST_EMAIL = "service@mcdowellsrepair.com";

// Rendered email copies are written here. Set EMAIL_OUTPUT_DIR explicitly in each environment;
// the fallback is an `emails` folder under the server's working directory (already git-ignored).
export function emailOutputDir() {
  return path.resolve(process.env.EMAIL_OUTPUT_DIR || "emails");
}

// Email copies contain customer data: owner-only folder and files. When
// EMAIL_COPY_RETENTION_DAYS is a positive number, copies older than that are deleted
// whenever a new copy is saved; unset keeps every copy (the previous behaviour).
export function saveEmailCopy(fileName: string, html: string) {
  const dir = emailOutputDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch { /* not owned by this process; leave as configured */ }
  pruneEmailCopies(dir);
  const file = path.join(dir, path.basename(fileName));
  fs.writeFileSync(file, html, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

function pruneEmailCopies(dir: string) {
  const days = Number(process.env.EMAIL_COPY_RETENTION_DAYS || 0);
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = Date.now() - days * 86400000;
  for (const name of fs.readdirSync(dir)) {
    if (!/^(invoice|estimate)-.+\.html$/.test(name)) continue;
    const file = path.join(dir, name);
    try { if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true }); }
    catch { /* removed concurrently; retention must never block sending */ }
  }
}
