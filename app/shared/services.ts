// Single source of truth for service types, their business domain, and what they are performed on.
export type ServiceDomain = "auto" | "rv" | "marine" | "furniture";

export interface ServiceDef {
  value: string;
  label: string;
  domain: ServiceDomain;
  target: "vehicle" | "asset";
  description: string;
}

export const SERVICES: ServiceDef[] = [
  { value: "pdr", label: "Paintless Dent Repair", domain: "auto", target: "vehicle", description: "Door dings, creases, and dents on exterior panels" },
  { value: "hail", label: "Hail Damage Repair", domain: "auto", target: "vehicle", description: "Insurance hail matrix, per-panel dent counts" },
  { value: "window_tint", label: "Window Tint", domain: "auto", target: "vehicle", description: "Standard, carbon, or ceramic film" },
  { value: "interior_repair", label: "Auto Interior Repair", domain: "auto", target: "vehicle", description: "Vinyl, leather, plastic, and fabric repair" },
  { value: "rv_interior", label: "RV Interior Repair", domain: "rv", target: "vehicle", description: "Dash, slide-out walls, panels, vinyl and plastic" },
  { value: "rv_upholstery", label: "RV Upholstery", domain: "rv", target: "vehicle", description: "Sofa/bed, dinette, captain chairs, cushions" },
  { value: "marine_interior", label: "Marine Interior Repair", domain: "marine", target: "vehicle", description: "Helm, cabin panels, galley, vinyl and plastic" },
  { value: "marine_upholstery", label: "Marine Upholstery", domain: "marine", target: "vehicle", description: "V-berth, settee, helm seats, cushions" },
  { value: "upholstery", label: "Furniture & Commercial Upholstery", domain: "furniture", target: "asset", description: "Chairs, sofas, restaurant booths, hotel, office, home, aircraft" },
];

export const DOMAIN_LABELS: Record<ServiceDomain, string> = {
  auto: "Auto",
  rv: "RV",
  marine: "Marine",
  furniture: "Furniture & Commercial",
};

export const SERVICE_LABELS: Record<string, string> = Object.fromEntries(SERVICES.map((s) => [s.value, s.label]));

// Which vehicle types belong to each vehicle-based domain
export const DOMAIN_VEHICLE_TYPES: Record<string, string[]> = {
  auto: ["auto", "truck", "motorcycle", "other"],
  rv: ["rv"],
  marine: ["marine"],
};

export const ASSET_TYPES = [
  { value: "chair", label: "Chair" },
  { value: "sofa", label: "Sofa / Couch" },
  { value: "loveseat", label: "Loveseat" },
  { value: "recliner", label: "Recliner" },
  { value: "dining_chair", label: "Dining Room Chair" },
  { value: "ottoman", label: "Ottoman" },
  { value: "restaurant_booth", label: "Restaurant Booth" },
  { value: "restaurant", label: "Restaurant (multiple pieces)" },
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "office", label: "Office Furniture" },
  { value: "home", label: "Home Furniture" },
  { value: "aircraft", label: "Aircraft Interior" },
  { value: "other", label: "Other" },
];

export const ASSET_TYPE_LABELS: Record<string, string> = Object.fromEntries(ASSET_TYPES.map((a) => [a.value, a.label]));
