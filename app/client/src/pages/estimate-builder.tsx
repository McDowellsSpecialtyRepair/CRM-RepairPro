import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SERVICE_LABELS, ASSET_TYPE_LABELS } from "@/lib/services";
import { apiRequest, printDocument } from "@/lib/queryClient";
import { EstimateLabor, DeliveryStatus } from "@/components/labor-sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, CheckCircle, FileText, Send, Printer, User, Car, Shield, Loader2, Mail, Share2, AlertTriangle } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { WorkPlanning } from "@/components/work-planning";
import { EstimateDamageMap, TintMatrixPicker } from "@/components/estimate-damage-map";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useState, useMemo } from "react";
import {VinLookup} from "@/components/vin-lookup";
import {NewEstimateDialog} from "@/components/new-estimate-dialog";
import {categoriesFor,categoryAllowed,templateAllowed,nonLaborCategory,categoryTaxable,repairActionsFor,customerLineLabel,documentBreakdown} from "@shared/estimate-rules";
import {DocumentBreakdown} from "@/components/document-breakdown";
import {EstimateCommercial} from "@/components/estimate-commercial";
import {useAuth} from "@/components/auth-provider";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const defaultCategoryFor: Record<string, string> = {
  pdr: "pdr_dent", hail: "pdr_hail", window_tint: "window_tint",
  interior_repair: "interior_vinyl", rv_interior: "interior_vinyl", marine_interior: "interior_vinyl",
  rv_upholstery: "upholstery", marine_upholstery: "upholstery", upholstery: "upholstery",
};

const unitOptions = ["each", "panel", "hour", "yard", "linear ft", "sq ft", "roll", "sheet", "set", "shipment"];

const damageSizes = ["dime", "nickel", "quarter", "half dollar", "softball", "multiple"];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-chart-4/15 text-chart-4",
  approved: "bg-chart-3/15 text-chart-3",
  rejected: "bg-destructive/15 text-destructive",
  invoiced: "bg-chart-1/15 text-chart-1",
};

const serviceTypeOptions = [
  { value: "pdr", label: "Paintless Dent Repair (Auto)" },
  { value: "hail", label: "Hail Damage Repair (Auto)" },
  { value: "window_tint", label: "Window Tint (Auto)" },
  { value: "interior_repair", label: "Auto Interior Repair" },
  { value: "rv_interior", label: "RV Interior Repair" },
  { value: "rv_upholstery", label: "RV Upholstery" },
  { value: "marine_interior", label: "Marine Interior Repair" },
  { value: "marine_upholstery", label: "Marine Upholstery" },
  { value: "upholstery", label: "Furniture Upholstery" },
];

export default function EstimateBuilder() {
  const {can}=useAuth();
  const [match, params] = useRoute("/estimates/:id");
  const id = params?.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["/api/estimates", id],
    staleTime: 0,
    queryFn: () => apiRequest("GET", `/api/estimates/${id}`),
    enabled: !!id,
  });

  // Load customers, vehicles, templates, pricing matrices
  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });
  const { data: serviceTemplates } = useQuery({
    queryKey: ["/api/service-templates"],
    queryFn: () => apiRequest("GET", "/api/service-templates"),
  });
  const { data: pricingMatrices } = useQuery({
    queryKey: ["/api/pricing-matrices"],
    queryFn: () => apiRequest("GET", "/api/pricing-matrices"),
  });

  const [newItem, setNewItem] = useState({
    unitCost:0,useTaxRate:0,taxNote:"",repairAction:"repair",
    lineType: "labor",
    serviceCategory: "pdr_dent",
    description: "",
    quantity: 1,
    unit: "each",
    unitPrice: 0,
    panelLocation: "",
    damageSize: "",
    damageSeverity: "moderate",
  });

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountDraft, setDiscountDraft] = useState("0");
  const [assignOpen,setAssignOpen] = useState(false);
  const [editingLine,setEditingLine]=useState<any>(null);
  const [taxDraft,setTaxDraft]=useState("");
  const [salesDirty,setSalesDirty]=useState(false),[laborDirty,setLaborDirty]=useState(false);
  const unsavedEdits=salesDirty||laborDirty||!!editingLine||!!newItem.description.trim()||editingDiscount||editingNotes;
  useEffect(()=>setTaxDraft(String(estimate?.taxRate??0)),[estimate?.taxRate,id]);
  const allowedCategories=categoriesFor(estimate?.serviceType||"");
  const allowedTemplates=(serviceTemplates||[]).filter((t:any)=>templateAllowed(estimate?.serviceType,t));

  useEffect(() => {
    const cat = estimate?.serviceType ? defaultCategoryFor[estimate.serviceType] : undefined;
    if (cat) {setEditingLine(null);setShowTemplateMenu(false);setNewItem({lineType:"labor",serviceCategory:cat,description:"",quantity:1,unit:cat==="pdr_hail"?"panel":"each",unitPrice:0,panelLocation:"",damageSize:"",damageSeverity:"moderate",unitCost:0,useTaxRate:0,taxNote:"",repairAction:"repair"});}
  }, [estimate?.serviceType,id]);

  const { data: linkedVehicleData } = useQuery({
    queryKey: ["/api/vehicles", estimate?.vehicleId],
    queryFn: () => apiRequest("GET", `/api/vehicles/${estimate?.vehicleId}`),
    enabled: !!estimate?.vehicleId,
  });

  const { data: customerFull } = useQuery({
    queryKey: ["/api/customers", String(estimate?.customerId)],
    queryFn: () => apiRequest("GET", `/api/customers/${estimate?.customerId}`),
    enabled: !!estimate?.customerId,
  });
  const emailOptions: string[] = Array.from(new Set([customerFull?.email, ...((customerFull?.contacts || []).map((c: any) => c.email))].filter(Boolean)));

  const { data: customerAssets } = useQuery({
    queryKey: ["/api/assets", estimate?.customerId],
    queryFn: () => apiRequest("GET", `/api/assets?customerId=${estimate?.customerId}`),
    enabled: !!estimate?.customerId,
  });

  // Get vehicles for the selected customer
  const selectedCustomer = customers?.find((c: any) => c.id === estimate?.customerId);
  const customerVehicles = selectedCustomer
    ? (customerFull?.vehicles || [])
    : [];

  const addLineItem = useMutation({
    mutationFn: (data: any) => {const payload={...data};if(!can("costs.write"))for(const k of ["unitCost","useTaxRate","taxNote"])delete payload[k];return editingLine?apiRequest("PATCH",`/api/estimates/line-items/${editingLine.id}`,{...payload,expectedVersion:editingLine.allocationVersion}):apiRequest("POST", `/api/estimates/${id}/line-items`, payload);},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      setNewItem({
        unitCost:0,useTaxRate:0,taxNote:"",repairAction:"repair",
        lineType: "labor",
        serviceCategory: defaultCategoryFor[estimate?.serviceType] || "pdr_dent",
        description: "",
        quantity: 1,
        unit: "each",
        unitPrice: 0,
        panelLocation: "",
        damageSize: "",
        damageSeverity: "moderate",
      });
      setEditingLine(null);
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/estimates/line-items/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }),
  });

  const updateEstimate = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/estimates/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }),
  });

  // Send-to-customer dialog
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendResult, setSendResult] = useState<any>(null);
  const [sendError, setSendError] = useState("");
  useEffect(() => { setSendOpen(false); setSendResult(null); setSendError(""); }, [id]);
  const sendEstimate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/estimates/${id}/send`, { to: sendTo, message: sendMessage }),
    onSuccess: (r: any) => {
      setSendResult(r); setSendError("");
      queryClient.invalidateQueries({ queryKey: ["/api/delivery","estimate",id] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: (e: any) => setSendError(String(e.message || "Could not send").replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1")),
  });

  const convertToInvoice = useMutation({
    mutationFn: () => apiRequest("POST", `/api/estimates/${id}/convert-invoice`),
    onSuccess: (invoice: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      navigate(`/invoices/${invoice.id}`);
    },
  });

  // Auto-fill price from pricing matrix
  const autoFillPrice = (category: string, size: string, panel: string) => {
    if (!pricingMatrices || (category !== "pdr_dent" && category !== "pdr_hail")) return;
    if(linkedVehicle?.vehicleType==="motorcycle")return;
    // Normalize size: convert spaces to underscores ("half dollar" -> "half_dollar")
    const normalizedSize = size ? size.replace(/\s+/g, "_").toLowerCase() : "";
    const normalizedPanel = panel ? panel.trim().toLowerCase() : "";
    // Derive vehicle category from body class (Sedan -> sedan, SUV/Pickup/Truck -> suv)
    const bodyClass = `${linkedVehicle?.bodyClass || ""} ${linkedVehicle?.model || ""}`.toLowerCase();
    let vehicleCat = "sedan";
    if (linkedVehicle?.vehicleType==="truck" || /suv|sport utility|mpv|crossover|van|wagon|pickup|truck|f-150|silverado|ram|tacoma|tundra|sierra/.test(bodyClass)) {
      vehicleCat = "suv";
    }
    // Find best match: prefer exact vehicle category match, fall back to any
    const matches = pricingMatrices.filter((m: any) => {
      if (m.matrixType !== category) return false;
      const mSize = (m.sizeCategory || "").toLowerCase();
      const mPanel = (m.panel || "").toLowerCase();
      const sizeMatch = normalizedSize ? mSize === normalizedSize : true;
      // "any" panel in matrix matches any panel the user enters
      const panelMatch = normalizedPanel ? (mPanel === "any" || mPanel === normalizedPanel) : true;
      return sizeMatch && panelMatch;
    });
    // Prefer exact vehicle category, then fall back to first match
    const bestMatch = matches.find((m: any) => (m.vehicleCategory || "").toLowerCase() === vehicleCat) || matches[0];
    if (bestMatch) {
      setNewItem(prev => ({ ...prev, unitPrice: bestMatch.price }));
    }
  };

  const handleCategoryChange = (v: string) => {
    const cat = allowedCategories.find(c => c.value === v);
    setNewItem(prev => ({ ...prev, serviceCategory: v, unit: cat?.defaultUnit || "each",lineType:nonLaborCategory(v)?"parts":"labor",useTaxRate:0,taxNote:"",damageSize:"",repairAction:v==="fabrication"?"fabricate":"repair" }));
  };
  const startLine=(category:string)=>{
    setEditingLine(null);
    setNewItem({lineType:nonLaborCategory(category)?"parts":"labor",serviceCategory:category,description:"",quantity:1,unit:allowedCategories.find(c=>c.value===category)?.defaultUnit||"each",unitPrice:0,panelLocation:"",damageSize:"",damageSeverity:"moderate",unitCost:0,useTaxRate:0,taxNote:"",repairAction:"repair"});
    document.getElementById("estimate-line-editor")?.scrollIntoView({block:"start"});
  };

  const handleSizeChange = (v: string) => {
    setNewItem(prev => ({ ...prev, damageSize: v }));
    autoFillPrice(newItem.serviceCategory, v, newItem.panelLocation);
  };

  const handlePanelChange = (v: string) => {
    setNewItem(prev => ({ ...prev, panelLocation: v }));
    autoFillPrice(newItem.serviceCategory, newItem.damageSize, v);
  };

  const addSplatItems = async (items: any[], insuranceCompany?: string) => {
    await apiRequest("POST", `/api/estimates/${id}/line-items/bulk`, { items, insuranceCompany });
    queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
  };

  // Quick-add from template
  const addFromTemplate = (template: any) => {
    if(!templateAllowed(estimate.serviceType,template)||editingLine)return;
    const itemTotal = 1 * template.basePrice;
    addLineItem.mutate({
      templateId:template.id,lineType:"labor",
      serviceCategory: defaultCategoryFor[estimate.serviceType],
      description: template.name,
      quantity: 1,
      unit: template.unitType || "each",
      unitPrice: template.basePrice,
      total: itemTotal,
      panelLocation: "",
      damageSize: "",
      damageSeverity: "moderate",
    });
    setShowTemplateMenu(false);
  };

  const handleAddItem = () => {
    if (!newItem.description) return;
    const itemTotal = newItem.quantity * newItem.unitPrice;
    addLineItem.mutate({
      ...newItem,
      quantity: Number(newItem.quantity),
      unitPrice: Number(newItem.unitPrice),
      total: itemTotal,
    });
  };

  const handleSaveNotes = () => {
    updateEstimate.mutate({ notes: notesDraft },{onSuccess:()=>setEditingNotes(false)});
  };

  const handleSaveDiscount = () => {
    updateEstimate.mutate({ discount: Number(discountDraft) || 0 },{onSuccess:()=>setEditingDiscount(false)});
  };

  if (isLoading || !estimate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const lineItems = estimate.lineItems || [];
  const subtotal = estimate.subtotal || 0;
  const taxRate = estimate.taxRate || 0;
  const taxAmount = estimate.taxAmount || 0;
  const discount = estimate.discount || 0;
  const total = estimate.total || 0;

  const customerName = selectedCustomer
    ? (selectedCustomer.companyName || `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim())
    : "Not assigned";
  const linkedVehicle = linkedVehicleData || customerVehicles.find((v: any) => v.id === estimate.vehicleId);
  const linkedAsset = (customerAssets || []).find((a: any) => a.id === estimate.assetId);

  return (
    <div className="space-y-6">
      <NewEstimateDialog key={`${estimate.id}-assign`} open={assignOpen} onOpenChange={setAssignOpen} customerId={estimate.customerId} initialService={estimate.serviceType} estimateId={estimate.id}/>
      <div className="flex items-center justify-between">
        <Link href="/estimates" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Estimates
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void printDocument(`/print/estimate/${id}`)}
          data-testid="button-print-estimate"
        >
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      {/* Send to customer dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send {estimate.estimateNumber} to Customer</DialogTitle>
            <DialogDescription>{customerName} · {SERVICE_LABELS[estimate.serviceType] || estimate.serviceType} · {formatCurrency(total)}</DialogDescription>
          </DialogHeader>
          {(() => {
            const items = estimate.lineItems || [];
            const itemText = items.map((li: any) => `- ${li.description || li.serviceCategory}${li.panelLocation ? " (" + li.panelLocation + ")" : ""}: ${li.quantity} x ${formatCurrency(li.unitPrice)} = ${formatCurrency(li.total)}`).join("\n");
            const target = linkedVehicle ? `${linkedVehicle.year || ""} ${linkedVehicle.make || ""} ${linkedVehicle.model || ""}`.trim() : linkedAsset ? linkedAsset.name : "";
            const subject = `Estimate ${estimate.estimateNumber} - McDowells Specialty Repair`;
            const bodyText = `${sendMessage}\n\nEstimate: ${estimate.estimateNumber}\nService: ${SERVICE_LABELS[estimate.serviceType] || estimate.serviceType}${target ? "\nFor: " + target : ""}\n\n${itemText}\n\nSubtotal: ${formatCurrency(subtotal)}\nTax (${taxRate}%): ${formatCurrency(taxAmount)}${discount ? "\nDiscount: -" + formatCurrency(discount) : ""}\nTotal: ${formatCurrency(total)}\n\nValid for 14 days.`;
            const mailto = `mailto:${encodeURIComponent(sendTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
            const canShare = typeof navigator !== "undefined" && !!(navigator as any).share;

            if (sendResult) {
              return (
                <div className="space-y-3">
                  {sendResult.providerAccepted ? (
                    <div className="flex items-start gap-2 rounded-md border border-green-600/40 bg-green-600/10 p-3 text-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                      <div>Email provider accepted this estimate for <strong>{sendResult.to}</strong>. Recipient delivery is not confirmed.</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                        <div>
                          This estimate was <strong>not sent</strong>{sendResult.smtpError ? ` (${sendResult.smtpError})` : ": the email server is not configured"}. Its approval status has not been changed. Opening your email app is only a manual draft, not proof of sending:
                        </div>
                      </div>
                      <a href={mailto} className="block" data-testid="link-mailto-estimate">
                        <Button className="w-full"><Mail className="h-4 w-4 mr-1" /> Open in email app</Button>
                      </a>
                      {canShare && (
                        <Button variant="outline" className="w-full" onClick={() => (navigator as any).share({ title: subject, text: bodyText }).catch(() => {})} data-testid="button-share-estimate">
                          <Share2 className="h-4 w-4 mr-1" /> Share (text, WhatsApp, etc.)
                        </Button>
                      )}
                      <Button variant="outline" className="w-full" onClick={() => void printDocument(`/print/estimate/${id}`)}>
                        <Printer className="h-4 w-4 mr-1" /> Print / Save as PDF to attach
                      </Button>
                    </>
                  )}
                  <DialogFooter><Button variant="outline" onClick={() => setSendOpen(false)}>Done</Button></DialogFooter>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {items.length === 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div>This estimate has no line items and totals $0.00. Add line items before sending.</div>
                  </div>
                )}
                <div>
                  <Label htmlFor="send-to">Test recipient (all test customers)</Label>
                  <Input id="send-to" type="email" value="service@mcdowellsrepair.com" readOnly data-testid="input-send-to" />
                  {!selectedCustomer?.email && <p className="text-xs text-muted-foreground mt-1">No email on file for this customer.</p>}
                  {false && emailOptions.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="send-email-options">
                      {emailOptions.map((e) => (
                        <button key={e} type="button" onClick={() => setSendTo(e)}
                          className={`rounded-full border px-2.5 py-1 text-xs break-all ${sendTo === e ? "border-primary bg-primary/10" : "border-border"}`}>{e}</button>
                      ))}
                      <button type="button" onClick={() => setSendTo(emailOptions.join(", "))} className="rounded-full border border-border px-2.5 py-1 text-xs">Send to all</button>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="send-msg">Message</Label>
                  <Textarea id="send-msg" rows={5} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
                </div>
                {sendError && <p className="text-sm text-destructive">{sendError}</p>}
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                  <Button onClick={() => sendEstimate.mutate()} disabled={!sendTo.trim() || items.length === 0 || sendEstimate.isPending} data-testid="button-confirm-send">
                    {sendEstimate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Send Estimate
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <DeliveryStatus type="estimate" id={id!} />
      {/* Estimate header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  {estimate.estimateNumber}
                </h1>
                <Badge variant="secondary" className={statusColors[estimate.status] || ""}>
                  {estimate.status}
                </Badge>
              </div>

              {/* Customer info */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{customerName}</span>
                  {selectedCustomer && (
                    <Badge variant="outline" className="text-[10px] ml-1">{selectedCustomer.customerType}</Badge>
                  )}
                </div>
                {linkedAsset && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{linkedAsset.name}</span>
                    <span className="text-xs text-muted-foreground">({ASSET_TYPE_LABELS[linkedAsset.assetType] || linkedAsset.assetType}{linkedAsset.location ? ` · ${linkedAsset.location}` : ""})</span>
                  </div>
                )}
                {linkedVehicle && (
                  <div className="flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{linkedVehicle.year} {linkedVehicle.make} {linkedVehicle.model} {linkedVehicle.trim}</span>
                    {linkedVehicle.vin && <span className="text-xs text-muted-foreground font-mono">VIN: {linkedVehicle.vin}</span>}
                  </div>
                )}
              </div>

              {linkedVehicle?.vin&&<VinLookup vin={linkedVehicle.vin} customerId={estimate.customerId} excludeEstimateId={estimate.id}/>}
              {estimate.status!=="invoiced" && <Button variant="outline" size="sm" data-testid="button-assign-estimate-item" onClick={()=>setAssignOpen(true)}>{estimate.assetId||estimate.vehicleId?"Change linked item":"Assign vehicle / item"}</Button>}
              {/* Service type & dates */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>Service: <span className="font-medium text-foreground">{SERVICE_LABELS[estimate.serviceType] || estimate.serviceType?.replace(/_/g, " ") || "N/A"}</span></span>
                <span>Created: <span className="font-medium text-foreground">{new Date(estimate.createdAt).toLocaleDateString()}</span></span>
                <span>Valid until: <span className="font-medium text-foreground">{estimate.validUntil || "N/A"}</span></span>
              </div>

              {/* Insurance info */}
              {(estimate.insuranceClaim || estimate.insuranceAdjuster) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {estimate.insuranceClaim && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Shield className="h-3 w-3" /> Claim: <span className="font-medium text-foreground">{estimate.insuranceClaim}</span>
                    </span>
                  )}
                  {estimate.insuranceAdjuster && (
                    <span className="text-muted-foreground">Adjuster: <span className="font-medium text-foreground">{estimate.insuranceAdjuster}</span></span>
                  )}
                </div>
              )}

              {/* Notes - editable */}
              <div className="max-w-lg">
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Add notes about this estimate..."
                      rows={2}
                      data-testid="textarea-notes"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes} disabled={updateEstimate.isPending} data-testid="button-save-notes">
                        {updateEstimate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => { if (estimate.status !== "invoiced") { setNotesDraft(estimate.notes || ""); setEditingNotes(true); } }}
                    data-testid="div-notes"
                  >
                    {estimate.notes || "Click to add notes..."}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              {estimate.status !== "invoiced" && estimate.status !== "rejected" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const cEmail = "service@mcdowellsrepair.com";
                    setSendTo(cEmail); setSendResult(null); setSendError("");
                    const who = selectedCustomer?.firstName || selectedCustomer?.companyName || "";
                    setSendMessage(`Hi${who ? " " + who : ""},\n\nThank you for choosing McDowells Specialty Repair. Your estimate ${estimate.estimateNumber} is below. Reply to this email or call us to approve or schedule.\n\nMcDowells Specialty Repair`);
                    setSendOpen(true);
                  }}
                  data-testid="button-send-estimate"
                  disabled={!can("estimates.write")||unsavedEdits||addLineItem.isPending||updateEstimate.isPending||taxDraft===""||Number(taxDraft)!==taxRate}
                >
                  <Send className="h-4 w-4 mr-1" /> {estimate.status === "draft" ? "Send to Customer" : "Resend to Customer"}
                </Button>
              )}
              {(estimate.status === "sent" || estimate.status === "draft") && (
                <Button
                  size="sm"
                  onClick={() => updateEstimate.mutate({ status: "approved" })}
                  data-testid="button-approve-estimate"
                  disabled={!can("estimates.write")||updateEstimate.isPending||taxDraft===""||Number(taxDraft)!==taxRate||addLineItem.isPending||unsavedEdits}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Mark Approved
                </Button>
              )}
              {["rejected","expired"].includes(estimate.status) && <Button variant="outline" size="sm" disabled={updateEstimate.isPending} data-testid="button-reopen-estimate" onClick={()=>updateEstimate.mutate({status:"draft"})}>Reopen draft</Button>}
              {["draft","sent","approved"].includes(estimate.status) && <Button variant="outline" size="sm" disabled={updateEstimate.isPending} data-testid="button-decline-estimate" onClick={()=>updateEstimate.mutate({status:"rejected"})}>Mark declined</Button>}
              {["draft","sent","approved"].includes(estimate.status) && <Button variant="outline" size="sm" disabled={updateEstimate.isPending} data-testid="button-expire-estimate" onClick={()=>updateEstimate.mutate({status:"expired"})}>Mark expired</Button>}
              {estimate.status !== "invoiced" && estimate.status !== "rejected" && (
                <Button
                  size="sm"
                  onClick={() => convertToInvoice.mutate()}
                  disabled={!can("billing.write")||convertToInvoice.isPending || estimate.status !== "approved"||updateEstimate.isPending||taxDraft===""||Number(taxDraft)!==taxRate||unsavedEdits}
                  data-testid="button-convert-invoice"
                >
                  {convertToInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  Convert to Invoice
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content: Line items + Summary sidebar */}
      <WorkPlanning key={estimate.id} kind="estimates" id={estimate.id} />
      {unsavedEdits&&<p role="status" className="rounded-md border p-3 text-sm">Unsaved estimate changes. Save or cancel the line, notes, discount or staff assignments before approving, sending or invoicing.</p>}
      {(addLineItem.error || deleteLineItem.error || updateEstimate.error || convertToInvoice.error) && (
        <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {(addLineItem.error || deleteLineItem.error || updateEstimate.error || convertToInvoice.error)?.message}
        </p>
      )}
      {estimate.status === "invoiced" && <p className="text-sm text-muted-foreground">This estimate has been invoiced and is locked. Financial changes require a separately approved adjustment.</p>}
      {estimate.status === "draft" && <p className="text-xs text-muted-foreground">Approve the estimate before converting it to an invoice. Pricing changes require approval again.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line items - takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {can("estimates.write")&&estimate.status !== "invoiced" && pricingMatrices && (
            linkedVehicle?.vehicleType==="motorcycle" ? <p className="rounded-md border p-3 text-sm">No motorcycle-specific diagram or automatic matrix is configured. Use the manual line items below and enter an agreed price; car-body pricing is not applied.</p> : estimate.serviceType === "window_tint"
              ? (!estimate.vehicleId || linkedVehicleData) ? <TintMatrixPicker key={`${estimate.id}-${estimate.vehicleId}`} vehicle={linkedVehicle} matrices={pricingMatrices} onAdd={addSplatItems} /> : <p className="text-sm">Loading the linked vehicle before opening tint pricing…</p>
              : (!estimate.assetId || customerAssets) && (!estimate.vehicleId || linkedVehicleData)
                ? <EstimateDamageMap key={`${estimate.id}-${estimate.vehicleId}-${estimate.assetId}`} estimate={estimate} vehicle={linkedVehicle} asset={linkedAsset} matrices={pricingMatrices} onAdd={addSplatItems} />
                : <p className="text-sm text-muted-foreground">Loading the linked item before opening its damage map…</p>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items ({lineItems.length})</CardTitle>
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                  disabled={!can("estimates.write")||estimate.status === "invoiced"||!!editingLine}
                  data-testid="button-templates"
                >
                  <Plus className="h-3 w-3 mr-1" /> Quick Add
                </Button>
                {showTemplateMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border border-border bg-background shadow-lg max-h-64 overflow-y-auto">
                    <p className="p-3 text-xs text-muted-foreground">Shortcuts add labor for this service. Add parts, materials and freight separately.</p>
                    {allowedTemplates.length===0&&<p className="p-3 text-sm">No saved shortcuts for this service. Add a repair, material or freight line below.</p>}
                    {allowedTemplates.map((template: any) => (
                      <button
                        key={template.id}
                        onClick={() => addFromTemplate(template)} disabled={addLineItem.isPending}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b border-border/50 last:border-0"
                        data-testid={`button-template-${template.id}`}
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(template.basePrice)} • {template.unitType}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.some((l:any)=>!categoryAllowed(estimate.serviceType,l.serviceCategory)||nonLaborCategory(l.serviceCategory)&&l.lineType!=="parts")&&<p role="alert" className="mb-4 text-sm text-destructive">This estimate contains an unrelated service or a non-labor charge classified as labor. Edit the affected lines before approval, sending or invoicing. Historical prices have not been silently changed.</p>}
              <div className="flex flex-wrap gap-2 mb-4"><Button variant="outline" disabled={estimate.status==="invoiced"} onClick={()=>startLine(defaultCategoryFor[estimate.serviceType])}>Add repair</Button><Button variant="outline" disabled={estimate.status==="invoiced"} onClick={()=>startLine("material")}>Add materials</Button><Button variant="outline" disabled={estimate.status==="invoiced"} onClick={()=>startLine("freight_in")}>Add freight</Button></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left font-medium pb-2 pr-3">Category</th>
                      <th className="text-left font-medium pb-2 pr-3">Description</th>
                      <th className="text-left font-medium pb-2 pr-3">Repair area</th>
                      {["pdr","hail"].includes(estimate.serviceType)&&<th className="text-left font-medium pb-2 pr-3">Dent size</th>}
                      <th className="text-right font-medium pb-2 pr-3">Qty</th>
                      <th className="text-right font-medium pb-2 pr-3">Unit Price</th>
                      <th className="text-right font-medium pb-2 pr-3">Total</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b border-border/50" data-testid={`row-line-item-${item.id}`}>
                        <td className="py-2.5 pr-3">
                          <Badge variant="secondary" className="text-xs">{customerLineLabel(item)}</Badge>
                        </td>
                        <td className="py-2.5 pr-3 text-sm">{item.description}</td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground">{item.panelLocation || "-"}</td>
                        {["pdr","hail"].includes(estimate.serviceType)&&<td className="py-2.5 pr-3 text-xs text-muted-foreground">{item.damageSize || "-"}</td>}
                        <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">{item.quantity} {item.unit}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular-nums">{formatCurrency(item.total)}</td>
                        <td className="py-2.5">
                          <button type="button" disabled={estimate.status==="invoiced"} className="text-primary underline mr-3" onClick={()=>{setEditingLine(item);setNewItem({lineType:item.lineType==="legacy"?(nonLaborCategory(item.serviceCategory)?"parts":"labor"):item.lineType,serviceCategory:item.serviceCategory,description:item.description,quantity:item.quantity,unit:item.unit,unitPrice:item.unitPrice,panelLocation:item.panelLocation||"",damageSize:item.damageSize||"",damageSeverity:item.damageSeverity||"moderate",unitCost:item.unitCost||0,useTaxRate:item.useTaxRate||0,taxNote:item.taxNote||"",repairAction:item.repairAction||"repair"});document.getElementById("estimate-line-editor")?.scrollIntoView({block:"start"});}}>Edit</button>
                          <button
                            disabled={!can("estimates.write")||estimate.status === "invoiced"}
                            onClick={() => deleteLineItem.mutate(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          No line items yet. Add items below or use Quick Add from templates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4"><EstimateLabor id={id!} locked={estimate.status === "invoiced"} onDirtyChange={setLaborDirty}/></div>
              <div className="mt-4"><EstimateCommercial estimate={estimate} onDirtyChange={setSalesDirty}/></div>
              {/* Add line item form */}
              <fieldset id="estimate-line-editor" disabled={estimate.status === "invoiced"||addLineItem.isPending||!can("estimates.write")} className="mt-4 rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4" /> {editingLine?"Edit Line Item":"Add Line Item"}
                </div>
                <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>handleCategoryChange(defaultCategoryFor[estimate.serviceType])}>Repair labor</Button><Button variant="outline" onClick={()=>handleCategoryChange("material")}>Materials</Button><Button variant="outline" onClick={()=>handleCategoryChange("freight_in")}>Freight</Button></div>
                <p className="text-xs text-muted-foreground">Customer unit price is what you charge. Purchase unit cost is internal. Materials and freight do not receive technician labor credit. Current sales-tax treatment: {categoryTaxable(newItem.serviceCategory,newItem.lineType)?"taxable unless customer exempt":"not taxable"}.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs">Charge type<select aria-label="New line charge type" className="mt-1 h-10 w-full border rounded bg-background px-2" value={newItem.lineType} onChange={e=>handleCategoryChange(e.target.value==="parts"?"material":defaultCategoryFor[estimate.serviceType])}><option value="labor">Labor</option><option value="parts">Materials / freight / supplies</option></select></label>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Category</Label>
                    <Select value={newItem.serviceCategory} onValueChange={handleCategoryChange}>
                      <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedCategories.map((c) => (
                          <SelectItem key={c.value + c.label} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Description</Label>
                    <Input
                      placeholder={`Describe ${SERVICE_LABELS[estimate.serviceType]||"repair"} work or materials`}
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      data-testid="input-description"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Repair area / location</Label>
                    <Input
                      placeholder={estimate.assetId?"e.g. Seat, arm, cushion":"Repair location"}
                      value={newItem.panelLocation}
                      onChange={(e) => handlePanelChange(e.target.value)}
                    />
                  </div>
                  {["pdr","hail"].includes(estimate.serviceType)&&<div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Damage Size</Label>
                    <Select value={newItem.damageSize || ""} onValueChange={handleSizeChange}>
                      <SelectTrigger data-testid="select-manual-size"><SelectValue placeholder="Select size" /></SelectTrigger>
                      <SelectContent>
                        {damageSizes.map((s) => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>}
                  {newItem.lineType==="labor"&&<label className="text-xs">Repair operation<select aria-label="Repair operation" className="mt-1 h-10 w-full border rounded bg-background px-2" value={newItem.repairAction} onChange={e=>setNewItem({...newItem,repairAction:e.target.value,...(e.target.value==="fabricate"?{serviceCategory:"fabrication",lineType:"labor",useTaxRate:0,taxNote:""}:newItem.serviceCategory==="fabrication"?{serviceCategory:defaultCategoryFor[estimate.serviceType]}:{})})}>{repairActionsFor(estimate.serviceType).map(a=><option value={a} key={a}>{a.replaceAll("_"," ")}</option>)}</select></label>}
                  {newItem.lineType==="labor"&&<div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Severity</Label>
                    <Select value={newItem.damageSeverity} onValueChange={(v) => setNewItem({ ...newItem, damageSeverity: v })}>
                      <SelectTrigger data-testid="select-manual-severity"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                      data-testid="input-quantity"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Unit</Label>
                    <Select value={newItem.unit} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                      <SelectTrigger data-testid="select-manual-unit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Customer Unit Price</Label>
                    <Input
                      type="number"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })}
                      data-testid="input-unit-price"
                    />
                  </div>
                  {can("costs.write")&&<label className="text-xs">Purchase unit cost (internal)<Input aria-label="Purchase unit cost" type="number" min="0" step=".01" value={newItem.unitCost} onChange={e=>setNewItem({...newItem,unitCost:Number(e.target.value)})}/></label>}
                  {can("costs.write")&&newItem.serviceCategory==="supplies"&&<>
                    <label className="text-xs">Use tax still owed on purchase (%)<Input aria-label="Use tax rate" type="number" min="0" max="100" step=".01" value={newItem.useTaxRate} onChange={e=>setNewItem({...newItem,useTaxRate:Number(e.target.value)})}/></label>
                    <label className="text-xs">Use-tax basis / vendor-tax note<Input aria-label="Use tax note" value={newItem.taxNote} onChange={e=>setNewItem({...newItem,taxNote:e.target.value})}/></label>
                  </>}
                </div>
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Item total: <span className="font-medium text-foreground">{formatCurrency(newItem.quantity * newItem.unitPrice)}</span>
                  </div>
                  <Button onClick={handleAddItem} disabled={!newItem.description || addLineItem.isPending} data-testid="button-add-item">
                    {addLineItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {editingLine?"Save line changes":"Add Item"}
                  </Button>
                  {editingLine&&<Button variant="ghost" onClick={()=>{setEditingLine(null);setNewItem({...newItem,description:"",unitCost:0,useTaxRate:0,taxNote:"",unitPrice:0});}}>Cancel edit</Button>}
                  {!editingLine&&newItem.description&&<Button variant="ghost" onClick={()=>startLine(defaultCategoryFor[estimate.serviceType])}>Clear unsaved line</Button>}
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <DocumentBreakdown lines={lineItems} subtotal={subtotal}/>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({lineItems.length} items)</span>
                  <span className="tabular-nums font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Rate</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={taxDraft}
                      aria-label="Estimate tax rate"
                      onChange={(e)=>setTaxDraft(e.target.value)}
                      onBlur={()=>{if(taxDraft!==""&&Number(taxDraft)!==taxRate)updateEstimate.mutate({taxRate:Number(taxDraft)});}}
                      disabled={!can("estimates.write")||estimate.status === "invoiced"}
                      className="w-16 h-7 text-xs text-right"
                      step="0.5"
                    />
                    <span className="text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{documentBreakdown(lineItems,subtotal).taxLabel}</span>
                  <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
                {/* Discount - editable */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  {editingDiscount ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={discountDraft}
                        onChange={(e) => setDiscountDraft(e.target.value)}
                        className="w-20 h-7 text-xs text-right"
                        step="0.01"
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveDiscount}>OK</Button>
                    </div>
                  ) : (
                    <button
                      className="tabular-nums text-destructive hover:underline"
                      onClick={() => { setDiscountDraft(String(discount)); setEditingDiscount(true); }}
                      data-testid="button-edit-discount"
                      disabled={estimate.status === "invoiced"}
                    >
                      -{formatCurrency(discount)}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums" data-testid="span-estimate-total">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Estimate meta */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimate #</span>
                <span className="font-medium font-mono">{estimate.estimateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary" className={statusColors[estimate.status] || ""}>{estimate.status}</Badge>
              </div>
              {estimate.approvedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium">{new Date(estimate.approvedDate).toLocaleDateString()}</span>
                </div>
              )}
              {estimate.invoiceId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <Link href={`/invoices/${estimate.invoiceId}`} className="text-primary hover:underline">
                    Open linked invoice
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
