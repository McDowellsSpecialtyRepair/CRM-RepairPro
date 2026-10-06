// A date-only value is a calendar label, not a UTC timestamp.
export function formatCalendarDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) return "";
  return new Intl.DateTimeFormat("en-US", {...options, timeZone:"UTC"}).format(date);
}
