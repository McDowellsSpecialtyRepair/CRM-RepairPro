import { validDate } from "./reporting";
export type WorkSort = "number" | "priority" | "assignedTech" | "scheduledDate";
export type SortDirection = "asc" | "desc";
const collator = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });
const urgency: Record<string, number> = { low: 1, normal: 2, high: 3, urgent: 4 };
function value(row: any, field: WorkSort): string | number | null {
  if (field === "priority") return urgency[row.priority] ?? null;
  if (field === "scheduledDate") return typeof row.scheduledDate === "string" && validDate(row.scheduledDate) ? row.scheduledDate : null;
  const text = String(field === "number" ? row.jobNumber || row.estimateNumber || "" : row.assignedTech || "").trim();
  return text || null;
}
export function sortWork<T extends { id: number }>(rows: T[], field: WorkSort, direction: SortDirection): T[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = value(a, field), bv = value(b, field);
    // Missing or invalid values stay last in BOTH directions.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const primary = av === null || bv === null ? 0 : typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av), String(bv));
    return primary * sign || collator.compare(String(value(a, "number") || ""), String(value(b, "number") || "")) || a.id - b.id;
  });
}
