import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Map, Minus, Plus, Trash2, AlertTriangle, Grid3x3 } from "lucide-react";
import { VehicleSplat, type VehicleType, type SplatView } from "@/components/vehicle-splat";
import { FurnitureSplat, type FurnitureType, type FurnitureView } from "@/components/furniture-splat";
import { FURNITURE_PANEL_PRICES } from "@/lib/splat-pricing";
import { FURNITURE_STYLES, FURNITURE_NAMES, defaultFurnitureStyle } from "@/lib/furniture-geometry";
import { HailEstimator } from "./hail-estimator";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

type Severity = "minor" | "moderate" | "severe";
interface Mark {
  panelId: string;
  panelName: string;
  count: number;         // dents (hail/PDR), damage spots (interior), or pieces (upholstery)
  size: string;          // dime | nickel | quarter | half_dollar | softball
  severity: Severity;
  material: "vinyl" | "fabric";
  damageType: string;
  priceOverride?: number | null;
}

// Splat panel id -> hail matrix panel names (first match wins)
const HAIL_PANEL_MAP: Record<string, string[]> = {
  hood: ["Hood"],
  roof: ["Roof"], "cab-roof": ["Roof"],
  trunk: ["Deck Lid", "Decklid", "Deck Lid/Gate", "Roof Trunk"],
  "trunk-lid": ["Deck Lid", "Decklid", "Deck Lid/Gate"],
  liftgate: ["Deck Lid/Gate", "Deck Lid", "Decklid"],
  tailgate: ["Deck Lid/Gate", "Deck Lid", "Decklid"],
  "lf-fender": ["Fender", "LF/RF Fender", "L/R Fenders", "L Fender", "R/L Fender", "Door/Fender/QP"],
  "rf-fender": ["Fender", "LF/RF Fender", "L/R Fenders", "R/L Fender", "Door/Fender/QP"],
  "lf-door": ["Door", "Doors", "LF/RF Door", "L/R Doors", "L/R Door", "Door/Fender/QP"],
  "rf-door": ["Door", "Doors", "LF/RF Door", "L/R Doors", "L/R Door", "Door/Fender/QP"],
  "lr-door": ["Door", "Doors", "L/R Doors", "L/R Door", "Door/Fender/QP"],
  "rr-door": ["Door", "Doors", "L/R Doors", "L/R Door", "Door/Fender/QP"],
  "lr-quarter": ["Quarter", "Quarter Panel", "L&R Quarter", "L Quarter", "Door/Fender/QP"],
  "rr-quarter": ["Quarter", "Quarter Panel", "L&R Quarter", "R Quarter", "Door/Fender/QP"],
  "bed-side-l": ["Quarter", "Quarter Panel", "L&R Quarter", "L Quarter", "Door/Fender/QP"],
  "bed-side-r": ["Quarter", "Quarter Panel", "L&R Quarter", "R Quarter", "Door/Fender/QP"],
};
const NON_PDR = new Set(["windshield", "rear-window", "front-bumper", "rear-bumper", "bed-floor"]);

const bucketFor = (n: number) => (n <= 5 ? "1-5" : n <= 15 ? "6-15" : n <= 30 ? "16-30" : "31-50");
const sizeLabel: Record<string, string> = { dime: "Dime", nickel: "Nickel", quarter: "Quarter", half_dollar: "Half dollar", softball: "Softball" };
const upholsteryFactor: Record<Severity, { f: number; label: string }> = {
  minor: { f: 0.6, label: "Repair (60%)" },
  moderate: { f: 1.0, label: "Reupholster (100%)" },
  severe: { f: 1.25, label: "Reupholster + foam (125%)" },
};
const vinylTypes = ["crack", "tear", "burn", "fade", "puncture"];
const fabricTypes = ["tear", "burn", "stain", "rip", "hole"];

interface Props {
  estimate: any;
  vehicle?: any;
  asset?: any;
  matrices: any[];
  onAdd: (items: any[], insuranceCompany?: string) => Promise<void>;
}

export function EstimateDamageMap({ estimate, vehicle, asset, matrices, onAdd }: Props) {
  return estimate.serviceType === "hail" ? <HailEstimator estimate={estimate} vehicle={vehicle} onAdd={onAdd}/> : <StandardDamageMap estimate={estimate} vehicle={vehicle} asset={asset} matrices={matrices} onAdd={onAdd}/>;
}
function StandardDamageMap({ estimate, vehicle, asset, matrices, onAdd }: Props) {
  const svc: string = estimate.serviceType;
  const isHail = svc === "hail";
  const isPdr = svc === "pdr";
  const isAutoInterior = svc === "interior_repair";
  const isRv = svc === "rv_interior" || svc === "rv_upholstery";
  const isMarine = svc === "marine_interior" || svc === "marine_upholstery";
  const isFurniture = svc === "upholstery";
  const isUpholsteryPricing = svc === "rv_upholstery" || svc === "marine_upholstery" || isFurniture;
  const isInteriorRepairPricing = isAutoInterior || svc === "rv_interior" || svc === "marine_interior";

  // Vehicle body type from the linked vehicle
  const derivedBody: VehicleType = useMemo(() => {
    const bc = `${vehicle?.bodyClass || ""} ${vehicle?.model || ""}`.toLowerCase();
    if (vehicle?.vehicleType === "truck" || /pickup|truck|f-150|silverado|ram|tacoma|tundra|sierra/.test(bc)) return "pickup";
    if (/suv|sport utility|mpv|crossover|van|wagon|rav4|cr-v|explorer|tahoe/.test(bc)) return "suv";
    return "sedan";
  }, [vehicle]);
  const derivedFurniture: FurnitureType = useMemo(() => {
    if (isRv) return "rv";
    if (isMarine) return "marine";
    const t = asset?.assetType || "";
    if (t === "restaurant_booth" || t === "restaurant") return "booth";
    if (t === "sofa" || t === "home") return "sofa";
    if (["loveseat", "recliner", "dining_chair", "ottoman"].includes(t)) return t as FurnitureType;
    return "chair";
  }, [asset, isRv, isMarine]);

  const [bodyType, setBodyType] = useState<VehicleType>(derivedBody);
  const [furnType, setFurnType] = useState<FurnitureType>(derivedFurniture);
  const [furnStyle, setFurnStyle] = useState(defaultFurnitureStyle(derivedFurniture));
  const [furnView, setFurnView] = useState<FurnitureView>(isMarine?"top":"front");
  const carriers = useMemo(() => Array.from(new Set(matrices.filter((m) => m.matrixType === "hail_insurance").map((m) => m.insuranceCompany).filter(Boolean))) as string[], [matrices]);
  const [carrier, setCarrier] = useState<string>("State Farm");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState("");
  const [saveError, setSaveError] = useState("");

  const vehicleView: SplatView = isAutoInterior ? "interior" : "exterior";
  const vehCat = bodyType === "sedan" ? "sedan" : "suv";

  const onPanelClick = (panelId: string, panelName: string) => {
    setDone("");
    if (!marks.find((m) => m.panelId === panelId)) {
      setMarks((ms) => [...ms, {
        panelId, panelName: panelId.startsWith("f2:") ? `${FURNITURE_NAMES[furnType]} / ${FURNITURE_STYLES[furnType]?.[furnStyle]} / ${panelName}` : panelName, count: isHail ? 5 : 1, size: isHail ? "nickel" : "dime",
        severity: isUpholsteryPricing ? "moderate" : "moderate", material: "vinyl", damageType: "tear",
      }]);
    }
    setSelected(panelId);
  };
  const update = (id: string, patch: Partial<Mark>) => setMarks((ms) => ms.map((m) => (m.panelId === id ? { ...m, ...patch } : m)));
  const remove = (id: string) => { setMarks((ms) => ms.filter((m) => m.panelId !== id)); if (selected === id) setSelected(null); };

  // Price one mark from the matrix
  const priceMark = (m: Mark): { qty: number; unit: number; unitType: string; source: string; warn?: string; category: string; desc: string } => {
    if (isPdr) {
      if (NON_PDR.has(m.panelId)) return { qty: m.count, unit: 0, unitType: "each", source: "Not a PDR panel", warn: "Glass or plastic: enter a price", category: "pdr_dent", desc: `${m.panelName}: dent (non-PDR)` };
      const row = matrices.find((r) => r.matrixType === "pdr_dent" && r.sizeCategory === m.size && r.vehicleCategory === vehCat);
      return { qty: m.count, unit: row?.price || 0, unitType: "each", source: row ? `Standard PDR matrix · ${sizeLabel[m.size]} · ${vehCat}` : "No matrix row found", category: "pdr_dent", desc: `${m.panelName}: ${sizeLabel[m.size]} dent` };
    }
    if (isInteriorRepairPricing) {
      const mt = m.material === "fabric" ? "interior_fabric" : "interior_vinyl";
      const row = matrices.find((r) => r.matrixType === mt && r.damageType === m.damageType && r.severity === m.severity);
      return { qty: m.count, unit: row?.price || 0, unitType: "each", source: row ? `${m.material === "fabric" ? "Fabric" : "Vinyl/plastic"} matrix · ${m.damageType} · ${m.severity}` : "No matrix row found", category: mt, desc: `${m.panelName}: ${m.material} ${m.damageType} (${m.severity})` };
    }
    // Upholstery (RV, marine, furniture)
    const base = FURNITURE_PANEL_PRICES[m.panelId] || 0;
    const f = upholsteryFactor[m.severity];
    return { qty: m.count, unit: Math.round(base * f.f * 100) / 100, unitType: "each", source: base ? `Upholstery panel list $${base} × ${f.label}` : "No list price for this panel", warn: base ? undefined : "Enter a price", category: "upholstery", desc: `${m.panelName}: ${f.label.split(" (")[0].toLowerCase()}` };
  };

  const priced = marks.map((m) => {
    const p = priceMark(m);
    const unit = m.priceOverride != null ? m.priceOverride : p.unit;
    return { m, p, unit, total: Math.round(unit * p.qty * 100) / 100 };
  });
  const grand = priced.reduce((s, x) => s + x.total, 0);
  const unpriced = priced.some(x => !Number.isFinite(x.unit) || x.unit < 0 ||
    x.m.priceOverride == null && (isUpholsteryPricing && x.m.panelId.startsWith("f2:") || !!x.p.warn || x.unit === 0));

  const addAll = async () => {
    if (unpriced) return;
    setAdding(true);
    setSaveError("");
    try {
      await onAdd(priced.map(({ m, p, unit, total }) => ({
        serviceCategory: p.category,
        lineType: "labor",
        repairAction: isUpholsteryPricing ? (m.severity==="severe"?"foam_replacement":m.severity==="moderate"?"reupholster":"repair") : "repair",
        description: p.desc,
        panelLocation: m.panelName,
        damageSize: isHail || isPdr ? m.size : "",
        damageSeverity: m.severity,
        quantity: p.qty,
        unit: p.unitType,
        unitPrice: unit,
        total,
      })), isHail ? carrier : undefined);
      setDone(`${priced.length} line item${priced.length === 1 ? "" : "s"} added (${fmt(grand)})`);
      setMarks([]); setSelected(null);
    } catch(e:any) { setSaveError(e.message || "Could not save these marks. They are preserved; try again."); }
    finally { setAdding(false); }
  };

  const title = isHail ? "Hail Splat + Insurance Matrix" : isPdr ? "PDR Splat + Dent Matrix" : isAutoInterior ? "Interior Splat + Repair Matrix"
    : isRv ? "RV Interior Splat" : isMarine ? "Marine Interior Splat" : "Furniture Splat";

  const sel = marks.find((m) => m.panelId === selected);

  return (
    <Card data-testid="card-damage-map">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Map className="h-4 w-4" /> {title}</CardTitle>
        <p className="text-xs text-muted-foreground">{isMarine&&isUpholsteryPricing?"Tap each damaged panel. New open-bow upholstery panels require an advisor-entered price before adding.":"Tap each damaged panel. Prices come from the pricing matrix; you can override any price before adding."}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(isHail || isPdr || isAutoInterior) && (
            <div>
              <Label className="text-xs">Body style{vehicle ? ` (from ${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""})` : ""}</Label>
              <Select value={bodyType} disabled={marks.length > 0} onValueChange={(v) => { setBodyType(v as VehicleType); setSelected(null); }}>
                <SelectTrigger data-testid="select-splat-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedan">Sedan</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isHail && (
            <div>
              <Label className="text-xs">Insurance carrier matrix</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger data-testid="select-splat-carrier"><SelectValue /></SelectTrigger>
                <SelectContent>{carriers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {isFurniture && (
            <div>
              <Label className="text-xs">Piece type{asset ? ` (${asset.name})` : ""}</Label>
              <Select value={furnType} disabled={marks.length > 0} onValueChange={(v) => { setFurnType(v as FurnitureType); setFurnStyle(defaultFurnitureStyle(v)); setFurnView("front"); setSelected(null); }}>
                <SelectTrigger data-testid="select-splat-furniture"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chair">Chair</SelectItem>
                  <SelectItem value="sofa">Sofa</SelectItem>
                  <SelectItem value="loveseat">Loveseat</SelectItem>
                  <SelectItem value="recliner">Recliner</SelectItem>
                  <SelectItem value="dining_chair">Dining room chair</SelectItem>
                  <SelectItem value="ottoman">Ottoman</SelectItem>
                  <SelectItem value="booth">Restaurant booth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {(isFurniture||isMarine) && FURNITURE_STYLES[furnType] && <div><Label className="text-xs">{isMarine?"Boat layout":"Style / variation"}</Label><Select value={furnStyle} disabled={marks.length > 0} onValueChange={v => { setFurnStyle(v); setSelected(null); setFurnView(isMarine?"top":"front"); }}><SelectTrigger aria-label={isMarine?"Boat layout":"Furniture style"} data-testid="select-splat-style"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FURNITURE_STYLES[furnType]).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>}
          {(isFurniture || isRv || isMarine) && (
            <div>
              <Label className="text-xs">View</Label>
              <Select value={furnView} onValueChange={(v) => { setFurnView(v as FurnitureView); setSelected(null); }}>
                <SelectTrigger data-testid="select-splat-view"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!isMarine&&<SelectItem value="front">{isRv ? "Side (cutaway)" : "Front"}</SelectItem>}
                  <SelectItem value="top">Top (floor plan)</SelectItem>
                  {isFurniture && furnStyle !== "classic" && <SelectItem value="back">Back</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {(isFurniture||isMarine) && marks.length > 0 && <p className="text-xs text-muted-foreground">Add these marks to the estimate, or remove them, before changing type or layout. New upholstery diagram parts require an explicit unit price.</p>}
        {isFurniture && asset && ["aircraft","hotel","office","other"].includes(asset.assetType) && <p className="text-sm rounded-md border p-3">This asset category uses a generic furniture diagram, not a dedicated aircraft or whole-location layout. Choose the actual piece type, or enter manual line items with an agreed price.</p>}
        {(isHail || isPdr || isAutoInterior) && marks.length > 0 && <p className="text-xs text-muted-foreground">Add or remove marked panels before changing body style so unsaved marks are not lost.</p>}
        {unpriced && <p role="alert" className="text-sm text-amber-700">Enter an explicit unit price for missing, quote-required or out-of-range prices before adding. Enter 0 only for an intentional no-charge item.</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

        {/* Splat */}
        <div className="rounded-md border border-border bg-muted/20 p-2">
          <div>
            {(isHail || isPdr || isAutoInterior) ? (
              <VehicleSplat vehicleType={bodyType} view={vehicleView} damages={marks.map((m) => ({ panelId: m.panelId, panelName: m.panelName, damageCount: m.count, severity: m.severity }))} onPanelClick={onPanelClick} selectedPanel={selected} />
            ) : (
              <FurnitureSplat furnitureType={furnType} variant={furnStyle} view={furnView} damages={marks.map((m) => ({ panelId: m.panelId, panelName: m.panelName, damageCount: m.count, severity: m.severity }))} onPanelClick={onPanelClick} selectedPanel={selected} />
            )}
          </div>
        </div>

        {/* Selected panel editor */}
        {sel && (
          <div className="rounded-md border border-primary/50 bg-primary/5 p-3 space-y-3" data-testid="panel-editor">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{sel.panelName}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(sel.panelId)}><Trash2 className="h-4 w-4 mr-1" /> Remove</Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">{isHail || isPdr ? "Dent count" : isUpholsteryPricing ? "Pieces / qty" : "Damage spots"}</Label>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => update(sel.panelId, { count: Math.max(1, sel.count - 1) })}><Minus className="h-4 w-4" /></Button>
                  <Input className="h-9 text-center tabular-nums" inputMode="numeric" value={sel.count} onChange={(e) => update(sel.panelId, { count: Math.max(1, parseInt(e.target.value) || 1) })} data-testid="input-dent-count" />
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => update(sel.panelId, { count: sel.count + 1 })}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              {(isHail || isPdr) && (
                <div>
                  <Label className="text-xs">Dent size</Label>
                  <Select value={sel.size} onValueChange={(v) => update(sel.panelId, { size: v })}>
                    <SelectTrigger className="h-9" data-testid="select-dent-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["dime", "nickel", "quarter", "half_dollar", ...(isPdr ? ["softball"] : [])].map((s) => <SelectItem key={s} value={s}>{sizeLabel[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isInteriorRepairPricing && (
                <>
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select value={sel.material} onValueChange={(v) => update(sel.panelId, { material: v as any, damageType: v === "fabric" ? "tear" : "tear" })}>
                      <SelectTrigger className="h-9" data-testid="select-repair-material"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="vinyl">Vinyl / leather / plastic</SelectItem><SelectItem value="fabric">Fabric</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Damage</Label>
                    <Select value={sel.damageType} onValueChange={(v) => update(sel.panelId, { damageType: v })}>
                      <SelectTrigger className="h-9" data-testid="select-repair-damage"><SelectValue /></SelectTrigger>
                      <SelectContent>{(sel.material === "fabric" ? fabricTypes : vinylTypes).map((t) => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {!isHail && !isPdr && (
                <div>
                  <Label className="text-xs">{isUpholsteryPricing ? "Work" : "Severity"}</Label>
                  <Select value={sel.severity} onValueChange={(v) => update(sel.panelId, { severity: v as Severity })}>
                    <SelectTrigger className="h-9" data-testid="select-repair-severity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["minor", "moderate", "severe"] as Severity[]).map((s) => <SelectItem key={s} value={s}>{isUpholsteryPricing ? upholsteryFactor[s].label : s[0].toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Price override (unit)</Label>
                <Input aria-label="Panel unit price override" className="h-9 tabular-nums" inputMode="decimal" placeholder="Matrix price" value={sel.priceOverride ?? ""} onChange={(e) => update(sel.panelId, { priceOverride: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
          </div>
        )}

        {/* Marked panels list */}
        {priced.length > 0 ? (
          <div className="space-y-2">
            {priced.map(({ m, p, unit, total }) => (
              <button key={m.panelId} type="button" onClick={() => setSelected(m.panelId)}
                className={`w-full text-left rounded-md border p-2.5 ${selected === m.panelId ? "border-primary" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{p.desc}</div>
                    <div className="text-xs text-muted-foreground">{m.priceOverride != null ? "Manual price" : p.source}</div>
                    {p.warn && m.priceOverride == null && <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3" /> {p.warn}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{fmt(total)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{p.qty} × {fmt(unit)}</div>
                  </div>
                </div>
              </button>
            ))}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="text-sm">Splat total: <span className="font-semibold tabular-nums">{fmt(grand)}</span> <span className="text-muted-foreground">({priced.length} panel{priced.length === 1 ? "" : "s"})</span></div>
              <Button onClick={addAll} disabled={adding || unpriced} data-testid="button-add-splat-items">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add to estimate
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">{done || "No panels marked yet"}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Window tint has no splat: pick from the tint matrix directly
export function TintMatrixPicker({ vehicle, matrices, onAdd }: { vehicle?: any; matrices: any[]; onAdd: (items: any[]) => Promise<void> }) {
  const bc = `${vehicle?.bodyClass || ""} ${vehicle?.model || ""}`.toLowerCase();
  const derived = vehicle?.vehicleType === "truck" || /pickup|truck|f-150/.test(bc) ? "truck" : /suv|sport utility|mpv|van|rav4/.test(bc) ? "suv" : "sedan";
  const [cat, setCat] = useState(derived);
  const [film, setFilm] = useState("ceramic");
  const [picked, setPicked] = useState<string[]>(["Full Vehicle"]);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState("");
  const [saveError, setSaveError] = useState("");
  const rows = matrices.filter((m) => m.matrixType === "window_tint" && m.filmType === film && (m.panel !== "Full Vehicle" || m.vehicleCategory === cat));
  const options = ["Full Vehicle", "Front Doors", "Rear Doors", "Back Glass", "Sunroof"];
  const priceFor = (panel: string) => rows.find((r) => r.panel === panel)?.price;
  const chosen = picked.map((p) => ({ p, price: priceFor(p) })).filter((x) => x.price != null) as { p: string; price: number }[];
  const total = chosen.reduce((s, x) => s + x.price, 0);
  const toggle = (p: string) => setPicked((cur) => {
    if (p === "Full Vehicle") return cur.includes(p) ? [] : ["Full Vehicle"];
    const without = cur.filter((x) => x !== "Full Vehicle");
    return without.includes(p) ? without.filter((x) => x !== p) : [...without, p];
  });
  return (
    <Card data-testid="card-tint-matrix">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Grid3x3 className="h-4 w-4" /> Window Tint Matrix</CardTitle>
        <p className="text-xs text-muted-foreground">Choose film and windows; prices come from the tint pricing matrix.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Vehicle</Label>
            <Select value={cat} onValueChange={setCat}><SelectTrigger data-testid="select-tint-vehicle"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sedan">Sedan</SelectItem><SelectItem value="suv">SUV</SelectItem><SelectItem value="truck">Truck</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs">Film</Label>
            <Select value={film} onValueChange={setFilm}><SelectTrigger data-testid="select-tint-film"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="carbon">Carbon</SelectItem><SelectItem value="ceramic">Ceramic</SelectItem></SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((o) => {
            const pr = priceFor(o);
            const on = picked.includes(o);
            return (
              <button key={o} type="button" aria-pressed={on} disabled={pr == null} onClick={() => toggle(o)}
                className={`flex items-center justify-between rounded-md border p-2.5 text-sm ${on ? "border-primary bg-primary/5" : "border-border"} ${pr == null ? "opacity-50" : ""}`}>
                <span>{o}</span><span className="tabular-nums">{pr == null ? "n/a" : fmt(pr)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Total: <span className="font-semibold tabular-nums">{fmt(total)}</span></span>
          <Button disabled={!chosen.length || adding} onClick={async () => {
            setAdding(true); setSaveError(""); setDone("");
            try {
              await onAdd(chosen.map((x) => ({ serviceCategory: "window_tint", description: `${film[0].toUpperCase() + film.slice(1)} tint: ${x.p}`, panelLocation: x.p, damageSize: "", damageSeverity: "moderate", quantity: 1, unit: "each", unitPrice: x.price, total: x.price })));
              setDone(`${chosen.length} item(s) added`); setPicked([]);
            } catch(e:any) { setSaveError(e.message || "Could not save tint items. Try again."); }
            finally { setAdding(false); }
          }} data-testid="button-add-tint-items">
            {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add to estimate
          </Button>
        </div>
        {done && <p className="text-xs text-muted-foreground">{done}</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      </CardContent>
    </Card>
  );
}
