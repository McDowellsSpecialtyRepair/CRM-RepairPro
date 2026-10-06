import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Car, Caravan, Ship, Sofa, Check, Plus } from "lucide-react";
import { CustomerLookup } from "@/components/customer-lookup";
import {VinLookup,useVinAutofill} from "@/components/vin-lookup";
import {normalizeVin} from "@shared/vin";
import { SERVICES, DOMAIN_LABELS, DOMAIN_VEHICLE_TYPES, ASSET_TYPES, ASSET_TYPE_LABELS, type ServiceDef, type ServiceDomain } from "@/lib/services";

const domainIcon: Record<ServiceDomain, any> = { auto: Car, rv: Caravan, marine: Ship, furniture: Sofa };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: number;          // when opened from a customer profile
  initialService?: string;      // pre-select a service
  mode?: "estimate" | "workorder";
  estimateId?: number;          // attach or replace target on an existing estimate
}

export function NewEstimateDialog({ open, onOpenChange, customerId, initialService, mode = "estimate", estimateId }: Props) {
  const isWO = mode === "workorder";
  const [pickedName, setPickedName] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [pickedCustomer, setPickedCustomer] = useState<string>(customerId ? String(customerId) : "");
  const [service, setService] = useState<string>(initialService || "");
  const [itemId, setItemId] = useState<string>("");      // existing vehicle/asset id, "new", or "none"
  const [saving, setSaving] = useState(false);
  const [changingService, setChangingService] = useState(false);
  const [error, setError] = useState("");
  const [newVehicle, setNewVehicle] = useState({ year: "", make: "", model: "", vin: "", vehicleType: "auto", color: "" });
  const fillVin=useVinAutofill(setNewVehicle,newVehicle.vin);
  const [newAsset, setNewAsset] = useState({ assetType: "chair", name: "", location: "", description: "" });

  const cid = customerId ? String(customerId) : pickedCustomer;

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
    enabled: open && !customerId,
  });
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", cid],
    queryFn: () => apiRequest("GET", `/api/customers/${cid}`),
    enabled: open && !!cid,
  });

  const svc: ServiceDef | undefined = SERVICES.find((s) => s.value === service);

  const candidates = useMemo(() => {
    if (!svc || !customer) return [];
    if (svc.target === "asset") return (customer.assets || []).map((a: any) => ({ id: a.id, label: `${a.name || "Unnamed"} (${ASSET_TYPE_LABELS[a.assetType] || a.assetType})`, sub: a.location || a.description || "" }));
    const types = DOMAIN_VEHICLE_TYPES[svc.domain] || [];
    return (customer.vehicles || [])
      .filter((v: any) => types.includes(v.vehicleType))
      .map((v: any) => ({ id: v.id, label: `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim(), sub: v.vin ? `${svc.domain === "marine" ? "HIN" : "VIN"}: ${v.vin}` : "" }));
  }, [svc, customer]);

  const reset = () => {
    setService(initialService || ""); setItemId(""); setError(""); setSaving(false); setChangingService(false);
    setNewVehicle({ year: "", make: "", model: "", vin: "", vehicleType: "auto", color: "" });
    setNewAsset({ assetType: "chair", name: "", location: "", description: "" });
    if (!customerId) { setPickedCustomer(""); setPickedName(""); }
  };

  const chooseService = (value: string) => {
    setService(value);
    setItemId("");
    setChangingService(false);
    const d = SERVICES.find((s) => s.value === value)?.domain;
    setNewVehicle((nv) => ({ ...nv, vehicleType: d === "rv" ? "rv" : d === "marine" ? "marine" : "auto" }));
  };

  const effectiveItem = itemId || (svc ? (candidates.length === 0 ? "new" : candidates.length === 1 ? String(candidates[0].id) : "") : "");

  const canCreate = !!cid && !!svc && (
    effectiveItem === "none" ||
    (effectiveItem === "new" && (svc.target === "asset" ? !!newAsset.name.trim() : !!(newVehicle.make.trim() || newVehicle.model.trim()))) ||
    (effectiveItem !== "" && effectiveItem !== "new" && effectiveItem !== "none")
  );

  const create = async () => {
    if (!svc || !cid) return;
    setSaving(true); setError("");
    try {
      let vehicleId: number | null = null;
      let assetId: number | null = null;
      if (effectiveItem === "new") {
        if (svc.target === "asset") {
          const a = await apiRequest("POST", "/api/assets", { ...newAsset, customerId: parseInt(cid) });
          assetId = a.id;
          setItemId(String(a.id));
          await queryClient.invalidateQueries({queryKey:["/api/customers",cid]});
        } else {
          const v = await apiRequest("POST", "/api/vehicles", { ...newVehicle, vehicleType:svc.domain==="rv"?"rv":svc.domain==="marine"?"marine":newVehicle.vehicleType, vin: newVehicle.vin.toUpperCase() || null, customerId: parseInt(cid) });
          vehicleId = v.id;
          setItemId(String(v.id));
          await queryClient.invalidateQueries({queryKey:["/api/customers",cid]});
        }
      } else if (effectiveItem !== "none") {
        if (svc.target === "asset") assetId = parseInt(effectiveItem); else vehicleId = parseInt(effectiveItem);
      }
      if(estimateId) {
        await apiRequest("PATCH",`/api/estimates/${estimateId}`,{vehicleId,assetId});
        await queryClient.invalidateQueries({queryKey:["/api/estimates",String(estimateId)]});
        await queryClient.invalidateQueries({queryKey:["/api/assets"]});
        onOpenChange(false);reset();return;
      }
      if (isWO) {
        const v = vehicleId ? (customer?.vehicles || []).find((x: any) => x.id === vehicleId) : null;
        const a = assetId ? (customer?.assets || []).find((x: any) => x.id === assetId) : null;
        const target = v ? `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() : a ? a.name : (effectiveItem === "new" ? (svc.target === "asset" ? newAsset.name : `${newVehicle.year} ${newVehicle.make} ${newVehicle.model}`.trim()) : "");
        const job = await apiRequest("POST", "/api/jobs", {
          customerId: parseInt(cid), serviceType: svc.value, vehicleId, assetId,
          title: `${svc.label}${target ? " - " + target : ""}`, status: "pending", priority: "normal",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", cid] });
        onOpenChange(false); reset();
        navigate(`/jobs/${job.id}`);
        return;
      }
      const est = await apiRequest("POST", "/api/estimates", {
        customerId: parseInt(cid), serviceType: svc.value, vehicleId, assetId,
        status: "draft", subtotal: 0, taxRate: 6, taxAmount: 0, discount: 0, total: 0,
        notes: svc.label,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", cid] });
      onOpenChange(false);
      reset();
      navigate(`/estimates/${est.id}`);
    } catch (e: any) {
      setError(e.message || "Could not create estimate");
      setSaving(false);
    }
  };

  const domains: ServiceDomain[] = ["auto", "rv", "marine", "furniture"];
  const vehicleWord = svc?.domain === "marine" ? "boat" : svc?.domain === "rv" ? "RV" : "vehicle";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{estimateId ? "Assign estimate item" : isWO ? "New Work Order" : "New Estimate"}</DialogTitle>
          <DialogDescription>
            {isWO ? "Choose the service, then what the work is being done on." : "Choose the service and what it's on. The damage splat and pricing matrix open on the next screen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!customerId && (
            <div className="space-y-1.5">
              <Label>Customer</Label>
              {pickedCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-primary bg-primary/5 p-2.5">
                  <span className="text-sm font-medium">{pickedName}</span>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setPickedCustomer(""); setPickedName(""); setItemId(""); }}>Change</button>
                </div>
              ) : (
                <CustomerLookup autoFocus placeholder="Find customer: name, phone, email, VIN, plate…" onSelect={(c) => { setPickedCustomer(String(c.id)); setPickedName(`${c.name} (${c.customerNumber})`); setItemId(""); }} />
              )}
            </div>
          )}

          {/* Step 1: service */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>1. Service</Label>
              {svc && !changingService && !estimateId && <button type="button" className="text-xs text-primary hover:underline" onClick={() => setChangingService(true)} data-testid="button-change-service">Change</button>}
            </div>
            {svc && !changingService ? (
              <div className="rounded-md border border-primary bg-primary/5 p-2.5">
                <div className="text-xs text-muted-foreground">{DOMAIN_LABELS[svc.domain]}</div>
                <div className="text-sm font-medium">{svc.label}</div>
              </div>
            ) : (
            <div className="space-y-3">
              {domains.map((d) => {
                const Icon = domainIcon[d];
                return (
                  <div key={d}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      <Icon className="h-3.5 w-3.5" /> {DOMAIN_LABELS[d]}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SERVICES.filter((s) => s.domain === d).map((s) => {
                        const active = service === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => chooseService(s.value)}
                            className={`text-left rounded-md border p-2.5 transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            data-testid={`button-service-${s.value}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{s.label}</span>
                              {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Step 2: vehicle / asset */}
          {svc && cid && (
            <div className="space-y-2">
              <Label>2. {svc.target === "asset" ? "Item / location" : `Which ${vehicleWord}?`}</Label>
              <div className="space-y-2">
                {candidates.map((c: any) => (
                  <button key={c.id} type="button" onClick={() => setItemId(String(c.id))}
                    className={`w-full text-left rounded-md border p-2.5 ${effectiveItem === String(c.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    data-testid={`button-item-${c.id}`}>
                    <div className="text-sm font-medium">{c.label}</div>
                    {c.sub && <div className="text-xs text-muted-foreground font-mono">{c.sub}</div>}
                  </button>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={effectiveItem === "new" ? "default" : "outline"} onClick={() => setItemId("new")} data-testid="button-item-new">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add new {svc.target === "asset" ? "item" : vehicleWord}
                  </Button>
                  <Button type="button" size="sm" variant={effectiveItem === "none" ? "default" : "outline"} onClick={() => setItemId("none")} data-testid="button-item-none">
                    Skip, add later
                  </Button>
                </div>
              </div>

              {effectiveItem === "new" && svc.target === "vehicle" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-md border border-border p-3">
                  <div className="col-span-full"><Label htmlFor="estimate-vin" className="text-xs">{svc.domain === "marine" ? "HIN / VIN (optional)" : "VIN (automatic lookup)"}</Label><Input id="estimate-vin" autoComplete="off" className="font-mono uppercase" value={newVehicle.vin} onChange={(e) => setNewVehicle({ ...newVehicle, vin: normalizeVin(e.target.value) })} placeholder="Enter or scan VIN" /></div>
                  <div className="col-span-full"><VinLookup vin={newVehicle.vin} customerId={Number(cid)} enabled={open} onDecoded={fillVin} onUseVehicle={v=>setItemId(String(v.id))}/></div>
                  <div><Label className="text-xs">Year</Label><Input aria-label="Vehicle year" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} placeholder="2021" /></div>
                  <div><Label className="text-xs">Make</Label><Input aria-label="Vehicle make" value={newVehicle.make} onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })} placeholder={svc.domain === "marine" ? "Sea Ray" : svc.domain === "rv" ? "Forest River" : "Honda"} /></div>
                  <div><Label className="text-xs">Model</Label><Input aria-label="Vehicle model" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} placeholder={svc.domain === "marine" ? "Sundancer 320" : svc.domain === "rv" ? "Georgetown" : "Accord"} /></div>
                  <div><Label className="text-xs">Trim</Label><Input aria-label="Vehicle trim" value={(newVehicle as any).trim||""} onChange={e=>setNewVehicle({...newVehicle,trim:e.target.value} as any)}/></div>
                  {svc.domain === "auto" ? (
                    <div><Label className="text-xs">Type</Label>
                      <Select value={newVehicle.vehicleType} onValueChange={(v) => setNewVehicle({ ...newVehicle, vehicleType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Car / SUV</SelectItem>
                          <SelectItem value="truck">Pickup / Truck</SelectItem>
                          <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div><Label className="text-xs">Color</Label><Input value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })} /></div>
                  )}
                </div>
              )}

              {effectiveItem!=="new"&&effectiveItem!=="none"&&svc.target==="vehicle"&&<VinLookup enabled={open} vin={customer?.vehicles?.find((v:any)=>String(v.id)===effectiveItem)?.vin||""} customerId={Number(cid)}/>}
              {effectiveItem === "new" && svc.target === "asset" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border p-3">
                  <div><Label className="text-xs">Type</Label>
                    <Select value={newAsset.assetType} onValueChange={(v) => setNewAsset({ ...newAsset, assetType: v })}>
                      <SelectTrigger data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Name</Label><Input value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="e.g. Dining booths (12)" data-testid="input-asset-name" /></div>
                  <div><Label className="text-xs">Location</Label><Input value={newAsset.location} onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })} placeholder="Address or room" /></div>
                  <div><Label className="text-xs">Description</Label><Input value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} placeholder="Material, color, quantity" /></div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
          <Button onClick={create} disabled={!canCreate || saving} data-testid="button-create-estimate">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} {estimateId ? "Save item assignment" : isWO ? "Create Work Order" : "Create Estimate & Open Splat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
