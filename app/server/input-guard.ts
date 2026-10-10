import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Response } from "express";
import { hasPermission, type Role } from "../shared/security";
import { fail } from "./billing";

// Record keys and timestamps are always assigned by the server.
const ALWAYS_PROTECTED = ["id", "createdAt"];
// Fields that change how a customer (or payer) is taxed or how much credit they receive.
// Only roles with customers.tax_terms (owner, admin, manager, accountant) may set them.
export const TAX_TERM_FIELDS = ["taxExempt", "creditLimit"];
const MAX_TEXT = 20000;

// Mass-assignment guard for the generic create/update routes: keeps only real columns of
// `table`, rejects server-controlled ones, and checks each value against its column type.
// Non-column keys (request options such as confirmDuplicate) are left for the caller and
// never reach the database.
export function acceptFields(table: SQLiteTable, body: unknown, res: Response, protectedFields: string[] = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Expected a JSON object.");
  const columns = getTableColumns(table) as Record<string, { dataType: string }>;
  const blocked = new Set([...ALWAYS_PROTECTED, ...protectedFields]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!Object.hasOwn(columns, key)) continue;
    if (blocked.has(key)) fail(`${key} is set by the server and cannot be changed here.`);
    if (TAX_TERM_FIELDS.includes(key) && !hasPermission(res.locals.staff?.role as Role, "customers.tax_terms"))
      fail(`Changing ${key} requires billing or management authorization.`, 403);
    out[key] = columnValue(key, value, columns[key].dataType);
  }
  return out;
}

function columnValue(key: string, value: unknown, type: string) {
  if (value === null || value === undefined) return value;
  if (type === "string") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value !== "string" || value.length > MAX_TEXT) fail(`${key} must be text of at most ${MAX_TEXT} characters.`);
    return value;
  }
  if (type === "number") {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) fail(`${key} must be a number.`);
      return Number(trimmed);
    }
    if (typeof value !== "number" || !Number.isFinite(value)) fail(`${key} must be a number.`);
    return value;
  }
  fail(`${key} cannot be set here.`);
}
