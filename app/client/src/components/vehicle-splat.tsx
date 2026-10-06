import { useState } from "react";
import { cn } from "@/lib/utils";

export type VehicleType = "sedan" | "suv" | "pickup";
export type SplatView = "exterior" | "interior";

export interface PanelDamage {
  panelId: string;
  panelName: string;
  damageCount: number;
  severity: "minor" | "moderate" | "severe";
}

interface PanelDef {
  id: string;
  name: string;
  // SVG path or rect coordinates
  d: string;
  labelX: number;
  labelY: number;
}

// ============= SEDAN EXTERIOR PANELS =============
const sedanExteriorPanels: PanelDef[] = [
  // Top view (center column)
  { id: "hood", name: "Hood", d: "M 120 40 L 280 40 L 280 90 L 120 90 Z", labelX: 200, labelY: 68 },
  { id: "windshield", name: "Windshield", d: "M 130 90 L 270 90 L 265 110 L 135 110 Z", labelX: 200, labelY: 102 },
  { id: "roof", name: "Roof", d: "M 135 110 L 265 110 L 265 170 L 135 170 Z", labelX: 200, labelY: 142 },
  { id: "rear-window", name: "Rear Window", d: "M 135 170 L 265 170 L 270 190 L 130 190 Z", labelX: 200, labelY: 182 },
  { id: "trunk", name: "Trunk Lid", d: "M 120 190 L 280 190 L 280 240 L 120 240 Z", labelX: 200, labelY: 217 },
  // Left side (unfolded)
  { id: "lf-fender", name: "LF Fender", d: "M 70 50 L 120 50 L 120 90 L 70 90 Z", labelX: 95, labelY: 72 },
  { id: "lf-door", name: "LF Door", d: "M 70 90 L 120 90 L 120 150 L 70 150 Z", labelX: 95, labelY: 122 },
  { id: "lr-door", name: "LR Door", d: "M 70 150 L 120 150 L 120 210 L 70 210 Z", labelX: 95, labelY: 182 },
  { id: "lr-quarter", name: "LR Quarter", d: "M 70 210 L 120 210 L 120 245 L 70 245 Z", labelX: 95, labelY: 230 },
  // Right side (unfolded)
  { id: "rf-fender", name: "RF Fender", d: "M 280 50 L 330 50 L 330 90 L 280 90 Z", labelX: 305, labelY: 72 },
  { id: "rf-door", name: "RF Door", d: "M 280 90 L 330 90 L 330 150 L 280 150 Z", labelX: 305, labelY: 122 },
  { id: "rr-door", name: "RR Door", d: "M 280 150 L 330 150 L 330 210 L 280 210 Z", labelX: 305, labelY: 182 },
  { id: "rr-quarter", name: "RR Quarter", d: "M 280 210 L 330 210 L 330 245 L 280 245 Z", labelX: 305, labelY: 230 },
  // Bumpers
  { id: "front-bumper", name: "Front Bumper", d: "M 120 35 L 280 35 L 280 45 L 120 45 Z", labelX: 200, labelY: 42 },
  { id: "rear-bumper", name: "Rear Bumper", d: "M 120 240 L 280 240 L 280 250 L 120 250 Z", labelX: 200, labelY: 247 },
];

// ============= SUV EXTERIOR PANELS =============
const suvExteriorPanels: PanelDef[] = [
  // Top view (center column) - longer roof
  { id: "hood", name: "Hood", d: "M 120 40 L 280 40 L 280 80 L 120 80 Z", labelX: 200, labelY: 62 },
  { id: "windshield", name: "Windshield", d: "M 130 80 L 270 80 L 265 95 L 135 95 Z", labelX: 200, labelY: 90 },
  { id: "roof", name: "Roof", d: "M 135 95 L 265 95 L 265 195 L 135 195 Z", labelX: 200, labelY: 147 },
  { id: "rear-window", name: "Rear Window", d: "M 135 195 L 265 195 L 270 210 L 130 210 Z", labelX: 200, labelY: 204 },
  { id: "liftgate", name: "Liftgate", d: "M 120 210 L 280 210 L 280 250 L 120 250 Z", labelX: 200, labelY: 232 },
  // Left side
  { id: "lf-fender", name: "LF Fender", d: "M 70 50 L 120 50 L 120 80 L 70 80 Z", labelX: 95, labelY: 67 },
  { id: "lf-door", name: "LF Door", d: "M 70 80 L 120 80 L 120 140 L 70 140 Z", labelX: 95, labelY: 112 },
  { id: "lr-door", name: "LR Door", d: "M 70 140 L 120 140 L 120 200 L 70 200 Z", labelX: 95, labelY: 172 },
  { id: "lr-quarter", name: "LR Quarter", d: "M 70 200 L 120 200 L 120 245 L 70 245 Z", labelX: 95, labelY: 225 },
  // Right side
  { id: "rf-fender", name: "RF Fender", d: "M 280 50 L 330 50 L 330 80 L 280 80 Z", labelX: 305, labelY: 67 },
  { id: "rf-door", name: "RF Door", d: "M 280 80 L 330 80 L 330 140 L 280 140 Z", labelX: 305, labelY: 112 },
  { id: "rr-door", name: "RR Door", d: "M 280 140 L 330 140 L 330 200 L 280 200 Z", labelX: 305, labelY: 172 },
  { id: "rr-quarter", name: "RR Quarter", d: "M 280 200 L 330 200 L 330 245 L 280 245 Z", labelX: 305, labelY: 225 },
  // Bumpers
  { id: "front-bumper", name: "Front Bumper", d: "M 120 35 L 280 35 L 280 45 L 120 45 Z", labelX: 200, labelY: 42 },
  { id: "rear-bumper", name: "Rear Bumper", d: "M 120 250 L 280 250 L 280 260 L 120 260 Z", labelX: 200, labelY: 257 },
];

// ============= PICKUP EXTERIOR PANELS =============
const pickupExteriorPanels: PanelDef[] = [
  // Top view (center column) - cab + bed
  { id: "hood", name: "Hood", d: "M 120 40 L 280 40 L 280 80 L 120 80 Z", labelX: 200, labelY: 62 },
  { id: "windshield", name: "Windshield", d: "M 130 80 L 270 80 L 265 95 L 135 95 Z", labelX: 200, labelY: 90 },
  { id: "cab-roof", name: "Cab Roof", d: "M 135 95 L 265 95 L 265 155 L 135 155 Z", labelX: 200, labelY: 127 },
  { id: "rear-window", name: "Rear Window", d: "M 135 155 L 265 155 L 270 170 L 130 170 Z", labelX: 200, labelY: 165 },
  { id: "tailgate", name: "Tailgate", d: "M 120 230 L 280 230 L 280 250 L 120 250 Z", labelX: 200, labelY: 242 },
  // Left side
  { id: "lf-fender", name: "LF Fender", d: "M 70 50 L 120 50 L 120 80 L 70 80 Z", labelX: 95, labelY: 67 },
  { id: "lf-door", name: "LF Door", d: "M 70 80 L 120 80 L 120 155 L 70 155 Z", labelX: 95, labelY: 120 },
  { id: "bed-side-l", name: "Bed Side (L)", d: "M 70 170 L 120 170 L 120 245 L 70 245 Z", labelX: 95, labelY: 210 },
  // Right side
  { id: "rf-fender", name: "RF Fender", d: "M 280 50 L 330 50 L 330 80 L 280 80 Z", labelX: 305, labelY: 67 },
  { id: "rf-door", name: "RF Door", d: "M 280 80 L 330 80 L 330 155 L 280 155 Z", labelX: 305, labelY: 120 },
  { id: "bed-side-r", name: "Bed Side (R)", d: "M 280 170 L 330 170 L 330 245 L 280 245 Z", labelX: 305, labelY: 210 },
  // Bed floor + bumpers
  { id: "bed-floor", name: "Bed Floor", d: "M 120 170 L 280 170 L 280 230 L 120 230 Z", labelX: 200, labelY: 202 },
  { id: "front-bumper", name: "Front Bumper", d: "M 120 35 L 280 35 L 280 45 L 120 45 Z", labelX: 200, labelY: 42 },
  { id: "rear-bumper", name: "Rear Bumper", d: "M 120 250 L 280 250 L 280 260 L 120 260 Z", labelX: 200, labelY: 257 },
];

// ============= INTERIOR PANELS (shared across vehicle types) =============
const interiorPanels: PanelDef[] = [
  // Dashboard
  { id: "dashboard", name: "Dashboard", d: "M 80 40 L 320 40 L 320 65 L 80 65 Z", labelX: 200, labelY: 55 },
  // Steering wheel
  { id: "steering-wheel", name: "Steering Wheel", d: "M 170 75 L 230 75 L 230 105 L 170 105 Z", labelX: 200, labelY: 92 },
  // Front seats
  { id: "front-seat-l", name: "Front Seat (L)", d: "M 100 115 L 185 115 L 185 175 L 100 175 Z", labelX: 142, labelY: 148 },
  { id: "front-seat-r", name: "Front Seat (R)", d: "M 215 115 L 300 115 L 300 175 L 215 175 Z", labelX: 257, labelY: 148 },
  // Rear seats
  { id: "rear-seat-l", name: "Rear Seat (L)", d: "M 100 185 L 185 185 L 185 235 L 100 235 Z", labelX: 142, labelY: 212 },
  { id: "rear-seat-r", name: "Rear Seat (R)", d: "M 215 185 L 300 185 L 300 235 L 215 235 Z", labelX: 257, labelY: 212 },
  // Door panels
  { id: "door-panel-lf", name: "Door Panel (LF)", d: "M 40 115 L 75 115 L 75 175 L 40 175 Z", labelX: 57, labelY: 148 },
  { id: "door-panel-rf", name: "Door Panel (RF)", d: "M 325 115 L 360 115 L 360 175 L 325 175 Z", labelX: 342, labelY: 148 },
  { id: "door-panel-lr", name: "Door Panel (LR)", d: "M 40 185 L 75 185 L 75 235 L 40 235 Z", labelX: 57, labelY: 212 },
  { id: "door-panel-rr", name: "Door Panel (RR)", d: "M 325 185 L 360 185 L 360 235 L 325 235 Z", labelX: 342, labelY: 212 },
  // Headliner
  { id: "headliner", name: "Headliner", d: "M 80 5 L 320 5 L 320 30 L 80 30 Z", labelX: 200, labelY: 20 },
  // Center console
  { id: "center-console", name: "Center Console", d: "M 190 115 L 210 115 L 210 235 L 190 235 Z", labelX: 200, labelY: 177 },
];

const severityColors: Record<string, string> = {
  none: "fill-muted/30 stroke-border",
  minor: "fill-chart-3/20 stroke-chart-3",
  moderate: "fill-chart-4/30 stroke-chart-4",
  severe: "fill-destructive/30 stroke-destructive",
};

const severityTextColors: Record<string, string> = {
  none: "fill-muted-foreground",
  minor: "fill-chart-3",
  moderate: "fill-chart-4",
  severe: "fill-destructive",
};

interface VehicleSplatProps {
  vehicleType: VehicleType;
  view: SplatView;
  damages: PanelDamage[];
  onPanelClick?: (panelId: string, panelName: string) => void;
  selectedPanel?: string | null;
}

export function VehicleSplat({ vehicleType, view, damages, onPanelClick, selectedPanel }: VehicleSplatProps) {
  const [hoveredPanel, setHoveredPanel] = useState<string | null>(null);

  let panels: PanelDef[];
  let viewBox: string;

  if (view === "interior") {
    panels = interiorPanels;
    viewBox = "0 0 400 250";
  } else {
    switch (vehicleType) {
      case "sedan":
        panels = sedanExteriorPanels;
        viewBox = "0 0 400 270";
        break;
      case "suv":
        panels = suvExteriorPanels;
        viewBox = "0 0 400 270";
        break;
      case "pickup":
        panels = pickupExteriorPanels;
        viewBox = "0 0 400 270";
        break;
    }
  }

  const damageMap = new Map(damages.map((d) => [d.panelId, d]));

  // Crop the viewBox to the drawn panels so the splat fills the screen (important on phones)
  {
    const nums = panels.flatMap((p) => (p.d.match(/-?\d+(\.\d+)?/g) || []).map(Number));
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    if (xs.length && ys.length) {
      const pad = 14;
      const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
      const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
      viewBox = `${minX} ${minY} ${w} ${h}`;
    }
  }

  const getSeverity = (panelId: string): string => {
    const damage = damageMap.get(panelId);
    return damage ? damage.severity : "none";
  };

  const getDamageCount = (panelId: string): number => {
    return damageMap.get(panelId)?.damageCount || 0;
  };

  return (
    <div className="w-full">
      <svg viewBox={viewBox} className="w-full h-auto" style={{ maxHeight: "380px" }} data-testid={`svg-splat-${vehicleType}-${view}`}>
        {/* Panel shapes */}
        {panels.map((panel) => {
          const severity = getSeverity(panel.id);
          const damageCount = getDamageCount(panel.id);
          const isHovered = hoveredPanel === panel.id;
          const isSelected = selectedPanel === panel.id;
          const isDamaged = damageCount > 0;

          return (
            <g key={panel.id}>
              <path
                d={panel.d}
                className={cn(
                  "transition-all cursor-pointer",
                  severityColors[severity],
                  isHovered && "brightness-110",
                  isSelected && "ring-2 ring-primary ring-offset-1"
                )}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={isDamaged ? "0" : "2,2"}
                onClick={() => onPanelClick?.(panel.id, panel.name)}
                role="button"
                tabIndex={0}
                aria-label={panel.name}
                aria-pressed={isSelected}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onPanelClick?.(panel.id,panel.name);}}}
                onMouseEnter={() => setHoveredPanel(panel.id)}
                onMouseLeave={() => setHoveredPanel(null)}
                data-testid={`panel-${panel.id}`}
              />
              {/* Panel label */}
              <text
                x={panel.labelX}
                y={panel.labelY}
                textAnchor="middle"
                className={cn(
                  "text-[8px] font-medium pointer-events-none",
                  severityTextColors[severity]
                )}
                style={{ fontSize: "8px" }}
              >
                {panel.name}
              </text>
              {/* Damage count badge */}
              {isDamaged && (
                <g>
                  <circle
                    cx={panel.labelX + 35}
                    cy={panel.labelY - 5}
                    r="7"
                    className="fill-destructive stroke-white"
                    strokeWidth="1"
                  />
                  <text
                    x={panel.labelX + 35}
                    y={panel.labelY - 2}
                    textAnchor="middle"
                    className="fill-white font-bold pointer-events-none"
                    style={{ fontSize: "8px" }}
                  >
                    {damageCount}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-2"><summary className="cursor-pointer text-sm py-2">Choose panel by name ({panels.length})</summary><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{panels.map(panel=><button key={panel.id} data-testid={`vpanel-option-${panel.id}`} type="button" onClick={()=>onPanelClick?.(panel.id,panel.name)} aria-pressed={selectedPanel===panel.id} className={cn("min-h-11 rounded-md border px-2 py-2 text-left text-xs",selectedPanel===panel.id?"border-primary bg-primary/10":"border-border")}>{panel.name}{getDamageCount(panel.id)>0&&<span className="block text-primary">{getDamageCount(panel.id)} marked</span>}</button>)}</div></details>
    </div>
  );
}

export { sedanExteriorPanels, suvExteriorPanels, pickupExteriorPanels, interiorPanels };
