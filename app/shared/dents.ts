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
