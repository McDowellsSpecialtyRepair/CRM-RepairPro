import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Megaphone, Check } from "lucide-react";

const nameOf = (c: any) => c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.customerNumber;
const GROUPS = ["How they found us", "Referred by", "How the estimate came in", "Customer"];
type Draft = { tagIds: number[]; referrerCustomerId: number | null; referrerName: string; referrerPhone: string; referrerNote: string };

// Marketing tags on an estimate (as in RoadFS): tap as many as apply, in four groups. The list is kept on the
// Marketing page. A referral tag also records who referred the customer and puts them on the thank-you list.
export function EstimateMarketing({ estimateId, customerId, locked, onDirtyChange }: { estimateId: number; customerId: number; locked?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const url = `/api/estimates/${estimateId}/marketing`;
  const q = useQuery<any>({ queryKey: [url], queryFn: () => apiRequest("GET", url) });
  const sources = useQuery<any[]>({ queryKey: ["/api/marketing-sources"], queryFn: () => apiRequest("GET", "/api/marketing-sources") });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const editable = can("estimates.write") && !locked;
  const customers = useQuery<any[]>({ queryKey: ["/api/customers"], enabled: !!draft && can("customers.read") });
  useEffect(() => { onDirtyChange?.(!!draft || busy); }, [draft, busy, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  if (q.isLoading || sources.isLoading) return null;
  if (q.error) return <p role="alert" className="text-sm text-destructive">The marketing tags could not load. {(q.error as Error).message}</p>;
  const m = q.data;
  const onEstimate = new Set((m.tags || []).map((t: any) => t.id));
  const fromServer = (): Draft => ({ tagIds: (m.tags || []).map((t: any) => t.id), referrerCustomerId: m.referrer?.customerId ?? null, referrerName: m.referrer?.customerId ? "" : m.referrer?.name || "", referrerPhone: m.referrer?.customerId ? "" : m.referrer?.phone || "", referrerNote: m.referrer?.note || "" });
  const d = draft || fromServer();
  const set = (next: Partial<Draft>) => { setDraft({ ...d, ...next }); setSaved(false); setError(""); };
  const toggle = (id: number) => set({ tagIds: d.tagIds.includes(id) ? d.tagIds.filter(x => x !== id) : [...d.tagIds, id] });
  const list = (sources.data || []).filter(s => s.active || onEstimate.has(s.id));
  const chosen = list.filter(s => d.tagIds.includes(s.id));
  const referralTag = chosen.find(s => s.needsReferrer);
  const matches = search.trim().length >= 2 ? (customers.data || []).filter(c => c.id !== customerId && `${nameOf(c)} ${c.phone || ""} ${c.mobile || ""} ${c.email || ""}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];
  const picked = d.referrerCustomerId ? (customers.data || []).find(c => c.id === d.referrerCustomerId) : null;

  async function save() {
    if (referralTag && !d.referrerCustomerId && !d.referrerName.trim()) { setError(`"${referralTag.name}" is chosen: enter who referred this customer (choose a customer or type their name).`); return; }
    setBusy(true); setError("");
    try {
      const body: any = { sourceIds: d.tagIds };
      if (referralTag) Object.assign(body, d.referrerCustomerId ? { referrerCustomerId: d.referrerCustomerId } : { referrerName: d.referrerName, referrerPhone: d.referrerPhone || null }, { referrerNote: d.referrerNote || null });
      const result = await apiRequest("PUT", url, body);
      qc.setQueryData([url], result);
      await qc.invalidateQueries({ queryKey: ["/api/referrals"] });
      setDraft(null); setSearch(""); setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return <Card data-testid="card-estimate-marketing"><CardContent className="p-4 space-y-3">
    <div className="flex items-center gap-2"><Megaphone className="h-4 w-4" /><h2 className="font-semibold text-sm">Marketing tags: how did the customer hear about us?</h2></div>
    <p className="text-xs text-muted-foreground">Tap every tag that applies (for example Radio + Lobby - In Person + New Customer). Tap again to remove it.</p>
    <fieldset disabled={!editable || busy} className="space-y-3">
      {GROUPS.map(g => {
        const tags = list.filter(s => (s.group || GROUPS[0]) === g);
        if (!tags.length) return null;
        return <div key={g} data-testid={`tag-group-${g}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g}</p>
          <div className="flex flex-wrap gap-2">{tags.map(s => {
            const on = d.tagIds.includes(s.id);
            return <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} data-testid={`tag-${s.name}`}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm flex items-center gap-1 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60"} ${s.active ? "" : "opacity-70"}`}>
              {on && <Check className="h-3.5 w-3.5" />}{s.name}{s.active ? "" : " (turned off)"}
            </button>;
          })}</div>
        </div>;
      })}
      {referralTag && <div className="rounded-md border p-3 space-y-3" data-testid="referrer-fields">
        <p className="text-sm font-medium">Who referred this customer? <span className="font-normal text-muted-foreground">({chosen.filter(s => s.needsReferrer).map(s => s.name).join(", ")})</span></p>
        {d.referrerCustomerId ? <div className="flex flex-wrap items-center gap-2 text-sm">
          <span data-testid="text-referrer-picked">{picked ? `${nameOf(picked)}${picked.phone ? " · " + picked.phone : ""}` : m.referrer?.name || "Selected customer"}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ referrerCustomerId: null })}>Choose someone else</Button>
        </div> : <>
          {can("customers.read") && <label className="text-sm block">Find an existing customer, body shop or dealer
            <Input aria-label="Find referring customer" className="mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name, phone or email" /></label>}
          {matches.length > 0 && <ul className="rounded-md border divide-y text-sm" data-testid="referrer-matches">{matches.map(c => <li key={c.id}>
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted" onClick={() => { set({ referrerCustomerId: c.id, referrerName: "", referrerPhone: "" }); setSearch(""); }}>{nameOf(c)}{c.phone ? ` · ${c.phone}` : ""}</button></li>)}</ul>}
          <p className="text-xs text-muted-foreground">Not in the CRM yet? Type their name (and phone if you have it).</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">Referred by (name)<Input aria-label="Referred by name" className="mt-1" maxLength={120} value={d.referrerName} onChange={e => set({ referrerName: e.target.value })} /></label>
            <label className="text-sm">Their phone<Input aria-label="Referrer phone" className="mt-1" maxLength={40} value={d.referrerPhone} onChange={e => set({ referrerPhone: e.target.value })} /></label>
          </div>
        </>}
        <label className="text-sm block">Note (optional)<Input aria-label="Referral note" className="mt-1" maxLength={500} value={d.referrerNote} onChange={e => set({ referrerNote: e.target.value })} placeholder="For example: neighbor, coworker" /></label>
        <p className="text-xs text-muted-foreground">Saving adds this person to the referral thank-you list on the Marketing page.</p>
      </div>}
    </fieldset>
    {!draft && m.needsReferrer && m.thankYouStatus && <p className="text-xs text-muted-foreground" data-testid="text-thank-you-status">Thank-you list: {m.thankYouStatus === "thanked" ? `thanked${m.thankedBy ? " by " + m.thankedBy : ""}` : "waiting for a thank-you"}{m.referrer?.name ? ` (${m.referrer.name})` : ""}.</p>}
    {!draft && !(m.tags || []).length && <p className="text-xs text-amber-700 dark:text-amber-300">No tags yet.</p>}
    {sources.error && <p role="alert" className="text-sm text-destructive">The list of tags could not load.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && !draft && <p role="status" className="text-sm text-primary">Saved.</p>}
    {editable && draft && <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={save} disabled={busy} data-testid="button-save-marketing">{busy ? "Saving…" : "Save tags"}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setError(""); setSearch(""); }}>Cancel</Button>
    </div>}
  </CardContent></Card>;
}
