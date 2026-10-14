import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, AlertTriangle, CheckCircle } from "lucide-react";
import type { Dent } from "@/components/pdr-dent-map";
import { DENT_SIZE_LABELS, DENT_SEVERITY_LABELS, LOCATION_DIFFICULTY_LABELS, packageComparison, packageNeedsApproval, roundMoney } from "@shared/dents";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const pct = (n: number | null) => n === null ? "" : `${n > 0 ? "+" : ""}${n}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
type Group = {
  id: number; scope: "panel" | "vehicle"; label: string; manualPrice: number; calculatedTotal: number | null; pricingComplete: boolean;
  difference: number | null; differencePercent: number | null; approvalRequired: boolean; approved: boolean;
  approvedBy: string | null; approvedAt: string | null; createdBy: string; dentIds: number[];
};
const describe = (d: Dent) => [d.panelName, DENT_SIZE_LABELS[d.size], d.lengthIn ? `${d.lengthIn}"` : "", d.severity ? DENT_SEVERITY_LABELS[d.severity] : "",
  d.locationDifficulty ? `${LOCATION_DIFFICULTY_LABELS[d.locationDifficulty]} location` : ""].filter(Boolean).join(" · ");

// Section 3 for PDR estimates: each dent's price, the billing method (individual lines, panel
// packages or a whole-vehicle package), package approval, and what the customer sees.
export function DentBillingPanel({ estimate, readOnly }: { estimate: any; readOnly: boolean }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const id = String(estimate.id);
  const dentsKey = ["/api/estimates", id, "dents"], groupsKey = ["/api/estimates", id, "dent-groups"], optKey = ["/api/estimates", id, "pricing-options"];
  const { data: dents = [] } = useQuery<Dent[]>({ queryKey: dentsKey, queryFn: () => apiRequest("GET", `/api/estimates/${id}/dents`), staleTime: 0 });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: groupsKey, queryFn: () => apiRequest("GET", `/api/estimates/${id}/dent-groups`), staleTime: 0 });
  const { data: options } = useQuery<{ showDentDetails: boolean }>({ queryKey: optKey, queryFn: () => apiRequest("GET", `/api/estimates/${id}/pricing-options`) });
  const { data: master } = useQuery<any>({ queryKey: ["/api/pdr-pricing"], queryFn: () => apiRequest("GET", "/api/pdr-pricing"), enabled: can("pricing.read") });
  const threshold: number | null = master?.settings?.packageApprovalThresholdPercent ?? null;
  const [selected, setSelected] = useState<number[]>([]);
  const [packaging, setPackaging] = useState<null | "panel" | "vehicle">(null);
  const [packagePrice, setPackagePrice] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["/api/estimates", id] }); queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }); };
  const run = useMutation({
    mutationFn: ({ method, url, body }: { method: string; url: string; body?: any; done?: string }) => apiRequest(method, url, body),
    onSuccess: (_r, v) => { setMessage(v.done ? { text: v.done } : null); setSelected([]); setPackaging(null); setPackagePrice(""); refresh(); },
    onError: (e: any) => { setMessage({ text: e.message || "Not saved", error: true }); refresh(); },
  });

  const lineCount = useMemo(() => {
    const n: Record<number, number> = {};
    for (const d of dents) if (d.lineItemId) n[d.lineItemId] = (n[d.lineItemId] || 0) + 1;
    return n;
  }, [dents]);
  const unbilled = dents.filter(d => !d.lineItemId);
  const individual = dents.filter(d => d.lineItemId && !d.groupId && lineCount[d.lineItemId] === 1);
  const combined = dents.filter(d => d.lineItemId && !d.groupId && lineCount[d.lineItemId] > 1);
  const chosen = dents.filter(d => selected.includes(d.id));
  const toggle = (dentId: number) => setSelected(s => s.includes(dentId) ? s.filter(x => x !== dentId) : [...s, dentId]);
  const samePanel = chosen.length > 0 && chosen.every(d => d.panelId === chosen[0].panelId);
  const allUnbilled = chosen.every(d => !d.lineItemId);
  const incomplete = chosen.filter(d => d.referencePrice === null);
  const calculated = chosen.length && !incomplete.length ? roundMoney(chosen.reduce((s, d) => s + (d.referencePrice as number), 0)) : null;
  const manual = packagePrice.trim() === "" ? NaN : Number(packagePrice);
  const comparison = Number.isFinite(manual) ? packageComparison(calculated, manual) : null;
  const needsApproval = Number.isFinite(manual) && packageNeedsApproval(calculated, manual, threshold);
  const changed = unbilled.filter(d => d.matrixChanged);
  const pendingApproval = groups.filter(g => g.approvalRequired && !g.approved);

  if (!dents.length) return null;
  return (
    <Card data-testid="card-dent-billing">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Dent pricing and billing</CardTitle>
        <p className="text-xs text-muted-foreground">Each dent keeps its own calculated price. Bill dents individually (one line each), or group them into a panel or whole-vehicle package at a price you enter. Packages are never discounted automatically.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-2 text-sm rounded-md border p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4" disabled={readOnly || !options} checked={!!options?.showDentDetails} data-testid="switch-show-dent-details"
            onChange={e => { const on = e.target.checked; queryClient.setQueryData(optKey, { showDentDetails: on });
              run.mutate({ method: "PUT", url: `/api/estimates/${id}/pricing-options`, body: { showDentDetails: on }, done: on ? "Dent details will show on the customer estimate and invoice." : "Dent details are hidden from customer documents." }); }} />
          <span><span className="font-medium">Show dent details to customer</span><span className="block text-xs text-muted-foreground">Adds each dent's panel, size, length and severity under its line on the printed estimate and invoice. Amounts do not change. "Paint damage correctable?" and estimator notes are never shown.</span></span>
        </label>
        {message && <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}
        {pendingApproval.length > 0 && <p role="alert" className="text-sm rounded-md border border-amber-500/50 bg-amber-500/10 p-3" data-testid="text-package-needs-approval">
          <AlertTriangle className="inline h-4 w-4 mr-1 text-amber-600" />A package price needs approval from an owner, administrator or manager before this estimate can be sent, approved, invoiced or moved into production.</p>}
        {!readOnly && changed.length > 0 && <div className="rounded-md border p-3 text-sm flex flex-wrap items-center justify-between gap-2" data-testid="matrix-changed">
          <span>{changed.length} unbilled dent{changed.length === 1 ? " was" : "s were"} priced before the pricing matrix changed. Their saved prices are kept until you reprice.</span>
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `/api/estimates/${id}/dents/reprice`, done: "Unbilled dents repriced from the current matrix." })}>Reprice from current matrix</Button>
        </div>}

        <section className="space-y-2" aria-label="Dents not yet billed">
          <div className="text-sm font-semibold">Not yet billed ({unbilled.length})</div>
          {!unbilled.length && <p className="text-xs text-muted-foreground">Every saved dent is billed.</p>}
          {unbilled.map(d => <DentPriceRow key={d.id} dent={d} checked={selected.includes(d.id)} onToggle={() => toggle(d.id)} readOnly={readOnly} onDone={refresh} />)}
        </section>

        {individual.length > 0 && <section className="space-y-2" aria-label="Dents billed individually">
          <div className="text-sm font-semibold">Billed individually ({individual.length})</div>
          <p className="text-xs text-muted-foreground">Select these to move them into a package; their individual lines are removed in the same step. To reprice one, remove its line in the line items below.</p>
          {individual.map(d => <label key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <span className="flex items-center gap-2 min-w-0">{!readOnly && <input type="checkbox" className="h-4 w-4" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${describe(d)}`} />}<span className="truncate">{describe(d)}</span></span>
            <span className="tabular-nums font-medium">{d.referencePrice != null ? fmt(d.referencePrice) : "—"}</span></label>)}
        </section>}
        {combined.length > 0 && <p className="text-xs text-muted-foreground">{combined.length} dent{combined.length === 1 ? " is" : "s are"} on combined lines added before this update (one line per panel and size). Remove such a line to bill those dents individually or in a package.</p>}

        {!readOnly && <div className="flex flex-wrap gap-2 border-t pt-3" data-testid="billing-actions">
          <span className="text-sm self-center mr-1">{chosen.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setSelected(unbilled.map(d => d.id))} disabled={!unbilled.length}>Select all not billed</Button>
          <Button size="sm" disabled={!chosen.length || !allUnbilled || incomplete.length > 0 || run.isPending} data-testid="button-bill-individually"
            onClick={() => run.mutate({ method: "POST", url: `/api/estimates/${id}/dents/bill`, body: { dentIds: selected }, done: `${chosen.length} dent line${chosen.length === 1 ? "" : "s"} added.` })}>Bill individually</Button>
          <Button size="sm" variant="outline" disabled={!samePanel} data-testid="button-panel-package" onClick={() => setPackaging("panel")}>Package by panel</Button>
          <Button size="sm" variant="outline" disabled={!chosen.length} data-testid="button-vehicle-package" onClick={() => setPackaging("vehicle")}>Whole-vehicle package</Button>
          {chosen.length > 0 && incomplete.length > 0 && <p className="w-full text-xs text-amber-700">Pricing incomplete for {incomplete.length} selected dent{incomplete.length === 1 ? "" : "s"}: enter a price before billing individually.</p>}
        </div>}

        {packaging && <div className="rounded-md border border-primary/50 bg-primary/5 p-3 space-y-2" data-testid="form-package">
          <div className="text-sm font-semibold">{packaging === "panel" ? `${chosen[0]?.panelName} package` : "Whole-vehicle package"} · {chosen.length} dent{chosen.length === 1 ? "" : "s"}</div>
          <Comparison calculated={calculated} manual={Number.isFinite(manual) ? manual : null} comparison={comparison} />
          <div className="flex flex-wrap items-end gap-2">
            <div><Label htmlFor="package-price" className="text-xs">Package price (you enter it)</Label>
              <Input id="package-price" className="h-9 w-32 tabular-nums" inputMode="decimal" value={packagePrice} onChange={e => setPackagePrice(e.target.value)} /></div>
            <Button size="sm" disabled={!Number.isFinite(manual) || manual < 0 || run.isPending} data-testid="button-create-package"
              onClick={() => run.mutate({ method: "POST", url: `/api/estimates/${id}/dent-groups`, body: { scope: packaging, dentIds: selected, manualPrice: roundMoney(manual) }, done: "Package added." })}>
              {run.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add package</Button>
            <Button size="sm" variant="ghost" onClick={() => setPackaging(null)}>Cancel</Button>
          </div>
          {needsApproval && <p className="text-xs text-amber-700">This price {calculated === null ? "cannot be compared because pricing is incomplete, so it" : "is below the calculated total and"} will need approval from an owner, administrator or manager.</p>}
          {!allUnbilled && <p className="text-xs text-muted-foreground">Selected individually billed dents will have their lines removed and be included in this package.</p>}
        </div>}

        {groups.length > 0 && <section className="space-y-2" aria-label="Packages">
          <div className="text-sm font-semibold">Packages ({groups.length})</div>
          {groups.map(g => <PackageRow key={g.id} g={g} dents={dents.filter(d => g.dentIds.includes(d.id))} readOnly={readOnly} canApprove={can("pricing.approve")} run={run} />)}
        </section>}
      </CardContent>
    </Card>
  );
}

function Comparison({ calculated, manual, comparison }: { calculated: number | null; manual: number | null; comparison: ReturnType<typeof packageComparison> | null }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm" data-testid="package-comparison">
    <div><div className="text-xs text-muted-foreground">Calculated total</div><div className="font-medium tabular-nums">{calculated === null ? "Pricing incomplete" : fmt(calculated)}</div></div>
    <div><div className="text-xs text-muted-foreground">Package price</div><div className="font-medium tabular-nums">{manual === null ? "—" : fmt(manual)}</div></div>
    <div><div className="text-xs text-muted-foreground">Difference</div><div className="font-medium tabular-nums">{!comparison ? "—" : comparison.complete ? signed(comparison.difference!) : "Pricing incomplete"}</div></div>
    <div><div className="text-xs text-muted-foreground">Difference %</div><div className="font-medium tabular-nums">{!comparison ? "—" : comparison.complete ? pct(comparison.percent) || "—" : "Pricing incomplete"}</div></div>
  </div>;
}

function DentPriceRow({ dent, checked, onToggle, readOnly, onDone }: { dent: Dent; checked: boolean; onToggle: () => void; readOnly: boolean; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(""), [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", `/api/estimates/dents/${dent.id}/price`, body),
    onSuccess: () => { setEditing(false); setPrice(""); setReason(""); setError(""); onDone(); },
    onError: (e: any) => setError(e.message || "Not saved"),
  });
  return <div className="rounded-md border p-2.5 text-sm space-y-2" data-testid={`dent-price-${dent.id}`}>
    <div className="flex items-start justify-between gap-2">
      <label className="flex items-start gap-2 min-w-0">
        {!readOnly && <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={onToggle} aria-label={`Select ${describe(dent)}`} />}
        <span className="min-w-0"><span className="block">{describe(dent)}</span>
          <span className="block text-xs text-muted-foreground">{dent.overridePrice != null
            ? `Entered price by ${dent.overrideBy}: ${dent.overrideReason} (calculated ${dent.overrideSuggestedPrice != null ? fmt(dent.overrideSuggestedPrice) : "none"})`
            : dent.suggestedSource || ""}</span></span>
      </label>
      <div className="text-right shrink-0">
        {dent.referencePrice != null ? <div className="font-semibold tabular-nums">{fmt(dent.referencePrice)}</div> : <Badge variant="outline" className="text-amber-700">Pricing incomplete</Badge>}
        {!readOnly && !editing && <button type="button" className="text-xs text-primary underline" onClick={() => setEditing(true)}>{dent.referencePrice == null ? "Enter price" : "Change price"}</button>}
      </div>
    </div>
    {editing && <div className="flex flex-wrap items-end gap-2">
      <div><Label htmlFor={`price-${dent.id}`} className="text-xs">Price</Label><Input id={`price-${dent.id}`} className="h-9 w-28 tabular-nums" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></div>
      <div className="grow min-w-[12rem]"><Label htmlFor={`reason-${dent.id}`} className="text-xs">Reason{dent.suggestedPrice == null ? " (optional)" : ""}</Label><Input id={`reason-${dent.id}`} className="h-9" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder={dent.suggestedPrice == null ? "No matrix price available" : "Why the price differs"} /></div>
      <Button size="sm" disabled={price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0 || save.isPending} onClick={() => save.mutate({ price: roundMoney(Number(price)), reason })}>Save price</Button>
      {dent.overridePrice != null && <Button size="sm" variant="outline" onClick={() => save.mutate({ price: null })}>Use calculated price</Button>}
      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>}
  </div>;
}

function PackageRow({ g, dents, readOnly, canApprove, run }: { g: Group; dents: Dent[]; readOnly: boolean; canApprove: boolean; run: any }) {
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState(false);
  return <div className="rounded-md border p-3 space-y-2 text-sm" data-testid={`package-${g.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-medium">{g.label}</span>
      {g.approvalRequired ? g.approved
        ? <Badge variant="secondary" className="text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Approved by {g.approvedBy} {g.approvedAt ? new Date(g.approvedAt).toLocaleString() : ""}</Badge>
        : <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500/60">Needs approval</Badge>
        : <Badge variant="outline" className="text-[10px]">No approval needed</Badge>}
    </div>
    <Comparison calculated={g.calculatedTotal} manual={g.manualPrice} comparison={{ complete: g.pricingComplete, difference: g.difference, percent: g.differencePercent } as any} />
    <details><summary className="cursor-pointer text-xs text-muted-foreground">This package includes {dents.length} dent{dents.length === 1 ? "" : "s"}</summary>
      <ul className="mt-1 space-y-0.5 text-xs">{dents.map(d => <li key={d.id} className="flex justify-between gap-2"><span>{describe(d)}</span><span className="tabular-nums">{d.referencePrice != null ? fmt(d.referencePrice) : "Pricing incomplete"}</span></li>)}</ul>
    </details>
    {!readOnly && <div className="flex flex-wrap items-end gap-2">
      {canApprove && g.approvalRequired && !g.approved && <Button size="sm" data-testid={`button-approve-package-${g.id}`} disabled={run.isPending}
        onClick={() => run.mutate({ method: "POST", url: `/api/estimates/dent-groups/${g.id}/approve`, body: { manualPrice: g.manualPrice }, done: "Package price approved." })}>Approve package price</Button>}
      {editing ? <>
        <div><Label htmlFor={`pkg-price-${g.id}`} className="text-xs">New package price</Label><Input id={`pkg-price-${g.id}`} className="h-9 w-28 tabular-nums" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></div>
        <Button size="sm" disabled={price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0} onClick={() => { setEditing(false); run.mutate({ method: "PATCH", url: `/api/estimates/dent-groups/${g.id}`, body: { manualPrice: roundMoney(Number(price)) }, done: "Package price changed. A new approval is needed if it is below the calculated total." }); }}>Save price</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </> : <Button size="sm" variant="outline" onClick={() => { setPrice(String(g.manualPrice)); setEditing(true); }}>Change package price</Button>}
      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Remove this package? Its line is removed and its dents return to Not yet billed with their prices kept.")) run.mutate({ method: "DELETE", url: `/api/estimates/dent-groups/${g.id}`, done: "Package removed. Its dents are back in Not yet billed." }); }}>Remove package</Button>
    </div>}
    {!canApprove && g.approvalRequired && !g.approved && <p className="text-xs text-muted-foreground">Ask an owner, administrator or manager to open this estimate and approve the package price.</p>}
  </div>;
}
