import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Map, Plus, Trash2, AlertTriangle } from "lucide-react";
import { VehicleSplat, type VehicleType } from "@/components/vehicle-splat";
import {
  DENT_SIZES, DENT_SIZE_LABELS, DENT_SEVERITIES, DENT_SEVERITY_LABELS, LOCATION_DIFFICULTIES, LOCATION_DIFFICULTY_LABELS,
  PAINT_CORRECTABLE_LABEL, DENT_LENGTH_MIN, DENT_LENGTH_MAX, DENT_NOTES_MAX,
} from "@shared/dents";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const NONE = "__none";
const LENGTHS = Array.from({ length: DENT_LENGTH_MAX - DENT_LENGTH_MIN + 1 }, (_, i) => DENT_LENGTH_MIN + i);

export interface Dent {
  id: number; estimateId: number; panelId: string; panelName: string; bodyStyle: VehicleType; size: string;
  lengthIn: number | null; severity: string | null; locationDifficulty: string | null; paintCorrectable: string | null;
  notes: string; lineItemId: number | null; groupId: number | null;
  suggestedPrice: number | null; suggestedSource: string | null; suggestedAt: string | null;
  overridePrice: number | null; overrideReason: string | null; overrideSuggestedPrice: number | null; overrideBy: string | null; overrideAt: string | null;
  referencePrice: number | null; currentSuggestedPrice: number | null; currentSuggestedSource: string | null; matrixChanged: boolean;
}

interface Props { estimate: any; vehicle?: any; readOnly: boolean }

// Paintless dent repair: every dent is its own saved record (section 2). Pricing and the billing
// method (individual lines or packages) are chosen under "Dent pricing and billing" in section 3.
export function PdrDentMap({ estimate, vehicle, readOnly }: Props) {
  const queryClient = useQueryClient();
  const key = ["/api/estimates", String(estimate.id), "dents"];
  const { data: dents = [], isLoading, error: loadError } = useQuery<Dent[]>({
    queryKey: key, queryFn: () => apiRequest("GET", `/api/estimates/${estimate.id}/dents`), staleTime: 0,
  });
  const derivedBody: VehicleType = useMemo(() => {
    const bc = `${vehicle?.bodyClass || ""} ${vehicle?.model || ""}`.toLowerCase();
    if (vehicle?.vehicleType === "truck" || /pickup|truck|f-150|silverado|ram|tacoma|tundra|sierra/.test(bc)) return "pickup";
    if (/suv|sport utility|mpv|crossover|van|wagon|rav4|cr-v|explorer|tahoe/.test(bc)) return "suv";
    return "sedan";
  }, [vehicle]);
  const [chosenBody, setChosenBody] = useState<VehicleType | null>(null);
  // Saved dents fix the diagram they were marked on.
  const bodyType: VehicleType = dents[0]?.bodyStyle || chosenBody || derivedBody;
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  const addDent = useMutation({
    mutationFn: (p: { panelId: string; panelName: string }) =>
      apiRequest("POST", `/api/estimates/${estimate.id}/dents`, { ...p, bodyStyle: bodyType, size: "dime" }),
    onSuccess: () => { setError(""); queryClient.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => setError(e.message || "Could not save the dent. Try again."),
  });

  const panelCounts = useMemo(() => {
    const byPanel: Record<string, { panelName: string; count: number; deep: boolean; medium: boolean }> = {};
    for (const d of dents) {
      const p = byPanel[d.panelId] ||= { panelName: d.panelName, count: 0, deep: false, medium: false };
      p.count++; p.deep ||= d.severity === "deep"; p.medium ||= d.severity === "medium";
    }
    return byPanel;
  }, [dents]);

  const onPanelClick = (panelId: string, panelName: string) => {
    setSelected(panelId);
    if (!readOnly && !panelCounts[panelId]) addDent.mutate({ panelId, panelName });
  };

  const selectedDents = dents.filter(d => d.panelId === selected);
  const selectedName = selected ? panelCounts[selected]?.panelName : "";
  const billedCount = dents.filter(d => d.lineItemId).length;

  return (
    <Card data-testid="card-dent-map">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Map className="h-4 w-4" /> Damage map and dent details</CardTitle>
        <p className="text-xs text-muted-foreground">
          {readOnly ? "Saved dent records for this estimate." : "Tap a damaged panel to add a dent, then fill in each dent's details. Every dent is saved as you go."}
          {" "}Size, length, severity, location difficulty and panel set each dent's suggested price from the pricing matrix. "Paint damage correctable?" and notes do not affect price.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="field-row">
          <div>
            <Label className="text-xs">Body style{vehicle ? ` (from ${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""})` : ""}</Label>
            <Select value={bodyType} disabled={readOnly || dents.length > 0} onValueChange={v => { setChosenBody(v as VehicleType); setSelected(null); }}>
              <SelectTrigger data-testid="select-splat-body"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedan">Sedan</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="field-auto text-sm self-end" data-testid="text-dent-summary">
            {dents.length} dent{dents.length === 1 ? "" : "s"} saved · {billedCount} billed · {dents.length - billedCount} not yet billed
          </div>
        </div>
        {dents.length > 0 && !readOnly && <p className="text-xs text-muted-foreground">Body style is fixed once dents are saved, so each dent stays on the diagram it was marked on.</p>}
        {(loadError || error) && <p role="alert" className="text-sm text-destructive">{(loadError as any)?.message || error}</p>}

        {/* Wide screens: the diagram on the left, the chosen panel's dents on the right */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="rounded-md border border-border bg-muted/20 p-2 min-w-0">
          {isLoading ? <p className="text-sm p-4">Loading saved dents…</p> :
            <VehicleSplat vehicleType={bodyType} view="exterior" selectedPanel={selected} onPanelClick={onPanelClick}
              damages={Object.entries(panelCounts).map(([panelId, p]) => ({ panelId, panelName: p.panelName, damageCount: p.count, severity: p.deep ? "severe" : p.medium ? "moderate" : "minor" }))} />}
        </div>

        <div className="min-w-0">
        {selected && (
          <div className="rounded-md border border-primary/50 bg-primary/5 p-3 space-y-3" data-testid="panel-dents">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold">{selectedName || "Selected panel"}: {selectedDents.length} dent{selectedDents.length === 1 ? "" : "s"}</span>
              {!readOnly && <Button size="sm" variant="outline" disabled={addDent.isPending || !selectedName}
                onClick={() => addDent.mutate({ panelId: selected, panelName: selectedName })} data-testid="button-add-dent">
                {addDent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add another dent
              </Button>}
            </div>
            {selectedDents.map((d, i) => <DentEditor key={d.id} dent={d} index={i + 1} readOnly={readOnly} queryKey={key} />)}
            {!selectedDents.length && !addDent.isPending && <p className="text-sm text-muted-foreground">No dents on this panel.</p>}
          </div>
        )}

        {!selected && <p className="text-sm text-muted-foreground text-center py-2">{dents.length ? "Tap a panel to see or edit its dents. Prices and the billing method are under Dent pricing and billing in section 3." : "No dents marked yet"}</p>}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DentEditor({ dent, index, readOnly, queryKey }: { dent: Dent; index: number; readOnly: boolean; queryKey: any[] }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(dent.notes);
  const [status, setStatus] = useState("");
  // A crease is saved only once its length is chosen; no length is ever filled in for the estimator.
  const [pendingCrease, setPendingCrease] = useState(false);
  useEffect(() => setNotes(dent.notes), [dent.notes]);
  const billed = !!dent.lineItemId;
  const save = useMutation({
    mutationFn: (patch: Partial<Dent>) => apiRequest("PATCH", `/api/estimates/dents/${dent.id}`, patch),
    onMutate: () => setStatus("Saving…"),
    onSuccess: (saved: Dent) => { setStatus("Saved"); setPendingCrease(false); queryClient.setQueryData<Dent[]>(queryKey, list => list?.map(d => d.id === saved.id ? saved : d)); },
    onError: (e: any) => { setStatus(e.message || "Not saved"); queryClient.invalidateQueries({ queryKey }); },
  });
  const remove = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/estimates/dents/${dent.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: any) => setStatus(e.message || "Not deleted"),
  });
  const pick = (field: keyof Dent, value: string) => save.mutate({ [field]: value === NONE ? null : value } as any);
  const id = `dent-${dent.id}`;
  return (
    <div className="rounded-md border bg-background p-3 space-y-3" data-testid={`dent-${dent.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Dent {index}</span>
          <Badge variant={billed ? "secondary" : "outline"} className="text-[10px]">{dent.groupId ? "In a package" : billed ? "Billed individually" : "Not yet billed"}</Badge>
          {status && <span role="status" className={`text-xs ${save.isError || remove.isError ? "text-destructive" : "text-muted-foreground"}`}>{status}</span>}
        </div>
        {!readOnly && <Button size="sm" variant="ghost" disabled={billed || remove.isPending} title={billed ? "Remove its estimate line first" : undefined}
          onClick={() => remove.mutate()} aria-label={`Delete dent ${index}`}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="price-line">
        Price: <span className="font-medium text-foreground">{dent.referencePrice != null ? fmt(dent.referencePrice) : "Pricing incomplete"}</span>
        {dent.overridePrice != null ? ` · entered by ${dent.overrideBy || "staff"} (calculated ${dent.overrideSuggestedPrice != null ? fmt(dent.overrideSuggestedPrice) : "none"})` : dent.suggestedSource ? ` · ${dent.suggestedSource}` : ""}
      </p>
      {billed && !readOnly && <p className="text-xs text-muted-foreground">This dent is billed. To change details that affect its price, first remove its line or package under Dent pricing and billing.</p>}
      <div className="field-row">
        <Field label="Size" id={`${id}-size`}>
          <Select value={pendingCrease ? "crease" : dent.size} disabled={readOnly || billed} onValueChange={v => {
            if (v === "crease" && !dent.lengthIn) { setPendingCrease(true); setStatus("Choose the crease length to save this change"); }
            else { setPendingCrease(false); save.mutate({ size: v }); }
          }}>
            <SelectTrigger id={`${id}-size`} className="h-9" data-testid="select-dent-size"><SelectValue /></SelectTrigger>
            <SelectContent>{DENT_SIZES.map(s => <SelectItem key={s} value={s}>{DENT_SIZE_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={dent.size === "crease" || pendingCrease ? "Length (in, required)" : "Length (in)"} id={`${id}-length`}>
          <Select value={dent.lengthIn ? String(dent.lengthIn) : NONE} disabled={readOnly || billed} onValueChange={v => save.mutate(pendingCrease && v !== NONE ? { size: "crease", lengthIn: Number(v) } : { lengthIn: v === NONE ? null : Number(v) })}>
            <SelectTrigger id={`${id}-length`} className="h-9" data-testid="select-dent-length"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled={dent.size === "crease" || pendingCrease}>{dent.size === "crease" || pendingCrease ? "Choose a length" : "Not recorded"}</SelectItem>
              {LENGTHS.map(n => <SelectItem key={n} value={String(n)}>{n}"</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Severity" id={`${id}-severity`}>
          <Choice id={`${id}-severity`} value={dent.severity} options={DENT_SEVERITIES} labels={DENT_SEVERITY_LABELS} disabled={readOnly || billed} onChange={v => pick("severity", v)} />
        </Field>
        <Field label="Location difficulty" id={`${id}-difficulty`}>
          <Choice id={`${id}-difficulty`} value={dent.locationDifficulty} options={LOCATION_DIFFICULTIES} labels={LOCATION_DIFFICULTY_LABELS} disabled={readOnly || billed} onChange={v => pick("locationDifficulty", v)} />
        </Field>
        <Field label={PAINT_CORRECTABLE_LABEL} id={`${id}-paint`}>
          <Choice id={`${id}-paint`} value={dent.paintCorrectable} options={["yes", "no"]} labels={{ yes: "Yes", no: "No" }} disabled={readOnly} onChange={v => pick("paintCorrectable", v)} />
        </Field>
      </div>
      <Field label="Estimator notes (internal, not printed)" id={`${id}-notes`}>
        <Textarea id={`${id}-notes`} rows={2} maxLength={DENT_NOTES_MAX} disabled={readOnly} value={notes} onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes.trim() !== dent.notes) save.mutate({ notes }); }} data-testid="input-dent-notes" />
      </Field>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1 min-w-0"><Label htmlFor={id} className="text-xs">{label}</Label>{children}</div>;
}
function Choice({ id, value, options, labels, disabled, onChange }: { id: string; value: string | null; options: readonly string[]; labels: Record<string, string>; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <Select value={value || NONE} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not recorded</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{labels[o]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
