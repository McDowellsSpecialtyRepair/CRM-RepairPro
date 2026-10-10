// Encrypted SQLite backup files: "RPBK1\n" + 12-byte IV + AES-256-GCM ciphertext + 16-byte tag.
// The key is 32 random bytes supplied as BACKUP_ENCRYPTION_KEY (64 hex characters or base64).
// Keep the key in a password manager or secret store, never next to the backups.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, chmodSync, renameSync, rmSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("RPBK1\n"), IV_BYTES = 12, TAG_BYTES = 16;

export function newBackupKey() { return randomBytes(32).toString("hex"); }

export function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  const v = (value || "").trim();
  if (!v) return null;
  const key = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, "hex") : Buffer.from(v, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64). Generate one with: node handoff/database.mjs keygen");
  return key;
}

export async function encryptFile(source, destination, key) {
  const iv = randomBytes(IV_BYTES), cipher = createCipheriv("aes-256-gcm", key, iv);
  await pipeline(createReadStream(source), cipher, async function* (encrypted) {
    yield Buffer.concat([MAGIC, iv]);
    for await (const chunk of encrypted) yield chunk;
    yield cipher.getAuthTag();
  }, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
  chmodSync(destination, 0o600);
}

// Decrypts to a temporary file and renames it only after the authentication tag verifies,
// so a tampered or wrong-key backup never produces a usable database file.
export async function decryptFile(source, destination, key) {
  const size = statSync(source).size, header = Buffer.alloc(MAGIC.length + IV_BYTES), tag = Buffer.alloc(TAG_BYTES);
  if (size < header.length + TAG_BYTES) throw new Error("Not an encrypted RepairPro backup.");
  const fd = openSync(source, "r");
  try { readSync(fd, header, 0, header.length, 0); readSync(fd, tag, 0, TAG_BYTES, size - TAG_BYTES); } finally { closeSync(fd); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Not an encrypted RepairPro backup.");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const partial = `${destination}.partial`;
  try {
    await pipeline(createReadStream(source, { start: header.length, end: size - TAG_BYTES - 1 }), decipher,
      createWriteStream(partial, { flags: "wx", mode: 0o600 }));
    renameSync(partial, destination);
  } catch (e) {
    rmSync(partial, { force: true });
    throw new Error(`Backup could not be decrypted (wrong key or modified file): ${e.message}`);
  }
}
