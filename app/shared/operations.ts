export const DEPARTMENTS = [
  "PDR / Hail",
  "Window Tint",
  "Interior Repair",
  "Upholstery",
  "Furniture / Commercial",
] as const;
export const departmentFor = (service: string) =>
  service === "pdr" || service === "hail"
    ? DEPARTMENTS[0]
    : service === "window_tint"
      ? DEPARTMENTS[1]
      : service === "upholstery"
        ? DEPARTMENTS[4]
        : service.includes("upholstery")
          ? DEPARTMENTS[3]
          : ["interior_repair","rv_interior","marine_interior"].includes(service)?DEPARTMENTS[2]:"";
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
