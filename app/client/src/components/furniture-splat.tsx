import { useState } from "react";
import { cn } from "@/lib/utils";
import { furnitureGeometry, defaultFurnitureStyle, FURNITURE_STYLES } from "@/lib/furniture-geometry";

export type FurnitureType = "chair" | "sofa" | "loveseat" | "recliner" | "dining_chair" | "ottoman" | "booth" | "marine" | "rv";
export type FurnitureView = "front" | "top" | "back";

export interface PanelDamage {
  panelId: string;
  panelName: string;
  damageCount: number;
  severity: "minor" | "moderate" | "severe";
}

interface PanelDef {
  id: string;
  name: string;
  d: string;
  labelX: number;
  labelY: number;
}

// ============= CHAIR PANELS (front view) =============
const chairFrontPanels: PanelDef[] = [
  // Backrest
  { id: "back-rest", name: "Back Rest", d: "M 130 30 L 270 30 L 270 100 L 130 100 Z", labelX: 200, labelY: 68 },
  // Left arm
  { id: "left-arm", name: "Left Arm", d: "M 100 80 L 135 80 L 135 180 L 100 180 Z", labelX: 117, labelY: 132 },
  // Right arm
  { id: "right-arm", name: "Right Arm", d: "M 265 80 L 300 80 L 300 180 L 265 180 Z", labelX: 282, labelY: 132 },
  // Seat cushion
  { id: "seat-cushion", name: "Seat Cushion", d: "M 135 100 L 265 100 L 265 170 L 135 170 Z", labelX: 200, labelY: 138 },
  // Seat seam (horizontal) — thin strip inside cushion, label offset to avoid overlap
  { id: "seat-seam-h", name: "Seat Seam", d: "M 135 135 L 265 135 L 265 140 L 135 140 Z", labelX: 200, labelY: 148 },
  // Piping (left) — label moved down to avoid overlap with Left Arm
  { id: "piping-left", name: "Piping (L)", d: "M 135 100 L 140 100 L 140 170 L 135 170 Z", labelX: 137, labelY: 158 },
  // Piping (right) — label moved down to avoid overlap with Right Arm
  { id: "piping-right", name: "Piping (R)", d: "M 260 100 L 265 100 L 265 170 L 260 170 Z", labelX: 262, labelY: 158 },
  // Base/legs
  { id: "base", name: "Base/Legs", d: "M 100 180 L 300 180 L 300 200 L 100 200 Z", labelX: 200, labelY: 192 },
  // Front edge
  { id: "front-edge", name: "Front Edge", d: "M 135 168 L 265 168 L 265 175 L 135 175 Z", labelX: 200, labelY: 173 },
];

// ============= SOFA PANELS (front view) =============
const sofaFrontPanels: PanelDef[] = [
  // Backrest (full width)
  { id: "backrest", name: "Backrest", d: "M 60 30 L 340 30 L 340 95 L 60 95 Z", labelX: 200, labelY: 65 },
  // Left arm
  { id: "sofa-left-arm", name: "Left Arm", d: "M 40 60 L 70 60 L 70 190 L 40 190 Z", labelX: 55, labelY: 128 },
  // Right arm
  { id: "sofa-right-arm", name: "Right Arm", d: "M 330 60 L 360 60 L 360 190 L 330 190 Z", labelX: 345, labelY: 128 },
  // Left seat cushion
  { id: "left-cushion", name: "Left Cushion", d: "M 70 95 L 150 95 L 150 170 L 70 170 Z", labelX: 110, labelY: 135 },
  // Center seat cushion
  { id: "center-cushion", name: "Center Cushion", d: "M 150 95 L 250 95 L 250 170 L 150 170 Z", labelX: 200, labelY: 135 },
  // Right seat cushion
  { id: "right-cushion", name: "Right Cushion", d: "M 250 95 L 330 95 L 330 170 L 250 170 Z", labelX: 290, labelY: 135 },
  // Seam between cushions (left-center) — offset down to avoid overlap
  { id: "seam-lc", name: "Seam L-C", d: "M 148 95 L 152 95 L 152 170 L 148 170 Z", labelX: 150, labelY: 155 },
  // Seam between cushions (center-right) — offset down to avoid overlap
  { id: "seam-cr", name: "Seam C-R", d: "M 248 95 L 252 95 L 252 170 L 248 170 Z", labelX: 250, labelY: 155 },
  // Base/frame
  { id: "sofa-base", name: "Base/Frame", d: "M 40 190 L 360 190 L 360 210 L 40 210 Z", labelX: 200, labelY: 202 },
  // Backrest seam — offset down to avoid overlap with Backrest label
  { id: "backrest-seam", name: "Backrest Seam", d: "M 60 70 L 340 70 L 340 73 L 60 73 Z", labelX: 200, labelY: 83 },
  // Front edge
  { id: "sofa-front-edge", name: "Front Edge", d: "M 70 168 L 330 168 L 330 175 L 70 175 Z", labelX: 200, labelY: 173 },
];

// ============= RESTAURANT BOOTH PANELS (side view) =============
const boothSidePanels: PanelDef[] = [
  // Booth back (tall vertical panel)
  { id: "booth-back", name: "Booth Back", d: "M 80 30 L 150 30 L 150 130 L 80 130 Z", labelX: 115, labelY: 82 },
  // Booth seat (horizontal)
  { id: "booth-seat", name: "Booth Seat", d: "M 80 130 L 280 130 L 280 170 L 80 170 Z", labelX: 180, labelY: 152 },
  // End cap (left - where back meets seat)
  { id: "end-cap-left", name: "End Cap (L)", d: "M 75 30 L 85 30 L 85 170 L 75 170 Z", labelX: 80, labelY: 102 },
  // End cap (right)
  { id: "end-cap-right", name: "End Cap (R)", d: "M 275 130 L 285 130 L 285 175 L 275 175 Z", labelX: 280, labelY: 155 },
  // Base/kick plate (under seat)
  { id: "kick-plate", name: "Kick Plate", d: "M 80 170 L 280 170 L 280 195 L 80 195 Z", labelX: 180, labelY: 184 },
  // Seam (back to seat junction)
  { id: "seam-back-seat", name: "Back-Seat Seam", d: "M 80 127 L 280 127 L 280 132 L 80 132 Z", labelX: 180, labelY: 131 },
  // Seam (seat to kick plate)
  { id: "seam-seat-base", name: "Seat-Base Seam", d: "M 80 167 L 280 167 L 280 172 L 80 172 Z", labelX: 180, labelY: 171 },
  // Seat cushion top — offset to avoid overlap with Booth Seat label
  { id: "cushion-top", name: "Cushion Top", d: "M 150 130 L 280 130 L 280 145 L 150 145 Z", labelX: 215, labelY: 139 },
  // Back padding — offset to avoid overlap with Booth Back
  { id: "back-padding", name: "Back Padding", d: "M 80 30 L 150 30 L 150 127 L 80 127 Z", labelX: 115, labelY: 60 },
];

// ============= CHAIR TOP VIEW =============
const chairTopPanels: PanelDef[] = [
  { id: "top-back-rest", name: "Back Rest", d: "M 120 40 L 280 40 L 280 80 L 120 80 Z", labelX: 200, labelY: 62 },
  { id: "top-seat", name: "Seat", d: "M 120 80 L 280 80 L 280 170 L 120 170 Z", labelX: 200, labelY: 128 },
  { id: "top-left-arm", name: "Left Arm", d: "M 95 50 L 125 50 L 125 170 L 95 170 Z", labelX: 110, labelY: 112 },
  { id: "top-right-arm", name: "Right Arm", d: "M 275 50 L 305 50 L 305 170 L 275 170 Z", labelX: 290, labelY: 112 },
  { id: "top-cushion", name: "Cushion", d: "M 125 80 L 275 80 L 275 165 L 125 165 Z", labelX: 200, labelY: 100 },
  { id: "top-seam", name: "Seat Seam", d: "M 125 120 L 275 120 L 275 124 L 125 124 Z", labelX: 200, labelY: 145 },
];

// ============= SOFA TOP VIEW =============
const sofaTopPanels: PanelDef[] = [
  { id: "top-backrest", name: "Backrest", d: "M 50 30 L 350 30 L 350 70 L 50 70 Z", labelX: 200, labelY: 52 },
  { id: "top-l-arm", name: "Left Arm", d: "M 30 40 L 55 40 L 55 170 L 30 170 Z", labelX: 42, labelY: 107 },
  { id: "top-r-arm", name: "Right Arm", d: "M 345 40 L 370 40 L 370 170 L 345 170 Z", labelX: 357, labelY: 107 },
  { id: "top-l-cushion", name: "Left Cushion", d: "M 55 70 L 150 70 L 150 165 L 55 165 Z", labelX: 102, labelY: 120 },
  { id: "top-c-cushion", name: "Center Cushion", d: "M 150 70 L 250 70 L 250 165 L 150 165 Z", labelX: 200, labelY: 120 },
  { id: "top-r-cushion", name: "Right Cushion", d: "M 250 70 L 345 70 L 345 165 L 250 165 Z", labelX: 297, labelY: 120 },
  { id: "top-seam-lc", name: "Seam L-C", d: "M 148 70 L 152 70 L 152 165 L 148 165 Z", labelX: 150, labelY: 150 },
  { id: "top-seam-cr", name: "Seam C-R", d: "M 248 70 L 252 70 L 252 165 L 248 165 Z", labelX: 250, labelY: 150 },
];

// ============= BOOTH TOP VIEW =============
const boothTopPanels: PanelDef[] = [
  { id: "top-booth-back", name: "Booth Back", d: "M 60 30 L 120 30 L 120 190 L 60 190 Z", labelX: 90, labelY: 112 },
  { id: "top-booth-seat", name: "Booth Seat", d: "M 120 30 L 340 30 L 340 190 L 120 190 Z", labelX: 230, labelY: 112 },
  { id: "top-booth-cushion", name: "Cushion", d: "M 125 35 L 335 35 L 335 185 L 125 185 Z", labelX: 230, labelY: 60 },
  { id: "top-booth-seam1", name: "Seam 1", d: "M 120 80 L 340 80 L 340 84 L 120 84 Z", labelX: 230, labelY: 100 },
  { id: "top-booth-seam2", name: "Seam 2", d: "M 120 130 L 340 130 L 340 134 L 120 134 Z", labelX: 230, labelY: 160 },
  { id: "top-end-cap-l", name: "End Cap (L)", d: "M 55 30 L 65 30 L 65 190 L 55 190 Z", labelX: 60, labelY: 90 },
  { id: "top-end-cap-r", name: "End Cap (R)", d: "M 335 30 L 345 30 L 345 190 L 335 190 Z", labelX: 340, labelY: 90 },
];

const severityColors: Record<string, string> = {
  none: "fill-muted/30 stroke-border",
  minor: "fill-chart-3/20 stroke-chart-3",
  moderate: "fill-chart-4/30 stroke-chart-4",
  severe: "fill-destructive/30 stroke-destructive",
};

// ============= MARINE INTERIOR — CABIN SIDE VIEW =============
// Side elevation of a boat cabin showing interior panels
const marineSidePanels: PanelDef[] = [
  // Bow section (V-berth area)
  { id: "m-vberth-cushion", name: "V-Berth Cushion", d: "M 40 80 L 130 60 L 130 120 L 40 130 Z", labelX: 85, labelY: 100 },
  { id: "m-vberth-back", name: "V-Berth Back", d: "M 40 60 L 130 40 L 130 60 L 40 80 Z", labelX: 85, labelY: 55 },
  // Cabin side panel (port)
  { id: "m-side-panel-port", name: "Side Panel (Port)", d: "M 130 40 L 300 40 L 300 130 L 130 130 Z", labelX: 215, labelY: 85 },
  // Salon settee
  { id: "m-settee-cushion", name: "Settee Cushion", d: "M 130 130 L 300 130 L 300 165 L 130 165 Z", labelX: 215, labelY: 150 },
  { id: "m-settee-back", name: "Settee Back", d: "M 130 120 L 300 120 L 300 130 L 130 130 Z", labelX: 215, labelY: 127 },
  // Helm station
  { id: "m-helm-dash", name: "Helm Dashboard", d: "M 300 80 L 370 70 L 370 110 L 300 110 Z", labelX: 335, labelY: 92 },
  { id: "m-helm-panel", name: "Helm Panel", d: "M 300 40 L 370 35 L 370 70 L 300 80 Z", labelX: 335, labelY: 57 },
  // Headliner (ceiling)
  { id: "m-headliner", name: "Headliner", d: "M 40 35 L 130 25 L 300 25 L 370 30 L 370 40 L 300 40 L 130 40 L 40 50 Z", labelX: 200, labelY: 35 },
  // Cabin sole (floor) — label moved to avoid overlap with Settee Cushion
  { id: "m-sole", name: "Cabin Sole", d: "M 40 130 L 130 130 L 300 165 L 300 175 L 130 175 L 40 140 Z", labelX: 170, labelY: 168 },
  // Companionway
  { id: "m-companionway", name: "Companionway", d: "M 300 110 L 370 110 L 370 130 L 300 130 Z", labelX: 335, labelY: 122 },
  // Window
  { id: "m-window", name: "Portlight", d: "M 180 55 L 240 55 L 240 75 L 180 75 Z", labelX: 210, labelY: 67 },
  // Forward hatch (overhead at bow)
  { id: "m-fwd-hatch", name: "Fwd Hatch", d: "M 55 18 L 110 18 L 110 24 L 55 24 Z", labelX: 82, labelY: 22 },
  // Cabin door (entry door on side panel)
  { id: "m-cabin-door", name: "Cabin Door", d: "M 140 65 L 170 65 L 170 110 L 140 110 Z", labelX: 155, labelY: 90 },
  // Galley counter (kitchen counter side view)
  { id: "m-galley-counter", name: "Galley Counter", d: "M 230 95 L 295 95 L 295 115 L 230 115 Z", labelX: 262, labelY: 108 },
  // Nav station (navigation/electronics area below companionway)
  { id: "m-nav-station", name: "Nav Station", d: "M 300 130 L 370 130 L 370 165 L 300 165 Z", labelX: 335, labelY: 148 },
  // Quarter berth (aft sleeping berth)
  { id: "m-quarter-berth", name: "Quarter Berth", d: "M 300 95 L 370 95 L 370 130 L 300 130 Z", labelX: 335, labelY: 108 },
  // Engine access panel (floor hatch for engine room)
  { id: "m-engine-access", name: "Engine Access", d: "M 200 165 L 280 165 L 280 175 L 200 175 Z", labelX: 240, labelY: 172 },
  // Stowage cabinet (upper cabinet on side panel)
  { id: "m-stowage", name: "Stowage", d: "M 140 40 L 200 40 L 200 60 L 140 60 Z", labelX: 170, labelY: 52 },
  // Hanging locker (forward storage closet)
  { id: "m-hanging-locker", name: "Hang Locker", d: "M 40 130 L 80 130 L 80 165 L 40 165 Z", labelX: 60, labelY: 148 },
];

// ============= MARINE INTERIOR — TOP VIEW (floor plan) =============
const marineTopPanels: PanelDef[] = [
  // V-Berth (bow)
  { id: "m-vberth-l", name: "V-Berth (L)", d: "M 60 30 L 120 30 L 110 90 L 50 90 Z", labelX: 75, labelY: 60 },
  { id: "mt-vberth-r", name: "V-Berth (R)", d: "M 120 30 L 180 30 L 190 90 L 110 90 Z", labelX: 160, labelY: 60 },
  { id: "mt-vberth-seam", name: "V-Berth Seam", d: "M 110 30 L 115 30 L 110 90 L 105 90 Z", labelX: 112, labelY: 80 },
  // Head (bathroom)
  { id: "mt-head", name: "Head", d: "M 180 30 L 230 30 L 230 70 L 180 70 Z", labelX: 205, labelY: 50 },
  // Salon settees (port and starboard)
  { id: "mt-settee-port", name: "Settee (Port)", d: "M 40 90 L 120 90 L 120 140 L 40 140 Z", labelX: 80, labelY: 115 },
  { id: "mt-settee-stbd", name: "Settee (Stbd)", d: "M 180 90 L 260 90 L 260 140 L 180 140 Z", labelX: 220, labelY: 115 },
  // Salon table
  { id: "mt-table", name: "Salon Table", d: "M 120 100 L 180 100 L 180 130 L 120 130 Z", labelX: 150, labelY: 115 },
  // Galley (kitchen)
  { id: "mt-galley", name: "Galley", d: "M 230 70 L 300 70 L 300 110 L 230 110 Z", labelX: 265, labelY: 90 },
  // Helm station
  { id: "mt-helm", name: "Helm Station", d: "M 260 140 L 320 140 L 320 175 L 260 175 Z", labelX: 290, labelY: 158 },
  // Companionway steps
  { id: "mt-companionway", name: "Companionway", d: "M 300 110 L 320 110 L 320 140 L 300 140 Z", labelX: 310, labelY: 125 },
  // Cockpit
  { id: "mt-cockpit", name: "Cockpit", d: "M 260 175 L 350 175 L 350 200 L 260 200 Z", labelX: 305, labelY: 188 },
  // Quarter berth (aft sleeping berth)
  { id: "mt-quarter-berth", name: "Quarter Berth", d: "M 300 70 L 370 70 L 370 110 L 300 110 Z", labelX: 335, labelY: 90 },
  // Hanging locker (storage closet near head)
  { id: "mt-hanging-locker", name: "Hang Locker", d: "M 230 30 L 260 30 L 260 70 L 230 70 Z", labelX: 245, labelY: 50 },
  // Nav station (navigation/electronics desk)
  { id: "mt-nav-station", name: "Nav Station", d: "M 320 140 L 370 140 L 370 175 L 320 175 Z", labelX: 345, labelY: 158 },
  // Forward hatch (overhead hatch at bow)
  { id: "mt-fwd-hatch", name: "Fwd Hatch", d: "M 70 30 L 110 30 L 110 40 L 70 40 Z", labelX: 90, labelY: 33 },
  // Engine access (floor panel for engine room)
  { id: "mt-engine-access", name: "Engine Access", d: "M 120 140 L 180 140 L 180 175 L 120 175 Z", labelX: 150, labelY: 158 },
  // Anchor locker (chain locker at bow)
  { id: "mt-anchor-locker", name: "Anchor Locker", d: "M 50 30 L 70 30 L 70 50 L 50 50 Z", labelX: 60, labelY: 48 },
  // Shower (within head compartment)
  { id: "mt-shower", name: "Shower", d: "M 210 50 L 230 50 L 230 70 L 210 70 Z", labelX: 220, labelY: 65 },
  // Swim platform (at transom)
  { id: "mt-swim-platform", name: "Swim Platform", d: "M 260 200 L 350 200 L 350 215 L 260 215 Z", labelX: 305, labelY: 210 },
];

// ============= RV INTERIOR — SIDE VIEW =============
// Side elevation of a motorhome/RV interior
const rvSidePanels: PanelDef[] = [
  // Cab section
  { id: "r-windshield", name: "Windshield", d: "M 30 40 L 70 30 L 70 70 L 30 75 Z", labelX: 50, labelY: 55 },
  { id: "r-driver-dash", name: "Driver Dashboard", d: "M 30 75 L 70 70 L 100 70 L 100 100 L 30 100 Z", labelX: 65, labelY: 88 },
  { id: "r-driver-seat", name: "Drv. Seat", d: "M 30 100 L 70 100 L 70 130 L 30 130 Z", labelX: 50, labelY: 110 },
  { id: "r-passenger-seat", name: "Pass. Seat", d: "M 70 100 L 100 100 L 100 130 L 70 130 Z", labelX: 85, labelY: 122 },
  // Cab-over bunk
  { id: "r-cabover-bunk", name: "Cab-Over Bunk", d: "M 30 30 L 70 20 L 70 40 L 30 40 Z", labelX: 50, labelY: 30 },
  // Slide-out wall
  { id: "r-slide-wall", name: "Slide-Out Wall", d: "M 100 40 L 130 35 L 130 175 L 100 175 Z", labelX: 115, labelY: 105 },
  // Sofa/bed
  { id: "r-sofa-bed", name: "Sofa/Bed", d: "M 130 100 L 200 100 L 200 140 L 130 140 Z", labelX: 165, labelY: 122 },
  // Dinette
  { id: "r-dinette-seat", name: "Dinette Seat", d: "M 130 140 L 200 140 L 200 170 L 130 170 Z", labelX: 165, labelY: 157 },
  { id: "r-dinette-table", name: "Dinette Table", d: "M 145 140 L 185 140 L 185 170 L 145 170 Z", labelX: 165, labelY: 168 },
  // Kitchen galley
  { id: "r-galley-counter", name: "Galley Counter", d: "M 200 100 L 250 100 L 250 140 L 200 140 Z", labelX: 225, labelY: 122 },
  { id: "r-galley-back", name: "Galley Backsplash", d: "M 200 90 L 250 90 L 250 100 L 200 100 Z", labelX: 225, labelY: 96 },
  // Bathroom
  { id: "r-bath-wall", name: "Bath Wall", d: "M 250 100 L 300 100 L 300 140 L 250 140 Z", labelX: 275, labelY: 118 },
  { id: "r-bath-door", name: "Bath Door", d: "M 260 100 L 280 100 L 280 140 L 260 140 Z", labelX: 270, labelY: 132 },
  // Bedroom (rear)
  { id: "r-bedroom-wall", name: "Bedroom Wall", d: "M 300 100 L 370 100 L 370 175 L 300 175 Z", labelX: 335, labelY: 115 },
  { id: "r-bed", name: "Rear Bed", d: "M 300 130 L 370 130 L 370 175 L 300 175 Z", labelX: 335, labelY: 155 },
  // Ceiling/headliner
  { id: "r-headliner", name: "Headliner", d: "M 100 30 L 130 25 L 370 25 L 370 35 L 130 35 L 100 40 Z", labelX: 235, labelY: 32 },
  // Floor
  { id: "r-floor", name: "Floor", d: "M 30 170 L 370 170 L 370 185 L 30 185 Z", labelX: 200, labelY: 180 },
];

// ============= RV INTERIOR — TOP VIEW (floor plan) =============
const rvTopPanels: PanelDef[] = [
  // Cab-over bunk
  { id: "rt-cabover", name: "Cab-Over Bunk", d: "M 40 30 L 100 30 L 100 60 L 40 60 Z", labelX: 70, labelY: 45 },
  // Cab seats
  { id: "rt-driver-seat", name: "Driver", d: "M 40 60 L 70 60 L 70 90 L 40 90 Z", labelX: 55, labelY: 68 },
  { id: "rt-pass-seat", name: "Passenger", d: "M 70 60 L 100 60 L 100 90 L 70 90 Z", labelX: 85, labelY: 82 },
  // Dashboard
  { id: "rt-dash", name: "Dashboard", d: "M 40 90 L 100 90 L 100 110 L 40 110 Z", labelX: 70, labelY: 100 },
  // Living area - sofa
  { id: "rt-sofa", name: "Sofa/Bed", d: "M 100 30 L 160 30 L 160 70 L 100 70 Z", labelX: 130, labelY: 50 },
  // Dinette
  { id: "rt-dinette", name: "Dinette", d: "M 100 70 L 160 70 L 160 120 L 100 120 Z", labelX: 130, labelY: 95 },
  { id: "rt-dinette-table", name: "Table", d: "M 115 80 L 145 80 L 145 110 L 115 110 Z", labelX: 130, labelY: 108 },
  // Kitchen
  { id: "rt-galley", name: "Galley", d: "M 160 30 L 220 30 L 220 70 L 160 70 Z", labelX: 190, labelY: 50 },
  // Bathroom
  { id: "rt-bathroom", name: "Bathroom", d: "M 160 70 L 220 70 L 220 120 L 160 120 Z", labelX: 190, labelY: 95 },
  // Hallway
  { id: "rt-hallway", name: "Hallway", d: "M 160 120 L 220 120 L 220 140 L 160 140 Z", labelX: 190, labelY: 130 },
  // Bedroom
  { id: "rt-bedroom", name: "Bedroom", d: "M 220 30 L 370 30 L 370 140 L 220 140 Z", labelX: 295, labelY: 60 },
  { id: "rt-bed", name: "Bed", d: "M 240 50 L 360 50 L 360 120 L 240 120 Z", labelX: 300, labelY: 90 },
  { id: "rt-closet", name: "Closet", d: "M 220 30 L 370 30 L 370 45 L 220 45 Z", labelX: 295, labelY: 38 },
];

const severityTextColors: Record<string, string> = {
  none: "fill-muted-foreground",
  minor: "fill-chart-3",
  moderate: "fill-chart-4",
  severe: "fill-destructive",
};

interface FurnitureSplatProps {
  furnitureType: FurnitureType;
  view: FurnitureView;
  damages: PanelDamage[];
  onPanelClick?: (panelId: string, panelName: string) => void;
  selectedPanel?: string | null;
}

export function FurnitureSplat({ furnitureType, view, damages, onPanelClick, selectedPanel, variant }: FurnitureSplatProps & { variant?: string }) {
  const [hoveredPanel, setHoveredPanel] = useState<string | null>(null);
  const style = variant || defaultFurnitureStyle(furnitureType);
  const modern = !!FURNITURE_STYLES[furnitureType] && style !== "classic";

  let panels: PanelDef[] = [];
  let viewBox = "0 0 400 220";

  if (furnitureType === "chair") {
    panels = view === "front" ? chairFrontPanels : chairTopPanels;
    viewBox = view === "front" ? "0 0 400 220" : "0 0 400 220";
  } else if (furnitureType === "sofa") {
    panels = view === "front" ? sofaFrontPanels : sofaTopPanels;
    viewBox = view === "front" ? "0 0 400 220" : "0 0 400 220";
  } else if (furnitureType === "booth") {
    panels = view === "front" ? boothSidePanels : boothTopPanels;
    viewBox = view === "front" ? "0 0 400 220" : "0 0 400 220";
  } else if (furnitureType === "marine") {
    panels = view === "front" ? marineSidePanels : marineTopPanels;
    viewBox = "0 0 400 220";
  } else if (furnitureType === "rv") {
    panels = view === "front" ? rvSidePanels : rvTopPanels;
    viewBox = "0 0 400 220";
  }
  if (modern) panels = furnitureGeometry(furnitureType, style, view);

  const damageMap = new Map(damages.map((d) => [d.panelId, d]));

  // Crop the viewBox to the drawn panels so the splat fills the screen (important on phones)
  {
    const nums = panels.flatMap((p: any) => (String(p.d).match(/-?\d+(\.\d+)?/g) || []).map(Number));
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    if (xs.length && ys.length) {
      const pad = 14;
      const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
      viewBox = `${minX} ${minY} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;
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
      {modern && <p className="text-xs text-muted-foreground mb-2">{furnitureType==="marine" ? `${FURNITURE_STYLES.marine[style]}. Bow is at the top; port is left and starboard is right. ${style==="open-bow-inboard"?"Representative direct-drive layout with a center engine box, not a V-drive layout.":"Representative sterndrive layout with an aft engine cover / sunpad."} Verify the actual boat before quoting.` : "Schematic, not to scale. Left/right always refer to facing the front of the piece."} Tap a numbered part or use the buttons below. Marks stay with the same part across views.</p>}
      <svg viewBox={furnitureType==="marine"&&modern?"45 0 330 685":viewBox} className="w-full h-auto" style={{ maxHeight: furnitureType==="marine"&&modern?"650px":"380px" }} data-testid={`svg-furniture-${furnitureType}-${view}`}>
        {furnitureType==="marine"&&modern&&<g aria-hidden="true" className="pointer-events-none"><path d="M 210 20 Q 80 63 66 251 L 66 569 Q 66 598 94 599 L 326 599 Q 354 598 354 569 L 354 251 Q 340 63 210 20 Z" className="fill-background stroke-muted-foreground" strokeWidth="2"/><path d="M 106 214 L 190 214 M 230 214 L 314 214" className="stroke-primary" strokeWidth="5"/><text x="210" y="16" textAnchor="middle" className="fill-foreground" fontSize="12">BOW</text><text x="210" y="678" textAnchor="middle" className="fill-foreground" fontSize="12">STERN</text></g>}
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
                  modern && severity === "none" && "fill-muted/70 stroke-muted-foreground",
                  isHovered && "brightness-110",
                  isSelected && "ring-2 ring-primary ring-offset-1"
                )}
                strokeWidth={isSelected ? 2.5 : modern ? 1.5 : 1}
                strokeDasharray={isDamaged || modern ? "0" : "2,2"}
                onClick={() => onPanelClick?.(panel.id, panel.name)}
                role="button"
                tabIndex={0}
                aria-label={`${panel.name}${damageCount ? `, ${damageCount} marks, ${severity}` : ""}`}
                aria-pressed={isSelected}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPanelClick?.(panel.id, panel.name); } }}
                onMouseEnter={() => setHoveredPanel(panel.id)}
                onMouseLeave={() => setHoveredPanel(null)}
                data-testid={`fpanel-${panel.id}`}
              />
              {/* Panel label */}
              <text
                x={panel.labelX}
                y={panel.labelY}
                textAnchor="middle"
                dominantBaseline={modern ? "middle" : undefined}
                className={cn(
                  "text-[7px] font-medium pointer-events-none",
                  severityTextColors[severity]
                )}
                style={{ fontSize: modern ? "18px" : "7px" }}
              >
                {modern ? panels.indexOf(panel) + 1 : panel.name}
              </text>
              {/* Damage count badge */}
              {isDamaged && !modern && (
                <g>
                  <circle
                    cx={panel.labelX + 32}
                    cy={panel.labelY - 5}
                    r="7"
                    className="fill-destructive stroke-white"
                    strokeWidth="1"
                  />
                  <text
                    x={panel.labelX + 32}
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
      <details open={modern} className="mt-2"><summary className="cursor-pointer text-sm py-2">Choose panel by name ({panels.length})</summary><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{panels.map((p, i) => <button key={p.id} data-testid={`fpanel-option-${p.id}`} type="button" onClick={() => onPanelClick?.(p.id, p.name)} aria-pressed={selectedPanel === p.id} className={cn("min-h-11 rounded-md border px-2 py-2 text-left text-xs", selectedPanel === p.id ? "border-primary bg-primary/10" : "border-border", damageMap.has(p.id) && "font-semibold")}><span className="text-muted-foreground mr-1">{i + 1}.</span>{p.name}{damageMap.has(p.id) && <span className="block text-primary">{damageMap.get(p.id)!.damageCount} marked · {damageMap.get(p.id)!.severity}</span>}</button>)}</div></details>
    </div>
  );
}

export { chairFrontPanels, chairTopPanels, sofaFrontPanels, sofaTopPanels, boothSidePanels, boothTopPanels, marineSidePanels, marineTopPanels, rvSidePanels, rvTopPanels };
