import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Referral thank-you list: everyone who referred a customer, from the estimates' "heard about us" answers.
export function ReferralThanks() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState<"to_thank" | "thanked">("to_thank");
  const q = useQuery<any[]>({ queryKey: ["/api/referrals"], queryFn: () => apiRequest("GET", "/api/referrals") });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState("");
  const rows = (q.data || []).filter(r => r.status === show);
  const waiting = (q.data || []).filter(r => r.status === "to_thank").length;
  async function mark(id: number, thanked: boolean) {
    setBusy(id); setError("");
    try { await apiRequest("PATCH", `/api/referrals/${id}`, { thanked, note: thanked ? notes[id] || null : null }); await qc.invalidateQueries({ queryKey: ["/api/referrals"] }); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  return <Card data-testid="card-referral-thanks">
    <CardHeader className="pb-3"><CardTitle className="text-base">Referral thank-you list</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p className="text-muted-foreground">People who referred a customer, taken from "How did the customer hear about us?" on each estimate.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={show === "to_thank" ? "default" : "outline"} onClick={() => setShow("to_thank")} data-testid="button-referrals-to-thank">To thank ({waiting})</Button>
        <Button size="sm" variant={show === "thanked" ? "default" : "outline"} onClick={() => setShow("thanked")} data-testid="button-referrals-thanked">Already thanked</Button>
      </div>
      {q.error && <p role="alert" className="text-destructive">The referral list could not load. {(q.error as Error).message}</p>}
      {q.data && rows.length === 0 && <p className="text-muted-foreground py-4">{show === "to_thank" ? "Nobody is waiting for a thank-you." : "No thank-yous recorded yet."}</p>}
      <ul className="divide-y rounded-md border">{rows.map(r => <li key={r.estimateId} className="p-3 space-y-2" data-testid={`referral-row-${r.estimateNumber}`}>
        <div className="flex flex-wrap justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium break-words">{r.referrerCustomerId ? <Link className="underline" href={`/customers/${r.referrerCustomerId}`}>{r.referrerName}</Link> : r.referrerName}</p>
            <p className="text-xs text-muted-foreground break-words">{[r.referrerPhone, r.referrerEmail, r.referrerAddress].filter(Boolean).join(" · ") || "No contact details on file"}</p>
          </div>
          <p className="text-xs text-right">Referred <Link className="underline" href={`/customers/${r.referredCustomerId}`}>{r.referredCustomer}</Link><br /><Link className="underline" href={`/estimates/${r.estimateId}`}>{r.estimateNumber}</Link> · {r.estimateDate}</p>
        </div>
        {r.note && <p className="text-xs">Note: {r.note}</p>}
        {r.status === "thanked" ? <div className="flex flex-wrap items-center gap-2 text-xs"><span>Thanked {String(r.thankedAt || "").slice(0, 10)}{r.thankedBy ? ` by ${r.thankedBy}` : ""}{r.thankedNote ? ` · ${r.thankedNote}` : ""}</span>
          {can("referrals.manage") && <Button size="sm" variant="ghost" disabled={busy === r.estimateId} onClick={() => mark(r.estimateId, false)}>Move back to "To thank"</Button>}</div>
        : can("referrals.manage") && <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs flex-1 min-w-48">How we thanked them (optional)<Input aria-label={`How we thanked ${r.referrerName}`} className="mt-1 h-9" maxLength={500} value={notes[r.estimateId] || ""} onChange={e => setNotes({ ...notes, [r.estimateId]: e.target.value })} placeholder="For example: card and $25 gift card mailed" /></label>
          <Button size="sm" disabled={busy === r.estimateId} onClick={() => mark(r.estimateId, true)} data-testid={`button-mark-thanked-${r.estimateNumber}`}>Mark thanked</Button>
        </div>}
      </li>)}</ul>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}

// The marketing tags on every estimate, in four groups. Turning a tag off keeps it on older estimates.
const TAG_GROUPS = ["How they found us", "Referred by", "How the estimate came in", "Customer"];
export function MarketingSourcesManager() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: ["/api/marketing-sources"], queryFn: () => apiRequest("GET", "/api/marketing-sources") });
  const [draft, setDraft] = useState<{ id?: number; name: string; needsReferrer: boolean; group: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const manage = can("marketing.write");
  async function save(id: number | undefined, body: any) {
    setBusy(true); setError("");
    try { await apiRequest(id ? "PATCH" : "POST", id ? `/api/marketing-sources/${id}` : "/api/marketing-sources", body); await qc.invalidateQueries({ queryKey: ["/api/marketing-sources"] }); setDraft(null); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const select = "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <Card data-testid="card-marketing-sources">
    <CardHeader className="pb-3"><CardTitle className="text-base">Marketing tags</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p className="text-muted-foreground">These tags appear on every estimate, in four groups; staff tap all that apply. Tags marked "asks who referred them" also record the referrer and add them to the thank-you list. Turning a tag off keeps it on older estimates.</p>
      {q.error && <p role="alert" className="text-destructive">The tags could not load.</p>}
      {TAG_GROUPS.map(g => {
        const tags = (q.data || []).filter(s => (s.group || TAG_GROUPS[0]) === g);
        return <div key={g}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g} ({tags.filter(t => t.active).length})</p>
          <ul className="divide-y rounded-md border">{tags.map(s => <li key={s.id} className="p-2 flex flex-wrap items-center justify-between gap-2" data-testid={`marketing-source-${s.name}`}>
            <span className={s.active ? "" : "text-muted-foreground line-through"}>{s.name}{s.needsReferrer && <span className="ml-2 text-xs rounded bg-muted px-2 py-0.5">asks who referred them</span>}{!s.active && <span className="ml-2 text-xs no-underline">(turned off)</span>}</span>
            {manage && <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setDraft({ id: s.id, name: s.name, needsReferrer: s.needsReferrer, group: s.group || TAG_GROUPS[0] }); setError(""); }}>Edit</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(s.id, { active: !s.active })}>{s.active ? "Turn off" : "Turn on"}</Button>
            </span>}
          </li>)}{!tags.length && <li className="p-2 text-muted-foreground">No tags in this group.</li>}</ul>
        </div>;
      })}
      {manage && !draft && <Button size="sm" variant="outline" onClick={() => { setDraft({ name: "", needsReferrer: false, group: TAG_GROUPS[0] }); setError(""); }} data-testid="button-new-marketing-source">Add a tag</Button>}
      {manage && draft && <div className="rounded-md border p-3 space-y-2" data-testid="marketing-source-form">
        <label className="block">Tag name<Input aria-label="Choice name" className="mt-1" maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="For example: KBOI radio" /></label>
        <label className="block">Group<select aria-label="Tag group" className={select} value={draft.group} onChange={e => setDraft({ ...draft, group: e.target.value })}>{TAG_GROUPS.map(g => <option key={g}>{g}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.needsReferrer} onChange={e => setDraft({ ...draft, needsReferrer: e.target.checked })} aria-label="Asks who referred them" /> Ask who referred them (adds them to the thank-you list)</label>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !draft.name.trim()} onClick={() => save(draft.id, { name: draft.name, needsReferrer: draft.needsReferrer, group: draft.group })} data-testid="button-save-marketing-source">{busy ? "Saving…" : "Save tag"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      </div>}
      {!manage && <p className="text-muted-foreground">Only staff who manage marketing can change these tags.</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
