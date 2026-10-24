import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATES: Record<string, { label: string; help: string }> = {
  ready: { label: "Ready to schedule", help: "Sold and nothing outstanding. Book these on the calendar." },
  waiting_parts: { label: "Waiting on parts", help: "Parts to order, being researched or on the way. They move to Ready to schedule when the last parts callback is done." },
  waiting_other: { label: "Waiting on customer / other", help: "Open callbacks such as waiting for the customer to choose a date or insurance approval." },
};
const select = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

// Sold work that is not on the calendar yet, and everyone's callbacks (RoadFS-style follow-up lists).
export default function WaitingList() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"waiting" | "callbacks">("waiting");
  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold">Waiting list and callbacks</h1>
      <p className="text-sm text-muted-foreground">Sold estimates and work orders that are not booked yet, and the follow-up lists. Nothing here books calendar time.</p></div>
    <div className="flex flex-wrap gap-2">
      <Button variant={tab === "waiting" ? "default" : "outline"} onClick={() => setTab("waiting")} data-testid="tab-waiting">Waiting to schedule</Button>
      <Button variant={tab === "callbacks" ? "default" : "outline"} onClick={() => setTab("callbacks")} data-testid="tab-callbacks">Callbacks</Button>
    </div>
    {tab === "waiting" ? <Waiting /> : <CallbackLists />}
    {can("callbacks.manage") && <CallbackTypes />}
  </div>;
}

function Waiting() {
  const q = useQuery<any[]>({ queryKey: ["/api/waiting-work"], queryFn: () => apiRequest("GET", "/api/waiting-work") });
  if (q.isLoading) return <p role="status">Loading…</p>;
  if (q.error) return <p role="alert" className="text-destructive">The waiting list could not load. {(q.error as Error).message}</p>;
  return <div className="space-y-5">{Object.entries(STATES).map(([state, s]) => {
    const rows = (q.data || []).filter(r => r.state === state);
    return <section key={state} className="space-y-2" data-testid={`waiting-${state}`}>
      <h2 className="font-semibold">{s.label} ({rows.length})</h2>
      <p className="text-xs text-muted-foreground">{s.help}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{rows.map(r => <Card key={`${r.kind}-${r.id}`} data-testid={`waiting-row-${r.number}`}><CardContent className="p-3 text-sm space-y-1">
        <div className="flex justify-between gap-2"><Link href={`/${r.kind}/${r.id}`} className="font-semibold underline">{r.number}</Link><span className="text-xs text-muted-foreground">{r.daysWaiting != null ? `waiting ${r.daysWaiting} day${r.daysWaiting === 1 ? "" : "s"}` : ""}</span></div>
        <p className="font-medium">{r.details?.customer}</p>
        <p>{r.details?.service}{r.details?.item ? ` · ${r.details.item}` : ""}</p>
        {r.details?.phone && <p><a className="underline" href={`tel:${String(r.details.phone).replace(/[^0-9+]/g, "")}`}>{r.details.phone}</a></p>}
        {r.details?.work?.length > 0 && <p className="text-muted-foreground">{r.details.work.slice(0, 3).join("; ")}{r.details.work.length > 3 || r.details.moreWork ? " …" : ""}</p>}
        {r.partsArrivedAt && state === "ready" && <p className="text-primary font-medium" data-testid="text-parts-arrived">All parts in since {String(r.partsArrivedAt).slice(0, 10)}</p>}
        {r.callbacks.map((c: any) => <p key={c.id} className={c.overdue ? "text-destructive" : "text-muted-foreground"}>• {c.type}{c.assignedTo ? ` (${c.assignedTo})` : ""} · {c.overdue ? "overdue " : "due "}{c.dueDate}{c.note ? ` · ${c.note}` : ""}</p>)}
      </CardContent></Card>)}</div>
    </section>;
  })}</div>;
}

function CallbackLists() {
  const types = useQuery<any[]>({ queryKey: ["/api/callback-types"], queryFn: () => apiRequest("GET", "/api/callback-types") });
  const staff = useQuery<any[]>({ queryKey: ["/api/people/staff"], queryFn: () => apiRequest("GET", "/api/people/staff") });
  const [typeId, setTypeId] = useState(""), [assigned, setAssigned] = useState("me"), [due, setDue] = useState("");
  const params = new URLSearchParams({ ...(typeId ? { typeId } : {}), ...(assigned ? { assigned } : {}), ...(due ? { due } : {}) }).toString();
  const q = useQuery<any[]>({ queryKey: ["/api/callbacks", params], queryFn: () => apiRequest("GET", `/api/callbacks?${params}`) });
  return <div className="space-y-3">
    <div className="field-row">
      <label className="text-sm">Type<select aria-label="Filter by callback type" className={select} value={typeId} onChange={e => setTypeId(e.target.value)}>
        <option value="">All types</option>{(types.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="text-sm">Person<select aria-label="Filter by person" className={select} value={assigned} onChange={e => setAssigned(e.target.value)}>
        <option value="me">My callbacks</option><option value="">Everyone</option><option value="none">Not assigned</option>{(staff.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm">When<select aria-label="Filter by due date" className={select} value={due} onChange={e => setDue(e.target.value)}>
        <option value="">Any date</option><option value="today">Due today or overdue</option><option value="overdue">Overdue only</option></select></label>
    </div>
    {q.error && <p role="alert" className="text-destructive">The callbacks could not load.</p>}
    {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">No open callbacks match.</p>}
    <ul className="divide-y rounded-md border text-sm" data-testid="callback-list">{(q.data || []).map(c => <li key={c.id} className="p-3 flex flex-wrap justify-between gap-2">
      <div className="min-w-0"><p><strong>{c.type}</strong> · <Link className="underline" href={`/${c.recordKind}/${c.recordId}`}>{c.record}</Link> · {c.customer}</p>
        <p className="text-muted-foreground">{[c.service, c.item, c.phone].filter(Boolean).join(" · ")}{c.note ? ` · ${c.note}` : ""}</p></div>
      <div className="text-right"><p className={c.overdue ? "text-destructive font-medium" : ""}>{c.overdue ? "Overdue " : "Due "}{c.dueDate}</p><p className="text-xs text-muted-foreground">{c.assignedTo || "Anyone"}</p></div>
    </li>)}</ul>
  </div>;
}

function CallbackTypes() {
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: ["/api/callback-types"], queryFn: () => apiRequest("GET", "/api/callback-types") });
  const [draft, setDraft] = useState<{ id?: number; name: string; parts: boolean } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(id: number | undefined, body: any) {
    setBusy(true); setError("");
    try { await apiRequest(id ? "PATCH" : "POST", id ? `/api/callback-types/${id}` : "/api/callback-types", body); await qc.invalidateQueries({ queryKey: ["/api/callback-types"] }); setDraft(null); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <Card data-testid="card-callback-types"><CardHeader className="pb-3"><CardTitle className="text-base">Callback types</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p className="text-muted-foreground">The list of callback types (from RoadFS). Instead of a type per person, assign each callback to someone. "Parts" types keep a job off Ready to schedule until they are done.</p>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-3 rounded-md border px-2">{(q.data || []).map(t => <li key={t.id} className="py-0.5 flex items-center justify-between gap-2 border-b">
        <span className={t.active ? "" : "line-through text-muted-foreground"}>{t.name}{t.parts && <span className="ml-2 text-xs rounded bg-muted px-2">parts</span>}</span>
        <span className="flex gap-1"><Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDraft({ id: t.id, name: t.name, parts: t.parts })}>Edit</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => save(t.id, { active: !t.active })}>{t.active ? "Turn off" : "Turn on"}</Button></span>
      </li>)}</ul>
      {!draft && <Button size="sm" variant="outline" onClick={() => setDraft({ name: "", parts: false })} data-testid="button-new-callback-type">Add a callback type</Button>}
      {draft && <div className="rounded-md border p-3 space-y-2">
        <label className="block">Name<Input aria-label="Callback type name" className="mt-1" maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.parts} onChange={e => setDraft({ ...draft, parts: e.target.checked })} /> Parts (job is not ready to schedule until done)</label>
        <div className="flex gap-2"><Button size="sm" disabled={busy || !draft.name.trim()} onClick={() => save(draft.id, { name: draft.name, parts: draft.parts })}>Save</Button><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
      </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </CardContent></Card>;
}
