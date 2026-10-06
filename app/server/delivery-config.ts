import path from "node:path";

// Test mailbox used for every outbound estimate/invoice email until customer delivery is approved.
export const TEST_EMAIL = "service@mcdowellsrepair.com";

// Rendered email copies are written here. Set EMAIL_OUTPUT_DIR explicitly in each environment;
// the fallback is an `emails` folder under the server's working directory (already git-ignored).
export function emailOutputDir() {
  return path.resolve(process.env.EMAIL_OUTPUT_DIR || "emails");
}
