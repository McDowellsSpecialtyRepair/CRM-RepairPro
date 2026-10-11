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
  dentMatrixCategory, dentNeedsManualPrice, dentLineDescription,
} from "@shared/dents";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const NONE = "__none";
const LENGTHS = Array.from({ length: DENT_LENGTH_MAX - DENT_LENGTH_MIN + 1 }, (_, i) => DENT_LENGTH_MIN + i);

export interface Dent {
  id: number; estimateId: number; panelId: string; panelName: string; bodyStyle: VehicleType; size: string;
  lengthIn: number | null; severity: string | null; locationDifficulty: string | null; paintCorrectable: string | null;
  notes: string; lineItemId: number | null; matrixUnitPrice: number | null; priceSource: string | null;
}

interface Props { estimate: any; vehicle?: any; matrices: any[]; readOnly: boolean }

// Paintless dent repair: every dent is its own saved record. Unbilled dents are added to the
// estimate as one line per panel and size (dent count × standard matrix price), as before.
export function PdrDentMap({ estimate, vehicle, matrices, readOnly }: Props) {
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
  const [done, setDone] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/estimates", String(estimate.id)] });

  const addDent = useMutation({
    mutationFn: (p: { panelId: string; panelName: string }) =>
      apiRequest("POST", `/api/estimates/${estimate.id}/dents`, { ...p, bodyStyle: bodyType, size: "dime" }),
    onSuccess: () => { setError(""); setDone(""); queryClient.invalidateQueries({ queryKey: key }); },
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
    setSelected(panelId); setDone("");
    if (!readOnly && !panelCounts[panelId]) addDent.mutate({ panelId, panelName });
  };

  // Unbilled dents, grouped exactly as they will be billed: one line per panel and size.
  const vehCat = dentMatrixCategory(bodyType);
  const groups = useMemo(() => {
    const out: Record<string, { key: string; panelId: string; panelName: string; size: string; ids: number[] }> = {};
    for (const d of dents.filter(d => !d.lineItemId)) {
      const k = `${d.panelId}|${d.size}`;
      (out[k] ||= { key: k, panelId: d.panelId, panelName: d.panelName, size: d.size, ids: [] }).ids.push(d.id);
    }
    return Object.values(out).map(g => {
      const manual = dentNeedsManualPrice(g.size, g.panelId);
      const row = manual ? null : matrices.find(r => r.matrixType === "pdr_dent" && r.sizeCategory === g.size && r.vehicleCategory === vehCat);
      const entered = prices[g.key];
      const unit = entered !== undefined && entered !== "" ? Number(entered) : row ? row.price : NaN;
      const source = entered !== undefined && entered !== "" ? "Entered price" : manual
        ? (g.size === "crease" ? "No crease matrix yet: enter a price" : "Glass or plastic: enter a price")
        : row ? `Standard PDR matrix · ${DENT_SIZE_LABELS[g.size]} · ${vehCat}` : "No matrix row found: enter a price";
      return { ...g, unit, source, needsPrice: !Number.isFinite(unit) || unit < 0, entered: entered !== undefined && entered !== "" };
    });
  }, [dents, matrices, vehCat, prices]);
  const unbilledTotal = groups.reduce((s, g) => s + (Number.isFinite(g.unit) ? Math.round(g.unit * g.ids.length * 100) / 100 : 0), 0);
  const unpriced = groups.some(g => g.needsPrice);

  const bill = useMutation({
    mutationFn: () => apiRequest("POST", `/api/estimates/${estimate.id}/dents/bill`, {
      groups: groups.map(g => ({ dentIds: g.ids, unitPrice: g.unit, priceConfirmed: g.entered })),
    }),
    onSuccess: (r: any) => {
      setError(""); setPrices({}); setDone(`${r.created} line item${r.created === 1 ? "" : "s"} added. The dent records stay saved below.`);
      refresh(); queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
    },
    onError: (e: any) => setError(e.message || "Could not add these dents. They are still saved; try again."),
  });

  const selectedDents = dents.filter(d => d.panelId === selected);
  const selectedName = selected ? panelCounts[selected]?.panelName : "";
  const billedCount = dents.filter(d => d.lineItemId).length;

  return (
    <Card data-testid="card-dent-map">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Map className="h-4 w-4" /> Damage map and dent details</CardTitle>
        <p className="text-xs text-muted-foreground">
          {readOnly ? "Saved dent records for this estimate." : "Tap a damaged panel to add a dent, then fill in each dent's details. Every dent is saved as you go."}
          {" "}Size sets the standard matrix price; length, severity, location difficulty and paint answers are recorded only and do not change the price.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="sm:col-span-2 text-sm self-end" data-testid="text-dent-summary">
            {dents.length} dent{dents.length === 1 ? "" : "s"} saved · {billedCount} on estimate lines · {dents.length - billedCount} not yet added
          </div>
        </div>
        {dents.length > 0 && !readOnly && <p className="text-xs text-muted-foreground">Body style is fixed once dents are saved, so each dent stays on the diagram it was marked on.</p>}
        {(loadError || error) && <p role="alert" className="text-sm text-destructive">{(loadError as any)?.message || error}</p>}

        <div className="rounded-md border border-border bg-muted/20 p-2">
          {isLoading ? <p className="text-sm p-4">Loading saved dents…</p> :
            <VehicleSplat vehicleType={bodyType} view="exterior" selectedPanel={selected} onPanelClick={onPanelClick}
              damages={Object.entries(panelCounts).map(([panelId, p]) => ({ panelId, panelName: p.panelName, damageCount: p.count, severity: p.deep ? "severe" : p.medium ? "moderate" : "minor" }))} />}
        </div>

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

        {!readOnly && groups.length > 0 && (
          <div className="space-y-2" data-testid="dents-to-add">
            <div className="text-sm font-semibold">Ready to add to the estimate</div>
            {groups.map(g => (
              <div key={g.key} className="rounded-md border p-2.5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <button type="button" className="text-left min-w-0" onClick={() => setSelected(g.panelId)}>
                  <div className="text-sm font-medium">{dentLineDescription(g.panelId, g.panelName, g.size)}</div>
                  <div className="text-xs text-muted-foreground">{g.source}</div>
                  {g.needsPrice && <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3" /> Enter a unit price before adding</div>}
                </button>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-xs text-muted-foreground tabular-nums">{g.ids.length} ×</span>
                  <Input aria-label={`Unit price for ${dentLineDescription(g.panelId, g.panelName, g.size)}`} className="h-9 w-28 tabular-nums" inputMode="decimal"
                    placeholder={Number.isFinite(g.unit) && !g.entered ? g.unit.toFixed(2) : "Price"} value={prices[g.key] ?? ""}
                    onChange={e => setPrices(p => ({ ...p, [g.key]: e.target.value }))} />
                  <span className="text-sm font-semibold tabular-nums w-24 text-right">{Number.isFinite(g.unit) ? fmt(g.unit * g.ids.length) : "—"}</span>
                </div>
              </div>
            ))}
            {unpriced && <p role="alert" className="text-sm text-amber-700">Enter an explicit unit price for creases, glass or plastic panels and any missing matrix price. Enter 0 only for an intentional no-charge item.</p>}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="text-sm">Not yet added: <span className="font-semibold tabular-nums">{fmt(unbilledTotal)}</span></div>
              <Button onClick={() => bill.mutate()} disabled={bill.isPending || unpriced} data-testid="button-add-dents">
                {bill.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add to estimate
              </Button>
            </div>
          </div>
        )}
        {!groups.length && !selected && <p className="text-sm text-muted-foreground text-center py-2">{done || (dents.length ? "All saved dents are on estimate lines." : "No dents marked yet")}</p>}
        {done && (groups.length > 0 || selected) && <p className="text-xs text-muted-foreground">{done}</p>}
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
          <Badge variant={billed ? "secondary" : "outline"} className="text-[10px]">{billed ? "On estimate line" : "Not yet added"}</Badge>
          {status && <span role="status" className={`text-xs ${save.isError || remove.isError ? "text-destructive" : "text-muted-foreground"}`}>{status}</span>}
        </div>
        {!readOnly && <Button size="sm" variant="ghost" disabled={billed || remove.isPending} title={billed ? "Remove its estimate line first" : undefined}
          onClick={() => remove.mutate()} aria-label={`Delete dent ${index}`}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>}
      </div>
      {billed && dent.priceSource && <p className="text-xs text-muted-foreground">Matrix price: {dent.matrixUnitPrice != null ? fmt(dent.matrixUnitPrice) : "none"} · {dent.priceSource}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <Select value={dent.lengthIn ? String(dent.lengthIn) : NONE} disabled={readOnly} onValueChange={v => save.mutate(pendingCrease && v !== NONE ? { size: "crease", lengthIn: Number(v) } : { lengthIn: v === NONE ? null : Number(v) })}>
            <SelectTrigger id={`${id}-length`} className="h-9" data-testid="select-dent-length"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled={dent.size === "crease" || pendingCrease}>{dent.size === "crease" || pendingCrease ? "Choose a length" : "Not recorded"}</SelectItem>
              {LENGTHS.map(n => <SelectItem key={n} value={String(n)}>{n}"</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Severity" id={`${id}-severity`}>
          <Choice id={`${id}-severity`} value={dent.severity} options={DENT_SEVERITIES} labels={DENT_SEVERITY_LABELS} disabled={readOnly} onChange={v => pick("severity", v)} />
        </Field>
        <Field label="Location difficulty" id={`${id}-difficulty`}>
          <Choice id={`${id}-difficulty`} value={dent.locationDifficulty} options={LOCATION_DIFFICULTIES} labels={LOCATION_DIFFICULTY_LABELS} disabled={readOnly} onChange={v => pick("locationDifficulty", v)} />
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
