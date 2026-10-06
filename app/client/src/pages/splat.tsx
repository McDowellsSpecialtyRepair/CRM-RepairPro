import { useState } from "react";
import { NewEstimateDialog } from "@/components/new-estimate-dialog";
import { useLocation } from "wouter";
import { VehicleSplat, type VehicleType, type SplatView, type PanelDamage } from "@/components/vehicle-splat";
import { FurnitureSplat, type FurnitureType, type FurnitureView } from "@/components/furniture-splat";
import { FURNITURE_STYLES, FURNITURE_NAMES, defaultFurnitureStyle } from "@/lib/furniture-geometry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Car, Truck, Armchair, Sofa, UtensilsCrossed, Sailboat, Plus, Trash2, AlertCircle, FileText, CheckCircle2 } from "lucide-react";

const severityLabels: Record<string, string> = {
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
};

const severityColors: Record<string, string> = {
  minor: "bg-chart-3/15 text-chart-3",
  moderate: "bg-chart-4/15 text-chart-4",
  severe: "bg-destructive/15 text-destructive",
};

export default function SplatScreen() {
  const [, navigate] = useLocation();

  // Vehicle state
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [view, setView] = useState<SplatView>("exterior");
  const [damages, setDamages] = useState<PanelDamage[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<"minor" | "moderate" | "severe">("moderate");
  const [estimateGenerated, setEstimateGenerated] = useState(false);

  // Furniture state
  const [furnitureType, setFurnitureType] = useState<FurnitureType>("chair");
  const [furnitureStyle, setFurnitureStyle] = useState(defaultFurnitureStyle("chair"));
  const [furnitureView, setFurnitureView] = useState<FurnitureView>("front");
  const [furnitureDamages, setFurnitureDamages] = useState<PanelDamage[]>([]);
  const [furnitureSelectedPanel, setFurnitureSelectedPanel] = useState<string | null>(null);
  const [furnitureEstimateGenerated, setFurnitureEstimateGenerated] = useState(false);

  // Splat category
  const [splatCategory, setSplatCategory] = useState<"vehicle" | "furniture">("vehicle");

  const handlePanelClick = (panelId: string, panelName: string) => {
    const existing = damages.find((d) => d.panelId === panelId);
    if (existing) {
      setSelectedPanel(panelId);
    } else {
      setDamages([
        ...damages,
        { panelId, panelName, damageCount: 1, severity: selectedSeverity },
      ]);
      setSelectedPanel(panelId);
    }
  };

  const incrementDamage = (panelId: string) => {
    setDamages(damages.map((d) =>
      d.panelId === panelId ? { ...d, damageCount: d.damageCount + 1 } : d
    ));
  };

  const decrementDamage = (panelId: string) => {
    const damage = damages.find((d) => d.panelId === panelId);
    if (!damage) return;
    if (damage.damageCount <= 1) {
      setDamages(damages.filter((d) => d.panelId !== panelId));
      setSelectedPanel(null);
    } else {
      setDamages(damages.map((d) =>
        d.panelId === panelId ? { ...d, damageCount: d.damageCount - 1 } : d
      ));
    }
  };

  const updateSeverity = (panelId: string, severity: "minor" | "moderate" | "severe") => {
    setDamages(damages.map((d) =>
      d.panelId === panelId ? { ...d, severity } : d
    ));
  };

  const removeDamage = (panelId: string) => {
    setDamages(damages.filter((d) => d.panelId !== panelId));
    setSelectedPanel(null);
  };

  const clearAll = () => {
    setDamages([]);
    setSelectedPanel(null);
    setEstimateGenerated(false);
  };

  // Furniture handlers
  const handleFurniturePanelClick = (panelId: string, panelName: string) => {
    const existing = furnitureDamages.find((d) => d.panelId === panelId);
    if (existing) {
      setFurnitureSelectedPanel(panelId);
    } else {
      setFurnitureDamages([
        ...furnitureDamages,
        { panelId, panelName, damageCount: 1, severity: selectedSeverity },
      ]);
      setFurnitureSelectedPanel(panelId);
    }
  };

  const incrementFurnitureDamage = (panelId: string) => {
    setFurnitureDamages(furnitureDamages.map((d) =>
      d.panelId === panelId ? { ...d, damageCount: d.damageCount + 1 } : d
    ));
  };

  const decrementFurnitureDamage = (panelId: string) => {
    const damage = furnitureDamages.find((d) => d.panelId === panelId);
    if (!damage) return;
    if (damage.damageCount <= 1) {
      setFurnitureDamages(furnitureDamages.filter((d) => d.panelId !== panelId));
      setFurnitureSelectedPanel(null);
    } else {
      setFurnitureDamages(furnitureDamages.map((d) =>
        d.panelId === panelId ? { ...d, damageCount: d.damageCount - 1 } : d
      ));
    }
  };

  const updateFurnitureSeverity = (panelId: string, severity: "minor" | "moderate" | "severe") => {
    setFurnitureDamages(furnitureDamages.map((d) =>
      d.panelId === panelId ? { ...d, severity } : d
    ));
  };

  const removeFurnitureDamage = (panelId: string) => {
    setFurnitureDamages(furnitureDamages.filter((d) => d.panelId !== panelId));
    setFurnitureSelectedPanel(null);
  };

  const clearFurnitureAll = () => {
    setFurnitureDamages([]);
    setFurnitureSelectedPanel(null);
    setFurnitureEstimateGenerated(false);
  };

  const totalDents = damages.reduce((sum, d) => sum + d.damageCount, 0);
  const damagedPanels = damages.length;

  const furnitureTotalDents = furnitureDamages.reduce((sum, d) => sum + d.damageCount, 0);
  const furnitureDamagedPanels = furnitureDamages.length;

  // Pricing lookup for vehicle
  const hailPricing: Record<string, Record<string, number>> = {
    minor: { hood: 450, roof: 550, door: 275, fender: 250, quarter: 275, trunk: 350, bumper: 200, "lf-fender": 250, "rf-fender": 250, "lf-door": 275, "rf-door": 275, "lr-door": 275, "rr-door": 275, "lr-quarter": 275, "rr-quarter": 275, "front-bumper": 200, "rear-bumper": 200, "trunk-lid": 350, "windshield": 0, "rear-window": 0, dashboard: 200, "steering-wheel": 150, "front-seat-l": 300, "front-seat-r": 300, "rear-seat-l": 250, "rear-seat-r": 250, "door-panel-lf": 175, "door-panel-rf": 175, "door-panel-lr": 175, "door-panel-rr": 175, headliner: 400, "center-console": 200 },
    moderate: { hood: 650, roof: 750, door: 375, fender: 350, quarter: 375, trunk: 500, bumper: 300, "lf-fender": 350, "rf-fender": 350, "lf-door": 375, "rf-door": 375, "lr-door": 375, "rr-door": 375, "lr-quarter": 375, "rr-quarter": 375, "front-bumper": 300, "rear-bumper": 300, "trunk-lid": 500, "windshield": 0, "rear-window": 0, dashboard: 300, "steering-wheel": 225, "front-seat-l": 450, "front-seat-r": 450, "rear-seat-l": 375, "rear-seat-r": 375, "door-panel-lf": 250, "door-panel-rf": 250, "door-panel-lr": 250, "door-panel-rr": 250, headliner: 600, "center-console": 300 },
    severe: { hood: 950, roof: 1100, door: 550, fender: 500, quarter: 550, trunk: 750, bumper: 450, "lf-fender": 500, "rf-fender": 500, "lf-door": 550, "rf-door": 550, "lr-door": 550, "rr-door": 550, "lr-quarter": 550, "rr-quarter": 550, "front-bumper": 450, "rear-bumper": 450, "trunk-lid": 750, "windshield": 0, "rear-window": 0, dashboard: 450, "steering-wheel": 350, "front-seat-l": 650, "front-seat-r": 650, "rear-seat-l": 550, "rear-seat-r": 550, "door-panel-lf": 375, "door-panel-rf": 375, "door-panel-lr": 375, "door-panel-rr": 375, headliner: 900, "center-console": 450 },
  };

  // Furniture pricing
  const furniturePricing: Record<string, number> = {
    "back-rest": 65, "left-arm": 45, "right-arm": 45, "seat-cushion": 85, "seat-seam-h": 35,
    "piping-left": 25, "piping-right": 25, "base": 40, "front-edge": 30,
    "backrest": 120, "sofa-left-arm": 65, "sofa-right-arm": 65, "left-cushion": 120,
    "center-cushion": 120, "right-cushion": 120, "seam-lc": 35, "seam-cr": 35,
    "sofa-base": 80, "backrest-seam": 40, "sofa-front-edge": 45,
    "booth-back": 95, "booth-seat": 95, "end-cap-left": 50, "end-cap-right": 50,
    "kick-plate": 35, "seam-back-seat": 35, "seam-seat-base": 30, "cushion-top": 65,
    "back-padding": 55,
    "top-back-rest": 65, "top-seat": 85, "top-left-arm": 45, "top-right-arm": 45,
    "top-cushion": 85, "top-seam": 35,
    "top-backrest": 120, "top-l-arm": 65, "top-r-arm": 65, "top-l-cushion": 120,
    "top-c-cushion": 120, "top-r-cushion": 120, "top-seam-lc": 35, "top-seam-cr": 35,
    "top-booth-back": 95, "top-booth-seat": 95, "top-booth-cushion": 65,
    "top-booth-seam1": 35, "top-booth-seam2": 35, "top-end-cap-l": 50, "top-end-cap-r": 50,
    // Marine
    "m-vberth-cushion": 110, "m-vberth-back": 75, "m-side-panel-port": 95, "m-settee-cushion": 110,
    "m-settee-back": 85, "m-helm-dash": 150, "m-helm-panel": 120, "m-headliner": 180,
    "m-sole": 65, "m-companionway": 45, "m-window": 55,
    // Marine additional panels
    "m-fwd-hatch": 85, "m-cabin-door": 95, "m-galley-counter": 110, "m-nav-station": 120,
    "m-quarter-berth": 130, "m-engine-access": 75, "m-stowage": 65, "m-hanging-locker": 85,
    // Marine top view additional panels
    "mt-quarter-berth": 130, "mt-hanging-locker": 85, "mt-nav-station": 120,
    "mt-fwd-hatch": 85, "mt-engine-access": 75, "mt-anchor-locker": 55,
    "mt-shower": 95, "mt-swim-platform": 65,
    "mt-vberth-l": 110, "mt-vberth-r": 110, "mt-vberth-seam": 35, "mt-head": 85,
    "mt-settee-port": 110, "mt-settee-stbd": 110, "mt-table": 65, "mt-galley": 95,
    "mt-helm": 150, "mt-companionway": 45, "mt-cockpit": 85,
    // RV
    "r-windshield": 0, "r-driver-dash": 150, "r-driver-seat": 185, "r-passenger-seat": 185,
    "r-cabover-bunk": 120, "r-slide-wall": 95, "r-sofa-bed": 145, "r-dinette-seat": 110,
    "r-dinette-table": 65, "r-galley-counter": 95, "r-galley-back": 65, "r-bath-wall": 85,
    "r-bath-door": 55, "r-bedroom-wall": 85, "r-bed": 145, "r-headliner": 180, "r-floor": 65,
    "rt-cabover": 120, "rt-driver-seat": 185, "rt-pass-seat": 185, "rt-dash": 150,
    "rt-sofa": 145, "rt-dinette": 110, "rt-dinette-table": 65, "rt-galley": 95,
    "rt-bathroom": 85, "rt-hallway": 45, "rt-bedroom": 85, "rt-bed": 145, "rt-closet": 65,
  };

  // Splats are priced inside each estimate. From this reference page, start a real estimate
  // for a customer; the matching splat + matrix opens inside the estimate.
  const [newEstOpen, setNewEstOpen] = useState(false);
  const [newEstService, setNewEstService] = useState<string | undefined>(undefined);
  const handleGenerateEstimate = () => {
    setNewEstService(view === "interior" ? "interior_repair" : "hail");
    setNewEstOpen(true);
  };
  const handleFurnitureGenerateEstimate = () => {
    setNewEstService(furnitureType === "rv" ? "rv_upholstery" : furnitureType === "marine" ? "marine_upholstery" : "upholstery");
    setNewEstOpen(true);
  };

  const vehicleLabels: Record<string, string> = {
    sedan: "Sedan", suv: "SUV", pickup: "Pickup Truck",
  };

  const vehicleIcons: Record<string, React.ReactNode> = {
    sedan: <Car className="h-4 w-4" />, suv: <Car className="h-4 w-4" />, pickup: <Truck className="h-4 w-4" />,
  };

  const furnitureLabels: Record<string, string> = {
    ...FURNITURE_NAMES,
  };

  const furnitureIcons: Record<string, React.ReactNode> = {
    chair: <Armchair className="h-4 w-4" />, sofa: <Sofa className="h-4 w-4" />, booth: <UtensilsCrossed className="h-4 w-4" />, marine: <Sailboat className="h-4 w-4" />, rv: <Truck className="h-4 w-4" />,
  };

  const interiorPanelsList = [
    "dashboard", "steering-wheel", "front-seat-l", "front-seat-r",
    "rear-seat-l", "rear-seat-r", "door-panel-lf", "door-panel-rf",
    "door-panel-lr", "door-panel-rr", "headliner", "center-console"
  ];

  return (
    <div className="space-y-4">
      <NewEstimateDialog open={newEstOpen} onOpenChange={setNewEstOpen} initialService={newEstService} key={newEstService || "none"} />
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        This is the splat reference page. To price damage, open an estimate: the matching splat and pricing matrix appear inside it (Customer profile → New Estimate, or Estimates → New Estimate).
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Damage Splat Diagrams
          </h1>
          <p className="text-sm text-muted-foreground">Click panels to mark damage on vehicles, furniture, and restaurant booths</p>
        </div>
      </div>

      {/* Top-level category tabs */}
      <Tabs value={splatCategory} onValueChange={(v) => setSplatCategory(v as "vehicle" | "furniture")}>
        <TabsList>
          <TabsTrigger value="vehicle" data-testid="tab-splat-vehicle">
            <Car className="h-3.5 w-3.5 mr-1" /> Vehicle Splats
          </TabsTrigger>
          <TabsTrigger value="furniture" data-testid="tab-splat-furniture">
            <Armchair className="h-3.5 w-3.5 mr-1" /> Furniture & Booth Splats
          </TabsTrigger>
        </TabsList>

        {/* ============ VEHICLE SPLAT ============ */}
        <TabsContent value="vehicle" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Vehicle:</span>
              <Select value={vehicleType} onValueChange={(v) => { setVehicleType(v as VehicleType); clearAll(); }}>
                <SelectTrigger className="w-32" data-testid="select-vehicle-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedan">Sedan</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {damages.length > 0 && (
              <Button variant="outline" onClick={clearAll} data-testid="button-clear-all">
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <Tabs value={view} onValueChange={(v) => setView(v as SplatView)}>
                <TabsList>
                  <TabsTrigger value="exterior" data-testid="tab-exterior">Exterior</TabsTrigger>
                  <TabsTrigger value="interior" data-testid="tab-interior">Interior</TabsTrigger>
                </TabsList>
              </Tabs>

              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {vehicleIcons[vehicleType]}
                    {vehicleLabels[vehicleType]} — {view === "exterior" ? "Exterior Panels" : "Interior Panels"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <VehicleSplat
                      vehicleType={vehicleType}
                      view={view}
                      damages={damages.filter((d) => {
                        if (view === "interior") return interiorPanelsList.includes(d.panelId);
                        return !interiorPanelsList.includes(d.panelId);
                      })}
                      onPanelClick={handlePanelClick}
                      selectedPanel={selectedPanel}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Severity:</span>
                      <div className="flex gap-1">
                        {(["minor", "moderate", "severe"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSeverity(s)}
                            data-testid={`button-severity-${s}`}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              selectedSeverity === s ? severityColors[s] : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {severityLabels[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-muted/30 stroke-border" />None</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-chart-3/20 stroke-chart-3" />Minor</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-chart-4/30 stroke-chart-4" />Mod</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-destructive/30 stroke-destructive" />Severe</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold tabular-nums text-primary">{damagedPanels}</div>
                      <div className="text-[10px] text-muted-foreground">Damaged Panels</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold tabular-nums text-destructive">{totalDents}</div>
                      <div className="text-[10px] text-muted-foreground">Total Dents</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-base">Marked Damage</CardTitle>
                </CardHeader>
                <CardContent>
                  {damages.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click panels on the diagram to mark damage</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {damages.map((d) => (
                        <div
                          key={d.panelId}
                          className={`rounded-md border p-3 transition-colors ${
                            selectedPanel === d.panelId ? "border-primary bg-primary/5" : "border-border"
                          }`}
                          data-testid={`div-damage-${d.panelId}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{d.panelName}</span>
                            <button onClick={() => removeDamage(d.panelId)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => decrementDamage(d.panelId)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-sm hover:bg-muted">−</button>
                              <span className="w-8 text-center text-sm font-medium tabular-nums">{d.damageCount}</span>
                              <button onClick={() => incrementDamage(d.panelId)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-sm hover:bg-muted"><Plus className="h-3 w-3" /></button>
                            </div>
                            <Select value={d.severity} onValueChange={(v) => updateSeverity(d.panelId, v as any)}>
                              <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minor">Minor</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="severe">Severe</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                      {false ? (
                        <div className="mt-3 rounded-md border border-chart-3/30 bg-chart-3/5 p-3 text-center">
                          <CheckCircle2 className="h-5 w-5 mx-auto text-chart-3 mb-1" />
                          <p className="text-xs font-medium text-chart-3">Estimate created with {damages.length} line items</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Redirecting to estimates...</p>
                        </div>
                      ) : (
                        <Button className="w-full mt-3" data-testid="button-generate-estimate" onClick={handleGenerateEstimate}>
                          <FileText className="h-4 w-4 mr-1" /> Start Estimate for a Customer
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============ FURNITURE & BOOTH SPLAT ============ */}
        <TabsContent value="furniture" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type:</span>
              <Select value={furnitureType} disabled={furnitureDamages.length > 0} onValueChange={(v) => { setFurnitureType(v as FurnitureType); setFurnitureStyle(defaultFurnitureStyle(v)); setFurnitureView(v==="marine"?"top":"front"); clearFurnitureAll(); }}>
                <SelectTrigger className="w-40" data-testid="select-furniture-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chair">Chair</SelectItem>
                  <SelectItem value="sofa">Sofa</SelectItem>
                  <SelectItem value="loveseat">Loveseat</SelectItem>
                  <SelectItem value="recliner">Recliner</SelectItem>
                  <SelectItem value="dining_chair">Dining room chair</SelectItem>
                  <SelectItem value="ottoman">Ottoman</SelectItem>
                  <SelectItem value="booth">Restaurant Booth</SelectItem>
                  <SelectItem value="marine">Marine Interior</SelectItem>
                  <SelectItem value="rv">RV Interior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {furnitureDamages.length > 0 && (
              <Button variant="outline" onClick={clearFurnitureAll} data-testid="button-clear-furniture">
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          {FURNITURE_STYLES[furnitureType] && <label className="block text-sm max-w-sm">{furnitureType==="marine"?"Boat layout":"Style / variation"}<select aria-label={furnitureType==="marine"?"Boat layout":"Furniture style"} className="w-full h-11 border rounded-md bg-background px-3 mt-1" disabled={furnitureDamages.length > 0} value={furnitureStyle} onChange={e => { setFurnitureStyle(e.target.value); setFurnitureView(furnitureType==="marine"?"top":"front"); clearFurnitureAll(); }}>{Object.entries(FURNITURE_STYLES[furnitureType]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>}
          {furnitureDamages.length > 0 && <p className="text-xs text-muted-foreground">Clear reference marks before changing type or style. Reference marks are not saved or copied into an estimate; mark and price the piece inside its estimate.</p>}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Tabs value={furnitureView} onValueChange={(v) => setFurnitureView(v as FurnitureView)}>
                <TabsList>
                  {furnitureType!=="marine"&&<TabsTrigger value="front" data-testid="tab-furniture-front">Front View</TabsTrigger>}
                  <TabsTrigger value="top" data-testid="tab-furniture-top">Top View</TabsTrigger>
                  {furnitureType!=="marine" && FURNITURE_STYLES[furnitureType] && furnitureStyle !== "classic" && <TabsTrigger value="back" data-testid="tab-furniture-back">Back View</TabsTrigger>}
                </TabsList>
              </Tabs>

              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {furnitureIcons[furnitureType]}
                    {furnitureLabels[furnitureType]} · {furnitureView === "front" ? "Front View" : furnitureView === "back" ? "Back View" : "Top View"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <FurnitureSplat
                      furnitureType={furnitureType}
                      variant={furnitureStyle}
                      view={furnitureView}
                      damages={furnitureDamages}
                      onPanelClick={handleFurniturePanelClick}
                      selectedPanel={furnitureSelectedPanel}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Severity:</span>
                      <div className="flex gap-1">
                        {(["minor", "moderate", "severe"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSeverity(s)}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              selectedSeverity === s ? severityColors[s] : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {severityLabels[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-muted/30 stroke-border" />None</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-chart-3/20 stroke-chart-3" />Minor</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-chart-4/30 stroke-chart-4" />Mod</span>
                      <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded fill-destructive/30 stroke-destructive" />Severe</span>
                    </div>
                  </div>

                  {/* Panel reference */}
                  <div className="mt-2 rounded-lg bg-muted/30 p-2 text-[10px] text-muted-foreground">
                    <span className="font-medium">Panels:</span>{" "}
                    {furnitureType === "chair" && (
                      <span>Back Rest, Seat Cushion, Left/Right Arm, Seat Seam, Piping (L/R), Base/Legs, Front Edge</span>
                    )}
                    {furnitureType === "sofa" && (
                      <span>Backrest, Left/Center/Right Cushion, Left/Right Arm, Seams, Base/Frame, Backrest Seam, Front Edge</span>
                    )}
                    {furnitureType === "booth" && (
                      <span>Booth Back, Booth Seat, End Caps (L/R), Kick Plate, Back-Seat Seam, Seat-Base Seam, Cushion Top, Back Padding</span>
                    )}
                    {furnitureType === "marine" && (
                      <span>Open-bow cushions and backrests, removable filler, passenger console, helm trim, helm/passenger seats, cockpit side bolsters, rear bench, engine cover and swim platform pad. Use the numbered buttons for exact panel names.</span>
                    )}
                    {furnitureType === "rv" && (
                      <span>Windshield, Dashboard, Driver/Passenger Seat, Cab-Over Bunk, Slide-Out Wall, Sofa/Bed, Dinette, Galley Counter/Backsplash, Bath Wall/Door, Bedroom Wall, Bed, Headliner, Floor</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold tabular-nums text-primary">{furnitureDamagedPanels}</div>
                      <div className="text-[10px] text-muted-foreground">Damaged Panels</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold tabular-nums text-destructive">{furnitureTotalDents}</div>
                      <div className="text-[10px] text-muted-foreground">Total Damages</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-base">Marked Damage</CardTitle>
                </CardHeader>
                <CardContent>
                  {furnitureDamages.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click panels on the diagram to mark damage</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {furnitureDamages.map((d) => {
                        const basePrice = furniturePricing[d.panelId];
                        return (
                          <div
                            key={d.panelId}
                            className={`rounded-md border p-3 transition-colors ${
                              furnitureSelectedPanel === d.panelId ? "border-primary bg-primary/5" : "border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-sm font-medium">{d.panelName}</span>
                                <div className="text-xs text-muted-foreground">{basePrice == null ? "Price required inside estimate" : `Reference base: $${basePrice}`}</div>
                              </div>
                              <button onClick={() => removeFurnitureDamage(d.panelId)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <button onClick={() => decrementFurnitureDamage(d.panelId)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-sm hover:bg-muted">−</button>
                                <span className="w-8 text-center text-sm font-medium tabular-nums">{d.damageCount}</span>
                                <button onClick={() => incrementFurnitureDamage(d.panelId)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-sm hover:bg-muted"><Plus className="h-3 w-3" /></button>
                              </div>
                              <Select value={d.severity} onValueChange={(v) => updateFurnitureSeverity(d.panelId, v as any)}>
                                <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minor">Minor</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="severe">Severe</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                      {false ? (
                        <div className="mt-3 rounded-md border border-chart-3/30 bg-chart-3/5 p-3 text-center">
                          <CheckCircle2 className="h-5 w-5 mx-auto text-chart-3 mb-1" />
                          <p className="text-xs font-medium text-chart-3">Estimate created with {furnitureDamages.length} line items</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Redirecting to estimates...</p>
                        </div>
                      ) : (
                        <Button className="w-full mt-3" data-testid="button-generate-furniture-estimate" onClick={handleFurnitureGenerateEstimate}>
                          <FileText className="h-4 w-4 mr-1" /> Start Estimate for a Customer
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
