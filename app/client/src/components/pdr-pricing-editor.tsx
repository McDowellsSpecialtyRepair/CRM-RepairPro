import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  STANDARD_DENT_SIZES, DENT_SIZE_LABELS, DENT_SEVERITIES, DENT_SEVERITY_LABELS, LOCATION_DIFFICULTIES, LOCATION_DIFFICULTY_LABELS,
  PDR_PANELS, BODY_STYLE_LABELS, DENT_BODY_STYLES, lengthRangeLabel,
} from "@shared/dents";

type Master = {
  categories: { key: string; label: string; bodyStyles: string[] }[];
  standard: { id: number; size: string; category: string; price: number }[];
  ranges: { id: number; minIn: number; maxIn: number }[];
  creasePrices: { rangeId: number; severity: string; category: string; price: number }[];
  adjustments: { appliesTo: string; dimension: string; value: string; kind: "amount" | "percent"; amount: number }[];
  settings: { packageApprovalThresholdPercent: number | null };
};
const KEY = ["/api/pdr-pricing"];

// Management editor for paintless dent repair prices. Blank cells mean "not priced": estimators must
// enter a price for that dent. Changes never alter estimates that were already priced.
export function PdrPricingEditor() {
  const { can } = useAuth();
  const editable = can("pricing.manage");
  const queryClient = useQueryClient();
  const { data: m, isLoading, error } = useQuery<Master>({ queryKey: KEY, queryFn: () => apiRequest("GET", "/api/pdr-pricing") });
  const [message, setMessage] = useState("");
  const save = async (method: string, url: string, body?: any) => {
    setMessage("");
    try {
      const next = await apiRequest(method, url, body);
      queryClient.setQueryData(KEY, next);
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-matrices"] });
      setMessage("Saved");
      return true;
    } catch (e: any) { setMessage(e.message || "Not saved"); return false; }
  };
  if (isLoading || !m) return <p className="text-sm">{error ? (error as any).message : "Loading PDR pricing…"}</p>;
  const adj = (appliesTo: string, dimension: string, value: string) => m.adjustments.find(a => a.appliesTo === appliesTo && a.dimension === dimension && a.value === value);
  const putAdj = (appliesTo: string, dimension: string, value: string, kind: string, amount: number | null) =>
    save("PUT", "/api/pdr-pricing/adjustments", { appliesTo, dimension, value, kind, amount });

  return (
    <div className="space-y-4" data-testid="pdr-pricing-editor">
      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <p><strong>How a dent's suggested price is calculated:</strong> the base price from the tables below, plus any adjustments that apply to that dent. A percentage adjustment is a percent of the base price.</p>
          <p>A <strong>blank cell means "not priced"</strong>: the estimator must enter that dent's price, and package comparisons show "Pricing incomplete". Blank adjustments mean no adjustment.</p>
          <p>Changing prices here <strong>does not change any estimate already priced</strong>. On an estimate, staff can choose "Reprice from current matrix", which is recorded in the audit history.</p>
          {!editable && <p className="text-amber-700">You can view these prices. Changing them requires the "Manage pricing" permission (owner, administrator or manager).</p>}
          {message && <p role="status" className={message === "Saved" ? "text-muted-foreground" : "text-destructive"} data-testid="pricing-save-status">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">1. Vehicle categories</CardTitle>
          <p className="text-xs text-muted-foreground">Each estimate diagram body style (Sedan, SUV, Pickup) is priced with one category. Assigning a body style moves it from its current category.</p></CardHeader>
        <CardContent className="space-y-3">
          {m.categories.map(c => <CategoryRow key={c.key} c={c} editable={editable} save={save} />)}
          {editable && <AddCategory save={save} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">2. Standard dent prices (per dent)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-2 sm:hidden">Swipe the table sideways to see every vehicle category.</p>
          <table className="text-sm min-w-[420px]">
            <thead><tr className="text-xs text-muted-foreground"><th className="text-left pr-3 pb-2 sticky left-0 bg-card z-10">Dent size</th>{m.categories.map(c => <th key={c.key} className="text-left px-2 pb-2">{c.label}</th>)}</tr></thead>
            <tbody>{STANDARD_DENT_SIZES.map(size => <tr key={size}><td className="pr-3 py-1 font-medium sticky left-0 bg-card z-10">{DENT_SIZE_LABELS[size]}</td>
              {m.categories.map(c => <td key={c.key} className="px-2 py-1"><PriceCell label={`Standard ${DENT_SIZE_LABELS[size]} dent price, ${c.label}`} disabled={!editable}
                value={m.standard.find(r => r.size === size && r.category === c.key)?.price ?? null}
                onSave={price => save("PUT", "/api/pdr-pricing/standard", { size, category: c.key, price })} /></td>)}</tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">3. Length ranges</CardTitle>
          <p className="text-xs text-muted-foreground">Used for crease prices and for optional length adjustments on standard dents. Ranges are whole inches from 1 to 36 and cannot overlap.</p></CardHeader>
        <CardContent className="space-y-2">
          {!m.ranges.length && <p className="text-sm text-muted-foreground">No length ranges yet. Add one to start entering crease prices.</p>}
          {m.ranges.map(r => <RangeRow key={r.id} r={r} editable={editable} save={save} />)}
          {editable && <AddRange save={save} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">4. Crease prices (per crease)</CardTitle>
          <p className="text-xs text-muted-foreground">Length range × severity, for each vehicle category. On a phone, swipe a table sideways to see every severity.</p></CardHeader>
        <CardContent className="space-y-4">
          {!m.ranges.length ? <p className="text-sm text-muted-foreground">Add length ranges first (section 3).</p> : m.categories.map(c => (
            <div key={c.key} className="overflow-x-auto">
              <div className="text-sm font-semibold mb-1">{c.label}</div>
              <table className="text-sm min-w-[420px]">
                <thead><tr className="text-xs text-muted-foreground"><th className="text-left pr-3 pb-2 sticky left-0 bg-card z-10">Length</th>{DENT_SEVERITIES.map(s => <th key={s} className="text-left px-2 pb-2">{DENT_SEVERITY_LABELS[s]}</th>)}</tr></thead>
                <tbody>{m.ranges.map(r => <tr key={r.id}><td className="pr-3 py-1 font-medium whitespace-nowrap sticky left-0 bg-card z-10">{lengthRangeLabel(r)}</td>
                  {DENT_SEVERITIES.map(s => <td key={s} className="px-2 py-1"><PriceCell label={`Crease ${lengthRangeLabel(r)} ${DENT_SEVERITY_LABELS[s]} price, ${c.label}`} disabled={!editable}
                    value={m.creasePrices.find(p => p.rangeId === r.id && p.severity === s && p.category === c.key)?.price ?? null}
                    onSave={price => save("PUT", "/api/pdr-pricing/crease", { rangeId: r.id, severity: s, category: c.key, price })} /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">5. Crease adjustments (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AdjustmentTable title="By location difficulty" rows={LOCATION_DIFFICULTIES.map(v => ({ value: v, label: LOCATION_DIFFICULTY_LABELS[v] }))}
            find={v => adj("crease", "location_difficulty", v)} onSave={(v, k, a) => putAdj("crease", "location_difficulty", v, k, a)} editable={editable} prefix="Crease" />
          <PanelAdjustments appliesTo="crease" m={m} editable={editable} onSave={(v, k, a) => putAdj("crease", "panel", v, k, a)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">6. Standard dent adjustments (optional)</CardTitle>
          <p className="text-xs text-muted-foreground">All blank by default, so standard dents are priced from the table in section 2 only.</p></CardHeader>
        <CardContent className="space-y-4">
          <AdjustmentTable title="By severity" rows={DENT_SEVERITIES.map(v => ({ value: v, label: DENT_SEVERITY_LABELS[v] }))}
            find={v => adj("standard", "severity", v)} onSave={(v, k, a) => putAdj("standard", "severity", v, k, a)} editable={editable} prefix="Standard dent" />
          <AdjustmentTable title="By location difficulty" rows={LOCATION_DIFFICULTIES.map(v => ({ value: v, label: LOCATION_DIFFICULTY_LABELS[v] }))}
            find={v => adj("standard", "location_difficulty", v)} onSave={(v, k, a) => putAdj("standard", "location_difficulty", v, k, a)} editable={editable} prefix="Standard dent" />
          {m.ranges.length > 0 && <AdjustmentTable title="By length range" rows={m.ranges.map(r => ({ value: String(r.id), label: lengthRangeLabel(r) }))}
            find={v => adj("standard", "length_range", v)} onSave={(v, k, a) => putAdj("standard", "length_range", v, k, a)} editable={editable} prefix="Standard dent" />}
          <PanelAdjustments appliesTo="standard" m={m} editable={editable} onSave={(v, k, a) => putAdj("standard", "panel", v, k, a)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">7. Package price approval</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>A panel or whole-vehicle package priced below its calculated individual dent total needs approval from an owner, administrator or manager before the estimate can be sent, approved, invoiced or moved into production.</p>
          <ThresholdSetting value={m.settings.packageApprovalThresholdPercent} editable={editable}
            onSave={v => save("PUT", "/api/pdr-pricing/settings", { packageApprovalThresholdPercent: v })} />
        </CardContent>
      </Card>
    </div>
  );
}

const parseMoney = (s: string) => { const t = s.trim().replace(/^\$/, "").replace(/,/g, ""); return t === "" ? null : Number(t); };

function PriceCell({ value, onSave, label, disabled }: { value: number | null; onSave: (v: number | null) => Promise<boolean>; label: string; disabled: boolean }) {
  const shown = value === null ? "" : value.toFixed(2);
  const [draft, setDraft] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => setDraft(shown), [shown]);
  const commit = async () => {
    const v = parseMoney(draft);
    if (v !== null && (!Number.isFinite(v) || v < 0)) { setBad(true); return; }
    setBad(false);
    if ((v === null ? "" : v.toFixed(2)) === shown) return;
    if (!(await onSave(v === null ? null : Math.round(v * 100) / 100))) setDraft(shown);
  };
  return <div className="flex items-center gap-1"><span className="text-muted-foreground">$</span>
    <Input aria-label={label} className={`h-9 w-24 tabular-nums ${bad ? "border-destructive" : ""}`} inputMode="decimal" placeholder="Not priced" disabled={disabled}
      value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></div>;
}

function CategoryRow({ c, editable, save }: { c: Master["categories"][number]; editable: boolean; save: (m: string, u: string, b?: any) => Promise<boolean> }) {
  const [name, setName] = useState(c.label);
  useEffect(() => setName(c.label), [c.label]);
  return <div className="rounded-md border p-3 space-y-2" data-testid={`category-${c.key}`}>
    <div className="flex flex-wrap items-end gap-2">
      <div><Label htmlFor={`cat-${c.key}`} className="text-xs">Category name</Label>
        <Input id={`cat-${c.key}`} className="h-9 w-48" disabled={!editable} value={name} onChange={e => setName(e.target.value)} /></div>
      {editable && name.trim() !== c.label && <Button size="sm" onClick={() => save("PATCH", `/api/pdr-pricing/categories/${c.key}`, { label: name })}>Save name</Button>}
    </div>
    <div className="flex flex-wrap gap-4 text-sm"><span className="text-xs text-muted-foreground self-center">Prices these body styles:</span>
      {DENT_BODY_STYLES.map(b => <label key={b} className="flex items-center gap-1.5">
        <input type="checkbox" disabled={!editable} checked={c.bodyStyles.includes(b)} aria-label={`${c.label} prices ${BODY_STYLE_LABELS[b]}`}
          onChange={e => save("PATCH", `/api/pdr-pricing/categories/${c.key}`, { bodyStyles: e.target.checked ? [...c.bodyStyles, b] : c.bodyStyles.filter(x => x !== b) })} />
        {BODY_STYLE_LABELS[b]}</label>)}
      {!c.bodyStyles.length && <span className="text-xs text-amber-700">Not used until a body style is assigned.</span>}
    </div>
  </div>;
}
function AddCategory({ save }: { save: (m: string, u: string, b?: any) => Promise<boolean> }) {
  const [name, setName] = useState("");
  return <div className="flex flex-wrap items-end gap-2">
    <div><Label htmlFor="new-category" className="text-xs">New vehicle category</Label><Input id="new-category" className="h-9 w-48" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Full-size truck" /></div>
    <Button size="sm" variant="outline" disabled={!name.trim()} onClick={async () => { if (await save("POST", "/api/pdr-pricing/categories", { label: name })) setName(""); }}><Plus className="h-4 w-4 mr-1" /> Add category</Button>
  </div>;
}

function RangeRow({ r, editable, save }: { r: Master["ranges"][number]; editable: boolean; save: (m: string, u: string, b?: any) => Promise<boolean> }) {
  const [from, setFrom] = useState(String(r.minIn)), [to, setTo] = useState(String(r.maxIn));
  useEffect(() => { setFrom(String(r.minIn)); setTo(String(r.maxIn)); }, [r.minIn, r.maxIn]);
  const dirty = from !== String(r.minIn) || to !== String(r.maxIn);
  return <div className="flex flex-wrap items-center gap-2 text-sm" data-testid={`range-${r.id}`}>
    <span>From</span><Input aria-label={`Range ${lengthRangeLabel(r)} from inches`} className="h-9 w-16" inputMode="numeric" disabled={!editable} value={from} onChange={e => setFrom(e.target.value)} />
    <span>to</span><Input aria-label={`Range ${lengthRangeLabel(r)} to inches`} className="h-9 w-16" inputMode="numeric" disabled={!editable} value={to} onChange={e => setTo(e.target.value)} /><span>inches</span>
    {editable && dirty && <Button size="sm" onClick={() => save("PATCH", `/api/pdr-pricing/ranges/${r.id}`, { minIn: Number(from), maxIn: Number(to) })}>Save</Button>}
    {editable && <Button size="sm" variant="ghost" aria-label={`Remove range ${lengthRangeLabel(r)}`}
      onClick={() => { if (window.confirm(`Remove the ${lengthRangeLabel(r)} range? Its crease prices and length adjustments are removed too. Estimates already priced keep their prices.`)) save("DELETE", `/api/pdr-pricing/ranges/${r.id}`); }}><Trash2 className="h-4 w-4" /></Button>}
  </div>;
}
function AddRange({ save }: { save: (m: string, u: string, b?: any) => Promise<boolean> }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  return <div className="flex flex-wrap items-center gap-2 text-sm pt-1">
    <span>New range from</span><Input aria-label="New range from inches" className="h-9 w-16" inputMode="numeric" value={from} onChange={e => setFrom(e.target.value)} />
    <span>to</span><Input aria-label="New range to inches" className="h-9 w-16" inputMode="numeric" value={to} onChange={e => setTo(e.target.value)} /><span>inches</span>
    <Button size="sm" variant="outline" disabled={!from || !to} onClick={async () => { if (await save("POST", "/api/pdr-pricing/ranges", { minIn: Number(from), maxIn: Number(to) })) { setFrom(""); setTo(""); } }}>
      <Plus className="h-4 w-4 mr-1" /> Add range</Button>
  </div>;
}

type Adj = Master["adjustments"][number] | undefined;
function AdjustmentTable({ title, rows, find, onSave, editable, prefix }: { title: string; rows: { value: string; label: string }[]; find: (v: string) => Adj; onSave: (v: string, k: string, a: number | null) => Promise<boolean>; editable: boolean; prefix: string }) {
  return <div className="space-y-1"><div className="text-sm font-semibold">{title}</div>
    {rows.map(r => <AdjustmentRow key={r.value} label={r.label} current={find(r.value)} editable={editable} aria={`${prefix} adjustment, ${r.label}`} onSave={(k, a) => onSave(r.value, k, a)} />)}
  </div>;
}
function AdjustmentRow({ label, current, editable, aria, onSave, onRemove }: { label: string; current: Adj; editable: boolean; aria: string; onSave: (k: string, a: number | null) => Promise<boolean>; onRemove?: () => void }) {
  const [kind, setKind] = useState(current?.kind || "amount");
  const [amount, setAmount] = useState(current ? String(current.amount) : "");
  useEffect(() => { setKind(current?.kind || "amount"); setAmount(current ? String(current.amount) : ""); }, [current?.kind, current?.amount]);
  const dirty = kind !== (current?.kind || "amount") || amount !== (current ? String(current.amount) : "");
  const commit = () => { const v = amount.trim() === "" ? null : Number(amount.replace(/[$%,]/g, "")); onSave(kind, v === null || Number.isFinite(v) ? v : NaN); };
  return <div className="flex flex-wrap items-center gap-2 text-sm py-0.5">
    <span className="w-28">{label}</span>
    <select aria-label={`${aria} type`} className="h-9 rounded-md border bg-background px-2" disabled={!editable} value={kind} onChange={e => setKind(e.target.value as any)}>
      <option value="amount">Dollar amount ($)</option><option value="percent">Percent of base (%)</option>
    </select>
    <Input aria-label={`${aria} amount`} className="h-9 w-24 tabular-nums" inputMode="decimal" placeholder="None" disabled={!editable} value={amount} onChange={e => setAmount(e.target.value)} />
    {editable && dirty && <Button size="sm" onClick={commit}>Save</Button>}
    {editable && current && <Button size="sm" variant="ghost" onClick={() => { setAmount(""); onSave(kind, null); onRemove?.(); }}>Clear</Button>}
  </div>;
}
function PanelAdjustments({ appliesTo, m, editable, onSave }: { appliesTo: string; m: Master; editable: boolean; onSave: (v: string, k: string, a: number | null) => Promise<boolean> }) {
  const set = m.adjustments.filter(a => a.appliesTo === appliesTo && a.dimension === "panel");
  const [adding, setAdding] = useState("");
  const shown = Array.from(new Set([...set.map(a => a.value), ...(adding ? [adding] : [])]));
  return <div className="space-y-1"><div className="text-sm font-semibold">By panel</div>
    {!shown.length && <p className="text-xs text-muted-foreground">No panel adjustments.</p>}
    {shown.map(v => <AdjustmentRow key={v} label={PDR_PANELS.find(p => p.id === v)?.name || v} current={set.find(a => a.value === v)} editable={editable}
      aria={`${appliesTo === "crease" ? "Crease" : "Standard dent"} adjustment, ${PDR_PANELS.find(p => p.id === v)?.name || v}`}
      onSave={async (k, a) => { const ok = await onSave(v, k, a); if (ok) setAdding(""); return ok; }} onRemove={() => setAdding("")} />)}
    {editable && <select aria-label={`Add ${appliesTo} panel adjustment`} className="h-9 rounded-md border bg-background px-2 text-sm" value="" onChange={e => setAdding(e.target.value)}>
      <option value="">Add a panel adjustment…</option>
      {PDR_PANELS.filter(p => !shown.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>}
  </div>;
}
function ThresholdSetting({ value, editable, onSave }: { value: number | null; editable: boolean; onSave: (v: number | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  return <div className="flex flex-wrap items-center gap-2">
    <Label htmlFor="threshold">Require approval when a package is more than</Label>
    <Input id="threshold" className="h-9 w-20" inputMode="decimal" placeholder="0" disabled={!editable} value={draft} onChange={e => setDraft(e.target.value)} />
    <span>% below its calculated total.</span>
    {editable && draft !== (value === null ? "" : String(value)) && <Button size="sm" onClick={() => onSave(draft.trim() === "" ? null : Number(draft))}>Save</Button>}
    <p className="w-full text-xs text-muted-foreground">{value === null ? "Not set: every package below its calculated total needs approval." : `Set to ${value}%: smaller reductions do not need approval.`} Packages with incomplete pricing always need approval.</p>
  </div>;
}
