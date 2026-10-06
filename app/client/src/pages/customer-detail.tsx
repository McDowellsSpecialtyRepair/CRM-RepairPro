import { MergeCustomerDialog } from "@/components/merge-customer-dialog";
import { RelatedWork } from "@/components/related-work";
import { GitMerge, Pencil } from "lucide-react";
import { EditCustomerDialog } from "@/components/edit-customer-dialog";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mail, Phone, MapPin, Car, Building2, User, FileText, Receipt, Activity,
  Search, Plus, Shield, Wrench, Clock, CheckCircle2, Loader2, ChevronRight,
  CreditCard, Truck, ClipboardList
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { NewEstimateDialog } from "@/components/new-estimate-dialog";
import {VinLookup,useVinAutofill} from "@/components/vin-lookup";
import {normalizeVin} from "@shared/vin";
import { SERVICES, SERVICE_LABELS, DOMAIN_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, type ServiceDomain } from "@/lib/services";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const typeColors: Record<string, string> = {
  retail: "bg-chart-1/15 text-chart-1",
  dealership: "bg-chart-2/15 text-chart-2",
  insurance: "bg-chart-3/15 text-chart-3",
  fleet: "bg-chart-4/15 text-chart-4",
  commercial: "bg-chart-5/15 text-chart-5",
};

const warrantyBadge = (status: string) => {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Under Warranty</Badge>;
  if (status === "expired") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Warranty Expired</Badge>;
  return <Badge variant="secondary" className="text-[10px]">No Warranty</Badge>;
};

const serviceTypeLabel: Record<string, string> = SERVICE_LABELS;

const vehicleTypeLabel: Record<string, string> = {
  auto: "Auto",
  truck: "Truck",
  rv: "RV",
  marine: "Marine",
  motorcycle: "Motorcycle",
  other: "Other",
};

export default function CustomerDetail() {
  const [match, params] = useRoute("/customers/:id");
  const id = params?.id;
  const queryClient = useQueryClient();

  // VIN decode dialog state
  const [vinDialogOpen, setVinDialogOpen] = useState(false);

  // Add vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    vin: "", year: "", make: "", model: "", trim: "", bodyClass: "",
    color: "", engineInfo: "", fuelType: "", gvwr: "", plantCountry: "",
    licensePlate: "", vehicleType: "auto", notes: ""
  });
  const fillVin=useVinAutofill(setVehicleForm,vehicleForm.vin);

  // Service history detail dialog
  const [historyDetail, setHistoryDetail] = useState<any>(null);

  // New estimate + asset dialogs
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [estimateService, setEstimateService] = useState<string | undefined>(undefined);
  const openEstimate = (svc?: string) => { setEstimateService(svc); setEstimateOpen(true); };
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ assetType: "chair", name: "", location: "", description: "", notes: "" });

  const { data: allEstimates } = useQuery({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates"),
  });

  const saveAsset = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", { ...data, customerId: parseInt(id!) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      setAssetOpen(false);
      setAssetForm({ assetType: "chair", name: "", location: "", description: "", notes: "" });
    },
  });

  const { data: customer, isLoading } = useQuery({
    queryKey: ["/api/customers", id],
    queryFn: () => apiRequest("GET", `/api/customers/${id}`),
    enabled: !!id,
  });

  const saveVehicle = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/vehicles", { ...data, customerId: parseInt(id!) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      setVinDialogOpen(false);
      setVehicleForm({ vin: "", year: "", make: "", model: "", trim: "", bodyClass: "", color: "", engineInfo: "", fuelType: "", gvwr: "", plantCountry: "", licensePlate: "", vehicleType: "auto", notes: "" });
    },
  });

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const name = customer.companyName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  const initials = customer.companyName
    ? customer.companyName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : `${customer.firstName?.[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase();

  const activeWarranties = (customer.serviceHistory || []).filter((h: any) => h.warrantyStatus === "active").length;
  const totalServices = (customer.serviceHistory || []).length;
  const customerEstimates = (allEstimates || []).filter((e: any) => e.customerId === customer.id).slice().reverse();
  const vehicleById = Object.fromEntries((customer.vehicles || []).map((v: any) => [v.id, v]));
  const assetById = Object.fromEntries((customer.assets || []).map((a: any) => [a.id, a]));
  const estStatusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground", sent: "bg-chart-4/15 text-chart-4", approved: "bg-chart-3/15 text-chart-3",
    invoiced: "bg-chart-1/15 text-chart-1", rejected: "bg-destructive/15 text-destructive",
  };
  const domainOrder: ServiceDomain[] = ["auto", "rv", "marine", "furniture"];

  return (
    <div className="space-y-6">
      <Link href="/customers" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to Customers
      </Link>

      {/* Customer header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  {name}
                </h1>
                <Badge variant="secondary" className={typeColors[customer.customerType] || ""}>
                  {customer.customerType}
                </Badge>
                <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                  {customer.status}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                {customer.email && (
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>
                )}
                {customer.mobile && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.mobile}</span>
                )}
                {(customer.city || customer.state) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {customer.address}{customer.address && customer.city ? ", " : ""}{customer.city}{customer.city && customer.state ? ", " : ""}{customer.state} {customer.zip}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Car className="h-3.5 w-3.5" /> {customer.vehicles?.length || 0} Vehicles</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> {customer.assets?.length || 0} Furniture / Commercial Items</span>
                <span className="flex items-center gap-1 text-muted-foreground"><FileText className="h-3.5 w-3.5" /> {customerEstimates.length} Estimates</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Wrench className="h-3.5 w-3.5" /> {totalServices} Services</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3.5 w-3.5 text-green-600" /> {activeWarranties} Active Warranties</span>
                {(customer?.coiCertificates?.length || 0) > 0 && <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3.5 w-3.5" /> {customer.coiCertificates.length} COI</span>}
                {(customer?.thirdPartyPayers?.length || 0) > 0 && <span className="flex items-center gap-1 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /> {customer.thirdPartyPayers.length} Payers</span>}
                {(customer?.fleetAccounts?.length || 0) > 0 && <span className="flex items-center gap-1 text-muted-foreground"><Truck className="h-3.5 w-3.5" /> {customer.fleetAccounts.length} Fleet</span>}
                {(customer?.assetDetails?.length || 0) > 0 && <span className="flex items-center gap-1 text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" /> {customer.assetDetails.length} Assets</span>}
              </div>
            </div>
            <div className="hidden sm:flex flex-col gap-2 shrink-0">
              <Button onClick={() => openEstimate()} data-testid="button-new-estimate-header"><Plus className="h-4 w-4 mr-1" /> New Estimate</Button>
              <Button variant="outline" onClick={() => setWoOpen(true)} data-testid="button-new-wo-header"><Wrench className="h-4 w-4 mr-1" /> New Work Order</Button>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditOpen(true)} data-testid="button-edit-header"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setMergeOpen(true)} data-testid="button-merge-header"><GitMerge className="h-4 w-4 mr-1" /> Merge</Button>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
            <Button onClick={() => openEstimate()} data-testid="button-new-estimate-mobile"><Plus className="h-4 w-4 mr-1" /> New Estimate</Button>
            <Button variant="outline" onClick={() => setWoOpen(true)} data-testid="button-new-wo-mobile"><Wrench className="h-4 w-4 mr-1" /> Work Order</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-mobile"><Pencil className="h-4 w-4 mr-1" /> Edit info</Button>
            <Button variant="ghost" size="sm" onClick={() => setMergeOpen(true)} data-testid="button-merge-mobile"><GitMerge className="h-4 w-4 mr-1" /> Merge duplicate</Button>
          </div>
        </CardContent>
      </Card>

      <EditCustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} onMergeRequest={() => setMergeOpen(true)} />
      <MergeCustomerDialog open={mergeOpen} onOpenChange={setMergeOpen} customer={customer} />
      <NewEstimateDialog open={woOpen} onOpenChange={setWoOpen} customerId={customer.id} mode="workorder" key={`wo-${customer.id}`} />
      <NewEstimateDialog open={estimateOpen} onOpenChange={setEstimateOpen} customerId={customer.id} initialService={estimateService} key={estimateService || "any"} />

      <Tabs defaultValue="estimates" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="estimates" data-testid="tab-estimates">Estimates & Services</TabsTrigger>
          <TabsTrigger value="vehicles" data-testid="tab-vehicles">Vehicles & Assets</TabsTrigger>
          <TabsTrigger value="service-history" data-testid="tab-service-history">Service History</TabsTrigger>
          <TabsTrigger value="warranty" data-testid="tab-warranty">Warranty Tracking</TabsTrigger>
          <TabsTrigger value="coi" data-testid="tab-coi">COI / Insurance</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing / Third-Party</TabsTrigger>
          <TabsTrigger value="fleet" data-testid="tab-fleet">Fleet Account</TabsTrigger>
          <TabsTrigger value="asset-details" data-testid="tab-asset-details">Asset Details</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        {/* Estimates & Services Tab */}
        <TabsContent value="estimates" className="space-y-3">
          <RelatedWork customerId={customer.id} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Start an estimate</CardTitle>
              <p className="text-xs text-muted-foreground">Pick a service. You'll choose the vehicle, RV, boat, or furniture item next, or add a new one.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {domainOrder.map((d) => (
                <div key={d}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{DOMAIN_LABELS[d]}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {SERVICES.filter((s) => s.domain === d).map((s) => (
                      <button key={s.value} type="button" onClick={() => openEstimate(s.value)}
                        className="text-left rounded-md border border-border p-3 hover:border-primary/60 hover:bg-muted/30 transition-colors"
                        data-testid={`button-start-${s.value}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{s.label}</span>
                          <Plus className="h-4 w-4 text-primary shrink-0" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Estimates ({customerEstimates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {customerEstimates.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No estimates yet for this customer</p>
              ) : (
                <div className="space-y-2">
                  {customerEstimates.map((e: any) => {
                    const v = e.vehicleId ? vehicleById[e.vehicleId] : null;
                    const a = e.assetId ? assetById[e.assetId] : null;
                    const target = v ? `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() : a ? `${a.name || ""} (${ASSET_TYPE_LABELS[a.assetType] || a.assetType})` : "No item attached";
                    return (
                      <Link key={e.id} href={`/estimates/${e.id}`}>
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:border-primary/50 hover:bg-muted/30 cursor-pointer" data-testid={`row-estimate-${e.id}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{e.estimateNumber}</span>
                              <Badge variant="outline" className="text-[10px]">{serviceTypeLabel[e.serviceType] || e.serviceType}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">{target}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(e.total)}</span>
                            <Badge variant="secondary" className={`text-[10px] ${estStatusColor[e.status] || ""}`}>{e.status}</Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicles & Assets Tab */}
        <TabsContent value="vehicles" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" /> Vehicles, RVs & Boats ({customer.vehicles?.length || 0})
              </CardTitle>
              <Dialog open={vinDialogOpen} onOpenChange={setVinDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-vehicle"><Plus className="h-4 w-4 mr-1" /> Add Vehicle</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Vehicle, RV, or Boat</DialogTitle>
                    <p className="text-xs text-muted-foreground">Decode a 17-character VIN, or skip the decode and type the details in (boats use a HIN).</p>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* VIN Input */}
                    <div className="space-y-2">
                      <Label htmlFor="vin-input">Vehicle Identification Number (VIN)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="vin-input"
                          placeholder="Enter 17-character VIN"
                          value={vehicleForm.vin}
                          onChange={(e) => setVehicleForm({...vehicleForm,vin:normalizeVin(e.target.value)})}
                          className="font-mono text-sm uppercase"
                          data-testid="input-vin"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Lookup starts automatically. Manufacturer data can be incomplete, especially for older vehicles and RV coach details. Boat HIN specifications need manual entry.</p>
                    </div>

                    <VinLookup vin={vehicleForm.vin} customerId={Number(id)} enabled={vinDialogOpen} onDecoded={fillVin}/>
                    {saveVehicle.isError&&<p role="alert" className="text-sm text-destructive">{saveVehicle.error.message}</p>}

                    {/* Manual fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="v-year">Year</Label>
                        <Input id="v-year" value={vehicleForm.year} onChange={(e) => setVehicleForm({...vehicleForm, year: e.target.value})} placeholder="e.g. 2021" />
                      </div>
                      <div>
                        <Label htmlFor="v-make">Make</Label>
                        <Input id="v-make" value={vehicleForm.make} onChange={(e) => setVehicleForm({...vehicleForm, make: e.target.value})} placeholder="e.g. Honda, Forest River, Sea Ray" data-testid="input-vehicle-make" />
                      </div>
                      <div>
                        <Label htmlFor="v-model">Model</Label>
                        <Input id="v-model" value={vehicleForm.model} onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})} placeholder="e.g. Accord" data-testid="input-vehicle-model" />
                      </div>
                      <div>
                        <Label htmlFor="v-trim">Trim</Label>
                        <Input id="v-trim" value={vehicleForm.trim} onChange={(e) => setVehicleForm({...vehicleForm,trim:e.target.value})} placeholder="Optional" />
                      </div>
                      <div>
                        <Label htmlFor="v-color">Color</Label>
                        <Input id="v-color" value={vehicleForm.color} onChange={(e) => setVehicleForm({...vehicleForm, color: e.target.value})} placeholder="e.g. Silver" />
                      </div>
                      <div>
                        <Label htmlFor="v-plate">License Plate</Label>
                        <Input id="v-plate" value={vehicleForm.licensePlate} onChange={(e) => setVehicleForm({...vehicleForm, licensePlate: e.target.value})} placeholder="e.g. IDA-1234" />
                      </div>
                      <div>
                        <Label htmlFor="v-type">Vehicle Type</Label>
                        <Select value={vehicleForm.vehicleType} onValueChange={(v) => setVehicleForm({...vehicleForm, vehicleType: v})}>
                          <SelectTrigger id="v-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="truck">Truck</SelectItem>
                            <SelectItem value="rv">RV</SelectItem>
                            <SelectItem value="marine">Marine</SelectItem>
                            <SelectItem value="motorcycle">Motorcycle</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="v-notes">Notes</Label>
                        <Input id="v-notes" value={vehicleForm.notes} onChange={(e) => setVehicleForm({...vehicleForm, notes: e.target.value})} placeholder="Optional notes" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setVinDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => saveVehicle.mutate(vehicleForm)}
                      disabled={!(vehicleForm.vin || vehicleForm.make || vehicleForm.model) || saveVehicle.isPending}
                      data-testid="button-save-vehicle"
                    >
                      {saveVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Save Vehicle
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {customer.vehicles?.length > 0 ? (
                <div className="space-y-2">
                  {customer.vehicles.map((v: any) => (
                    <Link key={v.id} href={`/vehicles/${v.id}`}>
                      <div className="flex items-center justify-between rounded-md border border-border p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`div-vehicle-${v.id}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{v.year} {v.make} {v.model}</span>
                            {v.trim && <span className="text-xs text-muted-foreground">{v.trim}</span>}
                            {v.color && <span className="text-xs text-muted-foreground">• {v.color}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            VIN: <span className="font-mono">{v.vin}</span>
                            {v.licensePlate && ` • Plate: ${v.licensePlate}`}
                          </div>
                          {(v.bodyClass || v.engineInfo || v.fuelType) && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {v.bodyClass}{v.bodyClass && v.engineInfo ? " • " : ""}{v.engineInfo}{v.engineInfo && v.fuelType && !v.engineInfo.includes(v.fuelType) ? " • " : ""}{v.engineInfo && v.engineInfo.includes(v.fuelType) ? "" : v.fuelType}
                              {v.plantCountry && ` • Made in ${v.plantCountry}`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">{vehicleTypeLabel[v.vehicleType] || v.vehicleType}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No vehicles on file yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add Vehicle" to decode a VIN or enter a vehicle, RV, or boat manually</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Furniture & Commercial Items ({customer.assets?.length || 0})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setAssetOpen(true)} data-testid="button-add-asset"><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </CardHeader>
              <CardContent>
                {(customer.assets?.length || 0) === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No chairs, sofas, booths, or other items on file</p>}
                <div className="space-y-2">
                  {customer.assets.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`div-asset-${a.id}`}>
                      <div>
                        <span className="text-sm font-medium">{a.name}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                        {a.location && <div className="text-xs text-muted-foreground">Location: {a.location}</div>}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{ASSET_TYPE_LABELS[a.assetType] || a.assetType}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Furniture or Commercial Item</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={assetForm.assetType} onValueChange={(v) => setAssetForm({ ...assetForm, assetType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. Lobby chairs (8)" /></div>
              <div><Label>Location</Label><Input value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} placeholder="Address or room" /></div>
              <div><Label>Description</Label><Input value={assetForm.description} onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })} placeholder="Material, color, quantity" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssetOpen(false)}>Cancel</Button>
              <Button onClick={() => saveAsset.mutate(assetForm)} disabled={!assetForm.name.trim() || saveAsset.isPending} data-testid="button-save-asset">
                {saveAsset.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Service History Tab */}
        <TabsContent value="service-history" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Service History ({totalServices})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.serviceHistory?.length > 0 ? (
                <div className="space-y-3">
                  {customer.serviceHistory.map((h: any) => {
                    const linkedVehicle = customer.vehicles?.find((v: any) => v.id === h.vehicleId);
                    const linkedAsset = customer.assets?.find((a: any) => a.id === h.assetId);
                    return (
                      <div key={h.id} className="rounded-md border border-border p-3" data-testid={`div-service-history-${h.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">{serviceTypeLabel[h.serviceType] || h.serviceType}</Badge>
                              <Badge variant={h.status === "completed" ? "default" : "secondary"} className="text-[10px]">{h.status}</Badge>
                              {warrantyBadge(h.warrantyStatus)}
                            </div>
                            <p className="text-sm font-medium mt-1.5">{h.description}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(h.serviceDate)}</span>
                              {h.technician && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {h.technician}</span>}
                              {linkedVehicle && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {linkedVehicle.year} {linkedVehicle.make} {linkedVehicle.model}</span>}
                              {linkedAsset && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {linkedAsset.name}</span>}
                              {h.cost > 0 && <span className="flex items-center gap-1 font-medium text-foreground">{formatCurrency(h.cost)}</span>}
                            </div>
                            {h.warrantyExpiry && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Warranty: {h.warrantyMonths} months • Expires {formatDate(h.warrantyExpiry)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No service history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Service history entries are created when jobs are completed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warranty Tracking Tab */}
        <TabsContent value="warranty" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Warranty Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{activeWarranties}</div>
                  <div className="text-[10px] text-muted-foreground">Active Warranties</div>
                </div>
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {(customer.serviceHistory || []).filter((h: any) => h.warrantyStatus === "expired").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Expired</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {(customer.serviceHistory || []).filter((h: any) => h.warrantyStatus === "none").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">No Warranty</div>
                </div>
              </div>
              {customer.serviceHistory?.filter((h: any) => h.warrantyStatus !== "none").length > 0 ? (
                <div className="space-y-2">
                  {customer.serviceHistory.filter((h: any) => h.warrantyStatus !== "none").map((h: any) => {
                    const linkedVehicle = customer.vehicles?.find((v: any) => v.id === h.vehicleId);
                    const today = new Date();
                    const expiry = h.warrantyExpiry ? new Date(h.warrantyExpiry) : null;
                    const daysLeft = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    return (
                      <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`div-warranty-${h.id}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {warrantyBadge(h.warrantyStatus)}
                            <span className="text-sm font-medium truncate">{h.description}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {linkedVehicle && `${linkedVehicle.year} ${linkedVehicle.make} ${linkedVehicle.model} • `}
                            Service date: {formatDate(h.serviceDate)}
                            {h.warrantyExpiry && ` • Warranty expires: ${formatDate(h.warrantyExpiry)}`}
                          </div>
                          {daysLeft !== null && daysLeft > 0 && h.warrantyStatus === "active" && (
                            <div className="text-[10px] text-green-600 mt-0.5">
                              {daysLeft} days remaining on warranty
                            </div>
                          )}
                          {daysLeft !== null && daysLeft <= 0 && (
                            <div className="text-[10px] text-red-600 mt-0.5">
                              Warranty expired {Math.abs(daysLeft)} days ago
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-xs font-medium">{h.warrantyMonths} months</div>
                          <div className="text-[10px] text-muted-foreground">{serviceTypeLabel[h.serviceType] || h.serviceType}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No warranty-tracked services for this customer</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COI / Insurance Tab */}
        <TabsContent value="coi" className="space-y-3">
          {(customer?.coiCertificates || []).map((coi: any) => (
            <Card key={coi.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{coi.certificateName}</span>
                      <Badge variant="secondary" className={coi.status === "expired" ? "bg-destructive/15 text-destructive" : coi.status === "expiring" ? "bg-chart-4/15 text-chart-4" : "bg-chart-3/15 text-chart-3"}>{coi.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Insurance: {coi.insuranceCompany}</div>
                      {coi.policyNumber && <div>Policy #: {coi.policyNumber}</div>}
                      {coi.policyType && <div>Type: {coi.policyType}</div>}
                      {coi.coverageLimit && <div>Coverage: {coi.coverageLimit}</div>}
                      {coi.certificateHolder && <div>Holder: {coi.certificateHolder}</div>}
                      <div className="flex gap-4 mt-1">
                        {coi.effectiveDate && <span>Effective: {coi.effectiveDate}</span>}
                        {coi.expirationDate && <span>Expires: {coi.expirationDate}</span>}
                      </div>
                      {coi.agentName && <div className="mt-1">Agent: {coi.agentName}{coi.agentPhone ? ` | ${coi.agentPhone}` : ""}{coi.agentEmail ? ` | ${coi.agentEmail}` : ""}</div>}
                      {coi.requiredBeforeWork === 1 && <Badge variant="outline" className="text-[10px] mt-1">Required Before Work</Badge>}
                    </div>
                    {coi.notes && <div className="text-xs text-muted-foreground italic mt-1">{coi.notes}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!customer?.coiCertificates || customer.coiCertificates.length === 0) && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No COI certificates on file</CardContent></Card>
          )}
        </TabsContent>

        {/* Billing / Third-Party Payers Tab */}
        <TabsContent value="billing" className="space-y-3">
          {(customer?.thirdPartyPayers || []).map((payer: any) => (
            <Card key={payer.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{payer.payerName}</span>
                      <Badge variant="secondary" className="bg-chart-1/15 text-chart-1 text-[10px]">{payer.payerType}</Badge>
                      <Badge variant="outline" className={payer.status === "active" ? "text-chart-3" : "text-muted-foreground"}>{payer.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {payer.contactName && <div>Contact: {payer.contactName}{payer.contactTitle ? ` (${payer.contactTitle})` : ""}</div>}
                      {payer.email && <div>{payer.email}</div>}
                      {payer.phone && <div>{payer.phone}</div>}
                      {payer.billingAddress && <div>{payer.billingAddress}{payer.billingCity ? `, ${payer.billingCity}` : ""}{payer.billingState ? `, ${payer.billingState}` : ""}{payer.billingZip ? ` ${payer.billingZip}` : ""}</div>}
                      {payer.accountNumber && <div>Account #: {payer.accountNumber}</div>}
                      {payer.claimNumber && <div>Claim #: {payer.claimNumber}</div>}
                      {payer.authorizationNumber && <div>Auth #: {payer.authorizationNumber}</div>}
                      {payer.paymentTerms && <div>Terms: {payer.paymentTerms}</div>}
                      <div className="flex gap-3 mt-1">
                        {payer.poRequired === 1 && <Badge variant="outline" className="text-[10px]">PO Required</Badge>}
                        {payer.approvalRequired === 1 && <Badge variant="outline" className="text-[10px]">Approval Required</Badge>}
                        {payer.taxExempt === 1 && <Badge variant="outline" className="text-[10px]">Tax Exempt</Badge>}
                      </div>
                    </div>
                    {payer.notes && <div className="text-xs text-muted-foreground italic mt-1">{payer.notes}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!customer?.thirdPartyPayers || customer.thirdPartyPayers.length === 0) && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No third-party payers on file</CardContent></Card>
          )}
        </TabsContent>

        {/* Fleet Account Tab */}
        <TabsContent value="fleet" className="space-y-3">
          {(customer?.fleetAccounts || []).map((fleet: any) => (
            <Card key={fleet.id}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{fleet.fleetName}</span>
                    <Badge variant="secondary" className="bg-chart-1/15 text-chart-1 text-[10px]">Fleet Size: {fleet.fleetSize}</Badge>
                    <Badge variant="outline" className={fleet.status === "active" ? "text-chart-3" : "text-muted-foreground"}>{fleet.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {fleet.accountNumber && <div>Account #: {fleet.accountNumber}</div>}
                    {fleet.billingCycle && <div>Billing Cycle: {fleet.billingCycle}</div>}
                    {fleet.paymentTerms && <div>Payment Terms: {fleet.paymentTerms}</div>}
                    {fleet.contractedRateType && <div>Rate Type: {fleet.contractedRateType}</div>}
                    <div className="flex gap-3 flex-wrap mt-1">
                      {fleet.pdrDiscountPercent > 0 && <Badge variant="outline" className="text-[10px]">PDR -{fleet.pdrDiscountPercent}%</Badge>}
                      {fleet.hailDiscountPercent > 0 && <Badge variant="outline" className="text-[10px]">Hail -{fleet.hailDiscountPercent}%</Badge>}
                      {fleet.interiorDiscountPercent > 0 && <Badge variant="outline" className="text-[10px]">Interior -{fleet.interiorDiscountPercent}%</Badge>}
                      {fleet.tintDiscountPercent > 0 && <Badge variant="outline" className="text-[10px]">Tint -{fleet.tintDiscountPercent}%</Badge>}
                      {fleet.laborRate > 0 && <Badge variant="outline" className="text-[10px]">Labor ${fleet.laborRate}/hr</Badge>}
                    </div>
                    <div className="flex gap-3 mt-1">
                      {fleet.poRequired === 1 && <Badge variant="outline" className="text-[10px]">PO Required</Badge>}
                      {fleet.authorizationRequired === 1 && <Badge variant="outline" className="text-[10px]">Auth Required</Badge>}
                    </div>
                    {(fleet.contractStartDate || fleet.contractEndDate) && (
                      <div className="mt-1">Contract: {fleet.contractStartDate || "N/A"} to {fleet.contractEndDate || "N/A"}</div>
                    )}
                  </div>
                  {fleet.notes && <div className="text-xs text-muted-foreground italic mt-1">{fleet.notes}</div>}
                  {/* Authorized contacts */}
                  {(customer?.fleetAuthorizedContacts || []).filter((c: any) => c.fleetAccountId === fleet.id).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border">
                      <div className="text-xs font-medium mb-2">Authorized Contacts</div>
                      {(customer?.fleetAuthorizedContacts || []).filter((c: any) => c.fleetAccountId === fleet.id).map((contact: any) => (
                        <div key={contact.id} className="text-xs text-muted-foreground mb-1">
                          {contact.name}{contact.title ? ` - ${contact.title}` : ""}
                          {contact.email ? ` | ${contact.email}` : ""}{contact.phone ? ` | ${contact.phone}` : ""}
                          {contact.approvalLimit > 0 && ` | Limit: $${contact.approvalLimit}`}
                          <div className="flex gap-1 mt-0.5">
                            {contact.canApproveEstimates === 1 && <Badge variant="outline" className="text-[10px]">Estimates</Badge>}
                            {contact.canApproveWork === 1 && <Badge variant="outline" className="text-[10px]">Work</Badge>}
                            {contact.canApproveInvoices === 1 && <Badge variant="outline" className="text-[10px]">Invoices</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!customer?.fleetAccounts || customer.fleetAccounts.length === 0) && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No fleet accounts on file</CardContent></Card>
          )}
        </TabsContent>

        {/* Asset Details Tab */}
        <TabsContent value="asset-details" className="space-y-3">
          {(customer?.assetDetails || []).map((detail: any) => (
            <Card key={detail.id}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{detail.itemName || detail.assetCategory}</span>
                    <Badge variant="secondary" className="bg-chart-1/15 text-chart-1 text-[10px]">{detail.assetCategory}</Badge>
                    <Badge variant="outline" className={detail.status === "active" ? "text-chart-3" : "text-muted-foreground"}>{detail.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {detail.itemType && <div>Type: {detail.itemType}</div>}
                    {detail.manufacturer && <div>Manufacturer: {detail.manufacturer}{detail.model ? ` / ${detail.model}` : ""}</div>}
                    {detail.serialNumber && <div>Serial: {detail.serialNumber}</div>}
                    {detail.materialType && <div>Material: {detail.materialType}{detail.fabricType ? ` / ${detail.fabricType}` : ""}{detail.color ? ` / ${detail.color}` : ""}</div>}
                    {detail.dimensions && <div>Dimensions: {detail.dimensions}</div>}
                    {detail.quantity > 1 && <div>Quantity: {detail.quantity}</div>}
                    {detail.condition && <div>Condition: {detail.condition}</div>}
                    <div className="flex gap-4 mt-1">
                      {detail.locationName && <span>Location: {detail.locationName}</span>}
                      {detail.building && <span>Building: {detail.building}</span>}
                      {detail.roomNumber && <span>Room: {detail.roomNumber}</span>}
                    </div>
                    {detail.damageLocation && <div className="text-destructive">Damage: {detail.damageLocation}</div>}
                    {detail.damageDescription && <div className="text-destructive">{detail.damageDescription}</div>}
                    {detail.repairNotes && <div className="italic">Repair: {detail.repairNotes}</div>}
                    {detail.replacementValue > 0 && <div>Replacement Value: ${detail.replacementValue.toFixed(2)}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!customer?.assetDetails || customer.assetDetails.length === 0) && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No asset details on file</CardContent></Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.contacts?.length > 0 ? (
                <div className="space-y-2">
                  {customer.contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`div-contact-${c.id}`}>
                      <div>
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.title && <span className="ml-2 text-xs text-muted-foreground">{c.title}</span>}
                        <div className="flex gap-x-4 mt-1">
                          {c.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                          {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        </div>
                      </div>
                      {c.isPrimary === 1 && <Badge className="text-[10px]">Primary</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No contacts on file</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.activities?.length > 0 ? (
                <div className="space-y-3">
                  {customer.activities.map((a: any) => (
                    <div key={a.id} className="flex gap-3" data-testid={`div-activity-${a.id}`}>
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-xs leading-relaxed">{a.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {a.performedBy} • {formatDate(a.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
