export const FURNITURE_STYLES: Record<string, Record<string, string>> = {
  chair: { club: "Club chair", wingback: "Wingback chair", classic: "Legacy chair diagram" },
  sofa: { "3-cushion": "Three-cushion sofa", "2-cushion": "Two-cushion sofa", "chaise-left": "Left-facing chaise sectional", "chaise-right": "Right-facing chaise sectional", classic: "Legacy sofa diagram" },
  loveseat: { standard: "Two-seat loveseat", console: "Loveseat with console" },
  recliner: { upright: "Upright recliner", extended: "Extended recliner", lift: "Lift recliner" },
  dining_chair: { "seat-only": "Seat-only upholstery", "full-back": "Upholstered seat and back", arms: "Dining armchair" },
  ottoman: { rectangle: "Rectangular ottoman", round: "Round ottoman", storage: "Storage ottoman" },
  marine: { "open-bow-io": "Open bow inboard/outboard", "open-bow-inboard": "Open bow inboard" },
};
export const FURNITURE_NAMES: Record<string, string> = { chair: "Armchair", sofa: "Sofa", loveseat: "Loveseat", recliner: "Recliner", dining_chair: "Dining room chair", ottoman: "Ottoman", booth: "Restaurant booth", marine: "Marine interior", rv: "RV interior" };
export const defaultFurnitureStyle = (type: string) => Object.keys(FURNITURE_STYLES[type] || { classic: "" })[0];
export interface FurniturePanel { id: string; name: string; d: string; labelX: number; labelY: number }
export function furnitureGeometry(type: string, variant: string, view: string): FurniturePanel[] {
  const panels: FurniturePanel[] = [];
  const prefix = `f2:${type}:${variant}:`;
  const add = (id: string, name: string, d: string, x: number, y: number) => panels.push({ id: prefix + id, name, d, labelX: x, labelY: y });
  const box = (id: string, name: string, x: number, y: number, w: number, h: number, radius = 8) => {
    const r = Math.min(radius, w / 2, h / 2);
    add(id, name, `M ${x+r} ${y} L ${x+w-r} ${y} Q ${x+w} ${y} ${x+w} ${y+r} L ${x+w} ${y+h-r} Q ${x+w} ${y+h} ${x+w-r} ${y+h} L ${x+r} ${y+h} Q ${x} ${y+h} ${x} ${y+h-r} L ${x} ${y+r} Q ${x} ${y} ${x+r} ${y} Z`, x+w/2, y+h/2);
  };
  if (type === "marine") {
    // Top-down bowrider upholstery plans. Forward is up; port is viewer's left.
    // Stable IDs intentionally identify the same physical panels across views.
    add("bow-port-back", "Port bow backrest", "M 194 35 Q 125 70 102 150 L 134 150 Q 146 84 198 64 Z",148,97);
    add("bow-starboard-back", "Starboard bow backrest", "M 226 35 Q 295 70 318 150 L 286 150 Q 274 84 222 64 Z",272,97);
    add("bow-port-seat", "Port bow seat cushion", "M 147 114 L 193 80 L 195 205 L 141 205 Z",170,163);
    add("bow-starboard-seat", "Starboard bow seat cushion", "M 273 114 L 227 80 L 225 205 L 279 205 Z",250,163);
    box("bow-filler","Removable bow filler cushion",198,91,24,68,5);
    box("port-console","Passenger console trim",108,224,82,47);
    box("helm","Starboard helm / dash trim",230,224,82,47);
    box("passenger-seat","Passenger seat upholstery",117,289,67,70,17);
    box("helm-seat","Helm seat upholstery",236,289,67,70,17);
    box("port-coaming","Port cockpit side bolster",80,281,27,184);
    box("starboard-coaming","Starboard cockpit side bolster",313,281,27,184);
    if(variant==="open-bow-inboard") {
      box("engine-cover","Center engine box upholstery",177,379,66,108,12);
      box("aft-seat","Rear bench cushion",112,508,196,41);
      box("aft-back","Rear bench backrest",100,558,220,25);
    } else {
      box("aft-seat","Rear bench cushion",118,405,184,56);
      box("aft-back","Rear bench backrest",112,470,196,26);
      box("engine-cover","Aft engine cover / sunpad",104,514,212,69);
    }
    box("swim-platform","Swim platform pad",102,609,216,41);
    return panels;
  }
  if (type === "ottoman") {
    if (variant === "round") {
      if (view !== "top") add("boxing", "Side boxing", "M 92 110 C 92 158 328 158 328 110 L 328 162 C 328 210 92 210 92 162 Z", 210, 167);
      add("top", "Round top", "M 92 108 C 92 48 328 48 328 108 C 328 168 92 168 92 108 Z", 210, 108);
    } else {
      box("top", variant === "storage" ? "Lid upholstery" : "Top cushion", 70, 65, 280, 85, 20);
      if (view !== "top") box(view === "back" ? "rear-boxing" : "front-boxing", view === "back" ? "Rear boxing" : "Front boxing", 75, 154, 270, 40);
      if (variant === "storage") box("hinge", "Hinge / lid seam", 94, 47, 232, 13, 4);
    }
    if (view !== "top") { box("left-foot", "Left foot", view === "back" ? 280 : 105, 198, 35, 18, 3); box("right-foot", "Right foot", view === "back" ? 105 : 280, 198, 35, 18, 3); }
    return panels;
  }
  if (type === "dining_chair") {
    const seatOnly = variant === "seat-only";
    if (view === "back") {
      box("outside-back", seatOnly ? "Exposed back frame" : "Outside back", 137, 25, 146, 120, 16);
      box("rear-rail", "Rear rail", 130, 151, 160, 23, 4);
    } else {
      box("inside-back", seatOnly ? "Exposed back frame" : "Inside back", 137, 25, 146, view === "top" ? 28 : 88, 16);
      box("seat", "Seat upholstery", 120, view === "top" ? 60 : 119, 180, view === "top" ? 135 : 55, 18);
      if (variant === "arms") { box("left-arm", "Left arm", 83, 88, 31, 90); box("right-arm", "Right arm", 306, 88, 31, 90); }
    }
    if (view !== "top") { box("left-leg", "Left leg", view === "back" ? 266 : 135, 181, 19, 58, 4); box("right-leg", "Right leg", view === "back" ? 135 : 266, 181, 19, 58, 4); }
    return panels;
  }
  const wide = type === "sofa" || type === "loveseat";
  const n = type === "sofa" ? variant === "2-cushion" ? 2 : 3 : type === "loveseat" ? 2 : 1;
  const x = wide ? 40 : 110, width = wide ? 340 : 200, inside = width - 68;
  const consoleGap = variant === "console" ? 38 : 0;
  const cushionW = (inside - consoleGap - (n - 1) * 5) / n;
  if (view === "back") {
    box("outside-back", "Outside back upholstery", x + 18, 35, width - 36, 143, 24);
    box("rear-base", "Rear lower panel", x + 20, 182, width - 40, 33);
    box("left-outside", "Left outside arm", x + width - 14, 84, 20, 111);
    box("right-outside", "Right outside arm", x - 6, 84, 20, 111);
  } else {
    for (let i = 0; i < n; i++) {
      const px = x + 34 + i * (cushionW + 5) + (i === 1 ? consoleGap : 0);
      const label = n === 1 ? "" : n === 2 ? i === 0 ? "Left " : "Right " : ["Left ", "Center ", "Right "][i];
      box(`back-${i}`, `${label}back cushion`, px, view === "top" ? 33 : 30, cushionW, view === "top" ? 34 : 75, 12);
      const chaise = variant === "chaise-left" && i === 0 || variant === "chaise-right" && i === n - 1;
      box(`seat-${i}`, chaise ? `${label}chaise cushion` : `${label}seat cushion`, px, view === "top" ? 74 : 111, cushionW, chaise ? (view === "top" ? 162 : 93) : view === "top" ? 105 : 59, 12);
    }
    box("left-arm", "Left arm", x, 76, 28, view === "top" ? 110 : 104, 12);
    box("right-arm", "Right arm", x + width - 28, 76, 28, view === "top" ? 110 : 104, 12);
    if (consoleGap) box("console", "Center console", x + 34 + cushionW + 5, 77, 33, 102);
    if (view === "front") box("front-rail", "Front lower panel", x + 30, variant.startsWith("chaise") ? 211 : 178, width - 60, 29, 5);
    if (type === "recliner") {
      if (variant === "upright") box("footrest", "Closed footrest", x + 35, 211, inside - 2, 25, 6);
      else box("footrest", "Extended footrest", x + 35, 214, inside - 2, 47, 10);
      if (variant === "lift") box("lift-base", "Lift mechanism / base", x + 43, 270, inside - 18, 25, 4);
      box("control", variant === "lift" ? "Lift control" : "Recline control", x + width + 5, 121, 21, 40, 5);
    }
    if (variant === "wingback") {
      add("left-wing", "Left wing", `M ${x} 22 L ${x+29} 35 L ${x+29} 73 L ${x} 61 Z`, x+15, 45);
      add("right-wing", "Right wing", `M ${x+width} 22 L ${x+width-29} 35 L ${x+width-29} 73 L ${x+width} 61 Z`, x+width-15, 45);
    }
  }
  return panels;
}
