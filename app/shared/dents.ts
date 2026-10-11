// Individual PDR dent records (Phase 2.1). Shared by the server validation and the estimate UI.
// Detail fields are recorded only; they do not change standard PDR prices.
export const DENT_SIZES = ["dime", "nickel", "quarter", "half_dollar", "softball", "crease"] as const;
export const DENT_SIZE_LABELS: Record<string, string> = {
  dime: "Dime", nickel: "Nickel", quarter: "Quarter", half_dollar: "Half dollar", softball: "Softball", crease: "Crease",
};
export const DENT_SEVERITIES = ["shallow", "medium", "deep"] as const;
export const DENT_SEVERITY_LABELS: Record<string, string> = { shallow: "Shallow", medium: "Medium", deep: "Deep" };
export const LOCATION_DIFFICULTIES = ["easy", "moderate", "difficult", "extreme"] as const;
export const LOCATION_DIFFICULTY_LABELS: Record<string, string> = { easy: "Easy", moderate: "Moderate", difficult: "Difficult", extreme: "Extreme" };
export const PAINT_CORRECTABLE = ["yes", "no"] as const;
export const PAINT_CORRECTABLE_LABEL = "Paint damage correctable?";
export const DENT_BODY_STYLES = ["sedan", "suv", "pickup"] as const;
export const DENT_LENGTH_MIN = 1, DENT_LENGTH_MAX = 36;
export const DENT_NOTES_MAX = 2000;

// Panels priced manually today (glass and plastic), mirroring the damage map.
export const NON_PDR_PANELS = new Set(["windshield", "rear-window", "front-bumper", "rear-bumper", "bed-floor"]);

// Matrix vehicle category used by the existing standard PDR matrix.
export const dentMatrixCategory = (bodyStyle: string) => (bodyStyle === "sedan" ? "sedan" : "suv");

// A crease has no approved matrix yet, and non-PDR panels never had one: both need an entered price.
export const dentNeedsManualPrice = (size: string, panelId: string) => size === "crease" || NON_PDR_PANELS.has(panelId);

// Same wording the damage map has always used for its estimate lines.
export const dentLineDescription = (panelId: string, panelName: string, size: string) =>
  size === "crease" ? `${panelName}: crease`
    : NON_PDR_PANELS.has(panelId) ? `${panelName}: dent (non-PDR)`
    : `${panelName}: ${DENT_SIZE_LABELS[size] || size} dent`;

// ---------- Phase 2.2: pricing ----------
export const STANDARD_DENT_SIZES = ["dime", "nickel", "quarter", "half_dollar", "softball"] as const;
export const BODY_STYLE_LABELS: Record<string, string> = { sedan: "Sedan", suv: "SUV", pickup: "Pickup" };

// Exterior panels a dent can be priced on (the diagram's PDR panels; glass and plastic excluded).
export const PDR_PANELS: { id: string; name: string }[] = [
  { id: "hood", name: "Hood" }, { id: "roof", name: "Roof" }, { id: "cab-roof", name: "Cab Roof" },
  { id: "trunk", name: "Trunk Lid" }, { id: "liftgate", name: "Liftgate" }, { id: "tailgate", name: "Tailgate" },
  { id: "lf-fender", name: "LF Fender" }, { id: "rf-fender", name: "RF Fender" },
  { id: "lf-door", name: "LF Door" }, { id: "rf-door", name: "RF Door" }, { id: "lr-door", name: "LR Door" }, { id: "rr-door", name: "RR Door" },
  { id: "lr-quarter", name: "LR Quarter" }, { id: "rr-quarter", name: "RR Quarter" },
  { id: "bed-side-l", name: "Bed Side (L)" }, { id: "bed-side-r", name: "Bed Side (R)" },
];

// Optional adjustments management can set. Blank = no adjustment.
export const ADJUSTMENT_DIMENSIONS: Record<"crease" | "standard", { key: string; label: string }[]> = {
  crease: [{ key: "location_difficulty", label: "Location difficulty" }, { key: "panel", label: "Panel" }],
  standard: [{ key: "severity", label: "Severity" }, { key: "location_difficulty", label: "Location difficulty" },
    { key: "length_range", label: "Length range" }, { key: "panel", label: "Panel" }],
};

export const lengthRangeLabel = (r: { minIn: number; maxIn: number }) => r.minIn === r.maxIn ? `${r.minIn}"` : `${r.minIn}"–${r.maxIn}"`;

// Customer-facing dent details: panel, size, length and severity only. Never the paint answer or notes.
export function customerDentDetail(d: { panelName: string; size: string; lengthIn: number | null; severity: string | null }) {
  return [d.panelName, DENT_SIZE_LABELS[d.size] || d.size, d.lengthIn ? `${d.lengthIn}" long` : "", d.severity ? `${DENT_SEVERITY_LABELS[d.severity]} severity` : ""]
    .filter(Boolean).join(" · ");
}

export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Package price comparison. Unpriced dents make the comparison "Pricing incomplete", never $0.
export function packageComparison(calculated: number | null, manual: number) {
  if (calculated === null) return { complete: false as const, difference: null, percent: null };
  const difference = roundMoney(manual - calculated);
  return { complete: true as const, difference, percent: calculated > 0 ? Math.round((difference / calculated) * 1000) / 10 : null };
}
// Below the calculated total needs management approval: always while no threshold is set,
// otherwise when the reduction is larger than the threshold percentage. Incomplete pricing always needs it.
export function packageNeedsApproval(calculated: number | null, manual: number, thresholdPercent: number | null) {
  if (calculated === null) return true;
  if (manual >= calculated) return false;
  if (thresholdPercent === null) return true;
  return calculated > 0 && ((calculated - manual) / calculated) * 100 > thresholdPercent;
}
