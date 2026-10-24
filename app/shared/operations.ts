// The owner's five technician groups (2026-10-23). Calendar rows, capacity searches and production are by group.
export const DEPARTMENTS = [
  "AS - Auto Shop",
  "FR - Furniture",
  "UP - Upholstery",
  "MI - Mobile Interior",
  "ME - Mobile Exterior",
] as const;
// The earlier service departments, mapped to the group that usually does that work (owner can reassign).
export const OLD_DEPARTMENT_GROUP: Record<string, (typeof DEPARTMENTS)[number]> = {
  "PDR / Hail": "ME - Mobile Exterior", "Window Tint": "AS - Auto Shop", "Interior Repair": "MI - Mobile Interior",
  "Upholstery": "UP - Upholstery", "Furniture / Commercial": "FR - Furniture",
};
// The group that usually does a service; a starting suggestion only.
export const departmentFor = (service: string) =>
  service === "pdr" || service === "hail"
    ? DEPARTMENTS[4]
    : service === "window_tint"
      ? DEPARTMENTS[0]
      : service === "upholstery"
        ? DEPARTMENTS[1]
        : service.includes("upholstery")
          ? DEPARTMENTS[2]
          : ["interior_repair","rv_interior","marine_interior"].includes(service)?DEPARTMENTS[3]:"";
export const HOLD_REASONS = [
  "",
  "Parts / materials",
  "Customer approval",
  "Dealer approval",
  "Insurance",
  "Equipment",
  "Prior task",
  "Other",
] as const;
export function localToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Boise",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(day: string, days: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const minuteString = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function timeMinutes(s: string) {
  const a = s.split(":").map(Number);
  return a[0] * 60 + a[1];
}
