import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Megaphone } from "lucide-react";

const nameOf = (c: any) => c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.customerNumber;
type Draft = { sourceId: number | null; referrerCustomerId: number | null; referrerName: string; referrerPhone: string; referrerNote: string };

// "How did the customer hear about us?" on an estimate (choices come from the list on the Marketing page).
// A referral also records who referred the customer, which puts that person on the referral thank-you list.
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
  if (q.error) return <p role="alert" className="text-sm text-destructive">How the customer heard about us could not load. {(q.error as Error).message}</p>;
  const m = q.data;
  const fromServer = (): Draft => ({ sourceId: m.sourceId, referrerCustomerId: m.referrer?.customerId ?? null, referrerName: m.referrer?.customerId ? "" : m.referrer?.name || "", referrerPhone: m.referrer?.customerId ? "" : m.referrer?.phone || "", referrerNote: m.referrer?.note || "" });
  const d = draft || fromServer();
  const set = (next: Partial<Draft>) => { setDraft({ ...d, ...next }); setSaved(false); setError(""); };
  const list = (sources.data || []).filter(s => s.active || s.id === m.sourceId);
  const chosen = list.find(s => s.id === d.sourceId);
  const matches = search.trim().length >= 2 ? (customers.data || []).filter(c => c.id !== customerId && `${nameOf(c)} ${c.phone || ""} ${c.mobile || ""} ${c.email || ""}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];
  const picked = d.referrerCustomerId ? (customers.data || []).find(c => c.id === d.referrerCustomerId) : null;

  async function save() {
    if (chosen?.needsReferrer && !d.referrerCustomerId && !d.referrerName.trim()) { setError("Enter who referred this customer: choose a customer or type their name."); return; }
    setBusy(true); setError("");
    try {
      const body: any = { sourceId: d.sourceId };
      if (chosen?.needsReferrer) Object.assign(body, d.referrerCustomerId ? { referrerCustomerId: d.referrerCustomerId } : { referrerName: d.referrerName, referrerPhone: d.referrerPhone || null }, { referrerNote: d.referrerNote || null });
      const result = await apiRequest("PUT", url, body);
      qc.setQueryData([url], result);
      await qc.invalidateQueries({ queryKey: ["/api/referrals"] });
      setDraft(null); setSearch(""); setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const select = "mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

  return <Card data-testid="card-estimate-marketing"><CardContent className="p-4 space-y-3">
    <div className="flex items-center gap-2"><Megaphone className="h-4 w-4" /><h2 className="font-semibold text-sm">How did the customer hear about us?</h2></div>
    <fieldset disabled={!editable || busy} className="space-y-3">
      <label className="text-sm block sm:max-w-sm">Heard about us from
        <select aria-label="Heard about us from" className={select} value={d.sourceId ?? ""} onChange={e => set({ sourceId: e.target.value ? Number(e.target.value) : null })} data-testid="select-marketing-source">
          <option value="">Not recorded yet</option>
          {list.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (no longer offered)"}</option>)}
        </select></label>
      {chosen?.needsReferrer && <div className="rounded-md border p-3 space-y-3" data-testid="referrer-fields">
        <p className="text-sm font-medium">Who referred this customer?</p>
        {d.referrerCustomerId ? <div className="flex flex-wrap items-center gap-2 text-sm">
          <span data-testid="text-referrer-picked">{picked ? `${nameOf(picked)}${picked.phone ? " · " + picked.phone : ""}` : m.referrer?.name || "Selected customer"}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ referrerCustomerId: null })}>Choose someone else</Button>
        </div> : <>
          {can("customers.read") && <label className="text-sm block">Find an existing customer
            <Input aria-label="Find referring customer" className="mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name, phone or email" /></label>}
          {matches.length > 0 && <ul className="rounded-md border divide-y text-sm" data-testid="referrer-matches">{matches.map(c => <li key={c.id}>
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted" onClick={() => { set({ referrerCustomerId: c.id, referrerName: "", referrerPhone: "" }); setSearch(""); }}>{nameOf(c)}{c.phone ? ` · ${c.phone}` : ""}</button></li>)}</ul>}
          <p className="text-xs text-muted-foreground">Not a customer yet? Type their name (and phone if you have it).</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">Referred by (name)<Input aria-label="Referred by name" className="mt-1" maxLength={120} value={d.referrerName} onChange={e => set({ referrerName: e.target.value })} /></label>
            <label className="text-sm">Their phone<Input aria-label="Referrer phone" className="mt-1" maxLength={40} value={d.referrerPhone} onChange={e => set({ referrerPhone: e.target.value })} /></label>
          </div>
        </>}
        <label className="text-sm block">Note (optional)<Input aria-label="Referral note" className="mt-1" maxLength={500} value={d.referrerNote} onChange={e => set({ referrerNote: e.target.value })} placeholder="For example: neighbor, coworker" /></label>
        <p className="text-xs text-muted-foreground">Saving adds this person to the referral thank-you list on the Marketing page.</p>
      </div>}
    </fieldset>
    {!draft && m.needsReferrer && m.thankYouStatus && <p className="text-xs text-muted-foreground" data-testid="text-thank-you-status">Thank-you list: {m.thankYouStatus === "thanked" ? `thanked${m.thankedBy ? " by " + m.thankedBy : ""}` : "waiting for a thank-you"}.</p>}
    {sources.error && <p role="alert" className="text-sm text-destructive">The list of choices could not load.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && !draft && <p role="status" className="text-sm text-primary">Saved.</p>}
    {editable && draft && <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={save} disabled={busy} data-testid="button-save-marketing">{busy ? "Saving…" : "Save"}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setError(""); setSearch(""); }}>Cancel</Button>
    </div>}
  </CardContent></Card>;
}
