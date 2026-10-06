import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PricingPrintPreview } from "@/components/pricing-print-preview";
import { HailReference } from "@/components/hail-reference";
import { HAIL_REFERENCE_ROWS } from "@shared/hail-reference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, Plus, Download, Shield, Car, Scissors, Wrench, DollarSign, Cloud } from "lucide-react";
import { useState, useMemo } from "react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const sizeLabels: Record<string, string> = {
  dime: "Dime", nickel: "Nickel", quarter: "Quarter", half_dollar: "Half Dollar", softball: "Softball", multiple: "Multiple",
};

const panelLabels: Record<string, string> = {
  hood: "Hood", roof: "Roof", "deck lid": "Deck Lid", "decklid": "Deck Lid", "deck_lid": "Deck Lid",
  "deck lid/gate": "Deck Lid/Gate", "roof rail": "Roof Rail", fender: "Fender", door: "Door",
  quarter: "Quarter Panel", cowl: "Cowl", "cowl/other": "Cowl/Other", uniside: "Uniside",
  "average size": "Average Size", "l fender": "L Fender", "r/l fender": "R/L Fender",
  "roof trunk": "Roof Trunk", "l/r door": "L/R Door", "lf/rf door": "LF/RF Door",
  "r quarter": "R Quarter", "l quarter": "L Quarter", "r rail/corner": "R Rail/Corner",
  "metal sunroof": "Metal Sunroof",
};

function formatPanel(p: string) {
  return panelLabels[p?.toLowerCase()] || p || "—";
}

export default function PricingMatrix() {
  const { data: matrices, isLoading } = useQuery({
    queryKey: ["/api/pricing-matrices"],
    queryFn: () => apiRequest("GET", "/api/pricing-matrices"),
  });

  const [selectedInsurance, setSelectedInsurance] = useState("State Farm");

  // Group matrices by type
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    (matrices || []).forEach((m: any) => {
      const t = m.matrixType || "other";
      if (!g[t]) g[t] = [];
      g[t].push(m);
    });
    return g;
  }, [matrices]);

  // Get unique insurance companies
  const insuranceCompanies = useMemo(() => {
    const companies = new Set<string>();
    (grouped["hail_insurance"] || []).forEach((m: any) => {
      if (m.insuranceCompany) companies.add(m.insuranceCompany);
    });
    return Array.from(companies).sort();
  }, [grouped]);

  // Filter insurance matrices by selected company
  const insuranceMatrices = useMemo(() => {
    return (grouped["hail_insurance"] || []).filter((m: any) => m.insuranceCompany === selectedInsurance);
  }, [grouped, selectedInsurance]);

  // Group insurance matrices by panel
  const insuranceByPanel = useMemo(() => {
    const byPanel: Record<string, any[]> = {};
    insuranceMatrices.forEach((m: any) => {
      const p = m.panel || "unknown";
      if (!byPanel[p]) byPanel[p] = [];
      byPanel[p].push(m);
    });
    return byPanel;
  }, [insuranceMatrices]);

  const dentCountRanges = ["1-5", "6-15", "16-30", "31-50"];
  const dentSizes = ["dime", "nickel", "quarter", "half_dollar"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Pricing Matrices
          </h1>
          <p className="text-sm text-muted-foreground">
            {(matrices || []).length} stored entries across {Object.keys(grouped).length} categories, plus {HAIL_REFERENCE_ROWS.length} carrier-source State Farm cells
          </p>
        </div>
        <div className="flex gap-2">
          <PricingPrintPreview />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <Tabs defaultValue="pdr_dent" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="pdr_dent" data-testid="tab-pdr-dent">PDR Dent</TabsTrigger>
            <TabsTrigger value="pdr_hail" data-testid="tab-hail-generic">Hail (Generic)</TabsTrigger>
            <TabsTrigger value="hail_insurance" data-testid="tab-hail-insurance">Insurance Hail</TabsTrigger>
            <TabsTrigger value="window_tint" data-testid="tab-window-tint">Window Tint</TabsTrigger>
            <TabsTrigger value="interior_vinyl" data-testid="tab-interior-vinyl">Interior Vinyl</TabsTrigger>
            <TabsTrigger value="interior_fabric" data-testid="tab-interior-fabric">Interior Fabric</TabsTrigger>
            <TabsTrigger value="upholstery" data-testid="tab-upholstery">Upholstery</TabsTrigger>
            <TabsTrigger value="labor" data-testid="tab-labor">Labor Rates</TabsTrigger>
            <TabsTrigger value="material" data-testid="tab-material">Materials</TabsTrigger>
          </TabsList>

          {/* PDR DENT MATRIX */}
          <TabsContent value="pdr_dent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" /> PDR Dent Size Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-2 pr-4">Vehicle Category</th>
                        <th className="text-right font-medium pb-2 px-3">Dime</th>
                        <th className="text-right font-medium pb-2 px-3">Nickel</th>
                        <th className="text-right font-medium pb-2 px-3">Quarter</th>
                        <th className="text-right font-medium pb-2 px-3">Half Dollar</th>
                        <th className="text-right font-medium pb-2 px-3">Softball</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["sedan", "suv"].map((vc) => {
                        const rows = (grouped["pdr_dent"] || []).filter((m: any) => m.vehicleCategory === vc);
                        const getPrice = (size: string) => rows.find((r: any) => r.sizeCategory === size)?.price || 0;
                        return (
                          <tr key={vc} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 pr-4 font-medium capitalize">{vc === "suv" ? "SUV / Truck" : vc}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getPrice("dime"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getPrice("nickel"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getPrice("quarter"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getPrice("half_dollar"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getPrice("softball"))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Configured shop prices per dent, not verified carrier rates. Use Insurance Hail for carrier-specific sources, upcharges and exceptions; do not apply generic adjustments to an insurance claim.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HAIL GENERIC */}
          <TabsContent value="pdr_hail" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Generic Hail Damage Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-2 pr-4">Panel</th>
                        <th className="text-right font-medium pb-2 px-3">Sedan</th>
                        <th className="text-right font-medium pb-2 px-3">SUV/Truck</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["Hood", "Roof", "Door", "Fender"].map((panel) => {
                        const rows = (grouped["pdr_hail"] || []).filter((m: any) => m.panel === panel);
                        const sedan = rows.find((r: any) => r.vehicleCategory === "sedan")?.price || 0;
                        const suv = rows.find((r: any) => r.vehicleCategory === "suv")?.price || 0;
                        return (
                          <tr key={panel} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 pr-4 font-medium">{panel}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(sedan)}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(suv)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Per-panel pricing for multiple hail dents. Use insurance-specific matrices for claim estimates.</div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INSURANCE HAIL MATRIX */}
          <TabsContent value="hail_insurance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Insurance Company Hail Matrices
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Insurance Company:</span>
                    <Select value={selectedInsurance} onValueChange={setSelectedInsurance}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {insuranceCompanies.map((c: string) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <HailReference carrier={selectedInsurance}/>
                <details className="mt-4 border rounded-md p-3"><summary className="cursor-pointer text-sm">Legacy stored {selectedInsurance} rates (unverified; not used for automatic carrier quoting)</summary>
                <p className="text-sm my-3">Historical seeded data only. These rows may be incomplete or stale. Existing estimates are unchanged; new carrier pricing uses the source-backed reference above or a documented manual amount.</p>
                <div className="space-y-4">
                  {Object.entries(insuranceByPanel).map(([panel, items]) => (
                    <div key={panel} className="rounded-lg border border-border p-3">
                      <div className="font-medium text-sm mb-2">{formatPanel(panel)}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                              <th className="text-left font-medium pb-1.5 pr-3">Dent Count</th>
                              {dentSizes.map((s) => (
                                <th key={s} className="text-right font-medium pb-1.5 px-2">{sizeLabels[s]}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dentCountRanges.map((range) => {
                              const rangeItems = items.filter((m: any) => m.dentCountRange === range);
                              if (rangeItems.length === 0) return null;
                              return (
                                <tr key={range} className="border-b border-border/30">
                                  <td className="py-2 pr-3 text-xs font-medium">{range} dents</td>
                                  {dentSizes.map((s) => {
                                    const item = rangeItems.find((m: any) => m.sizeCategory === s);
                                    return (
                                      <td key={s} className="py-2 px-2 text-right tabular-nums text-xs">
                                        {item ? item.price===0&&item.notes ? item.notes : formatCurrency(item.price) : <span className="text-muted-foreground">Not configured</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {Object.keys(insuranceByPanel).length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">No matrix data for {selectedInsurance}</div>
                  )}
                </div>
                </details>
              </CardContent>
            </Card>

            {/* Summary of all insurance companies */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available Insurance Matrices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {insuranceCompanies.map((c: string) => (
                    <button
                      key={c}
                      onClick={() => setSelectedInsurance(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedInsurance === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {c} ({(grouped["hail_insurance"] || []).filter((m: any) => m.insuranceCompany === c).length} entries)
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WINDOW TINT */}
          <TabsContent value="window_tint" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4" /> Window Tint Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-2 pr-4">Film Type</th>
                        <th className="text-right font-medium pb-2 px-3">Sedan</th>
                        <th className="text-right font-medium pb-2 px-3">SUV</th>
                        <th className="text-right font-medium pb-2 px-3">Truck</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["standard", "ceramic", "carbon"].map((film) => {
                        const rows = (grouped["window_tint"] || []).filter((m: any) => m.filmType === film);
                        const getVC = (vc: string) => rows.find((r: any) => r.vehicleCategory === vc)?.price || 0;
                        return (
                          <tr key={film} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 pr-4 font-medium capitalize">{film}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getVC("sedan"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getVC("suv"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getVC("truck"))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const individual = (grouped["window_tint"] || []).filter((m: any) => m.vehicleCategory === null || m.vehicleCategory === "individual");
                  if (individual.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Individual Window Pricing</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {individual.map((m: any) => (
                          <div key={m.id} className="rounded-lg border border-border p-2">
                            <div className="text-xs font-medium capitalize">{m.filmType}</div>
                            <div className="text-xs text-muted-foreground">{m.panel}</div>
                            <div className="text-sm font-medium tabular-nums">{formatCurrency(m.price)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTERIOR VINYL */}
          <TabsContent value="interior_vinyl" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Interior Vinyl / Plastic Repair
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-2 pr-4">Damage Type</th>
                        <th className="text-right font-medium pb-2 px-3">Minor</th>
                        <th className="text-right font-medium pb-2 px-3">Moderate</th>
                        <th className="text-right font-medium pb-2 px-3">Severe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["crack", "tear", "burn", "fade", "puncture"].map((dt) => {
                        const rows = (grouped["interior_vinyl"] || []).filter((m: any) => m.damageType === dt);
                        const getSev = (s: string) => rows.find((r: any) => r.severity === s)?.price || 0;
                        return (
                          <tr key={dt} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 pr-4 font-medium capitalize">{dt}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("minor"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("moderate"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("severe"))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTERIOR FABRIC */}
          <TabsContent value="interior_fabric" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Interior Fabric Repair
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-2 pr-4">Damage Type</th>
                        <th className="text-right font-medium pb-2 px-3">Minor</th>
                        <th className="text-right font-medium pb-2 px-3">Moderate</th>
                        <th className="text-right font-medium pb-2 px-3">Severe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["tear", "burn", "stain", "rip", "hole"].map((dt) => {
                        const rows = (grouped["interior_fabric"] || []).filter((m: any) => m.damageType === dt);
                        const getSev = (s: string) => rows.find((r: any) => r.severity === s)?.price || 0;
                        return (
                          <tr key={dt} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 pr-4 font-medium capitalize">{dt}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("minor"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("moderate"))}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(getSev("severe"))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UPHOLSTERY */}
          <TabsContent value="upholstery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Upholstery / Furniture Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(grouped["upholstery"] || []).map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border p-3 hover:bg-muted/30" data-testid={`row-upholstery-${m.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{formatPanel(m.panel)}</div>
                          {m.unitType && <div className="text-xs text-muted-foreground">per {m.unitType}</div>}
                        </div>
                        <div className="text-lg font-bold tabular-nums">{formatCurrency(m.price)}</div>
                      </div>
                    </div>
                  ))}
                  {(!grouped["upholstery"] || grouped["upholstery"].length === 0) && (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">No upholstery pricing entries</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LABOR */}
          <TabsContent value="labor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Labor Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(grouped["labor"] || []).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3" data-testid={`row-labor-${m.id}`}>
                      <div>
                        <div className="font-medium text-sm">{formatPanel(m.panel)}</div>
                        {m.unitType && <div className="text-xs text-muted-foreground">per {m.unitType}</div>}
                      </div>
                      <div className="text-lg font-bold tabular-nums">{formatCurrency(m.price)}</div>
                    </div>
                  ))}
                  {(!grouped["labor"] || grouped["labor"].length === 0) && (
                    <div className="py-8 text-center text-sm text-muted-foreground">No labor rate entries</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MATERIALS */}
          <TabsContent value="material" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Material Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(grouped["material"] || []).map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border p-3" data-testid={`row-material-${m.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{formatPanel(m.panel)}</div>
                          {m.unitType && <div className="text-xs text-muted-foreground">per {m.unitType}</div>}
                        </div>
                        <div className="text-lg font-bold tabular-nums">{formatCurrency(m.price)}</div>
                      </div>
                    </div>
                  ))}
                  {(!grouped["material"] || grouped["material"].length === 0) && (
                    <div className="py-8 text-center text-sm text-muted-foreground">No material pricing entries</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* QB Sync Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" /> QuickBooks Sync Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QBSyncLog />
        </CardContent>
      </Card>
    </div>
  );
}

// QB Sync Log component
function QBSyncLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["/api/qb-sync"],
    queryFn: () => apiRequest("GET", "/api/qb-sync"),
  });

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading sync logs...</div>;
  }

  const statusColors: Record<string, string> = {
    success: "bg-chart-3/15 text-chart-3",
    pending: "bg-chart-4/15 text-chart-4",
    error: "bg-destructive/15 text-destructive",
  };

  const directionColors: Record<string, string> = {
    push: "bg-chart-1/15 text-chart-1",
    pull: "bg-chart-2/15 text-chart-2",
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left font-medium pb-2 pr-3">Direction</th>
              <th className="text-left font-medium pb-2 pr-3">Record Type</th>
              <th className="text-left font-medium pb-2 pr-3">Record ID</th>
              <th className="text-left font-medium pb-2 pr-3">QB Transaction ID</th>
              <th className="text-left font-medium pb-2 pr-3">Status</th>
              <th className="text-left font-medium pb-2 pr-3">Message</th>
              <th className="text-right font-medium pb-2">Synced At</th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((log: any) => (
              <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-qb-sync-${log.id}`}>
                <td className="py-2 pr-3">
                  <Badge variant="secondary" className={`text-[10px] ${directionColors[log.syncDirection] || ""}`}>{log.syncDirection}</Badge>
                </td>
                <td className="py-2 pr-3 text-xs">{log.recordType}</td>
                <td className="py-2 pr-3 text-xs tabular-nums">{log.recordId || "—"}</td>
                <td className="py-2 pr-3 text-xs font-mono">{log.qbTxnId || "—"}</td>
                <td className="py-2 pr-3">
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[log.status] || ""}`}>{log.status}</Badge>
                </td>
                <td className="py-2 pr-3 text-xs text-muted-foreground max-w-xs truncate">{log.message || "—"}</td>
                <td className="py-2 text-right text-xs text-muted-foreground">
                  {log.syncedAt ? new Date(log.syncedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No QuickBooks sync activity yet. Sync logs will appear here when invoices, payments, and customers are synced with QuickBooks Enterprise.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        <strong>What gets synced:</strong> Customer records (push), Invoices (push), Payments (push), Line items (push). QuickBooks tax codes map from tax jurisdictions.
      </div>
    </div>
  );
}
