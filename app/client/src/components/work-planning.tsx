import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function WorkPlanning({ kind, id }: { kind: "jobs" | "estimates"; id: number }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const url = `/api/${kind}/${id}/planning`;
  const q = useQuery<any>({ queryKey: [url], staleTime: 0, refetchOnWindowFocus: true, queryFn: () => apiRequest("GET", url) });
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  // A planned date before the estimate was created needs a deliberate confirmation (it is then recorded).
  const [earlyWarning, setEarlyWarning] = useState(""), [earlyConfirmed, setEarlyConfirmed] = useState(false);
  const techs = useQuery<any[]>({ queryKey: ["/api/technicians"], enabled: can("schedule.read") });
    const p = draft || q.data;
  const editable = can(`${kind}.write`) && can("schedule.write") && (!q.data?.jobId || can("jobs.write"));
  function change(key: string, value: any) { setDraft({ ...p, [key]: value }); setSaved(false); if (key === "scheduledDate") { setEarlyWarning(""); setEarlyConfirmed(false); } }
  async function save(e?: React.FormEvent, confirmEarlyDate = false) {
    e?.preventDefault(); setBusy(true); setError("");
    try {
      // The salesperson is changed under "People" at the top, so it is not sent from here.
      const payload: any = Object.fromEntries(["revision", "scheduledDate", "assignedTechId", "priority", ...(p.jobId ? ["title", "description", "status"] : [])].map(k => [k, p[k]]));
      if (confirmEarlyDate) payload.confirmEarlyDate = true;
      const result = await apiRequest("PATCH", url, payload);
      qc.setQueryData([url], result); setDraft(null); setSaved(true); setEarlyWarning(""); setEarlyConfirmed(false);
      await qc.invalidateQueries();
    } catch (e: any) {
      if (/is before this estimate was created/.test(e.message)) setEarlyWarning(e.message); else setError(e.message);
    }
    finally { setBusy(false); }
  }
  if (q.isLoading) return <Card><CardContent className="p-5" role="status">Loading work planning…</CardContent></Card>;
  if (q.error) return <Card><CardContent className="p-5"><p role="alert">{q.error.message}</p><Button onClick={() => q.refetch()}>Retry planning</Button></CardContent></Card>;
  if (!p) return null;
  const selectClass = "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <Card><CardContent className="p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h2 className="font-semibold">Work planning & assignments</h2><p className="text-xs text-muted-foreground mt-1">Planned date and lead technician do not reserve calendar time or change payroll labor splits.</p></div>
      {kind === "estimates" && p.jobId && <Link href={`/jobs/${p.jobId}`} className="text-sm underline">Open linked work order</Link>}
    </div>
    {kind === "estimates" && p.jobId && <p className="text-sm">These fields are shared with the linked work order. Changes here also appear there.</p>}
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={!editable || busy} className="space-y-4">
        {kind === "jobs" && <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Repair title<Input aria-label="Repair title" className="mt-1" maxLength={250} required value={p.title || ""} onChange={e => change("title", e.target.value)} /></label>
          <label className="text-sm">Work order status<select aria-label="Work order status" className={selectClass} value={p.status} onChange={e => change("status", e.target.value)}>{["pending","scheduled","in_progress","completed","cancelled"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Repair description / instructions<Textarea aria-label="Repair description" className="mt-1 min-h-24" maxLength={10000} value={p.description || ""} onChange={e => change("description", e.target.value || null)} /></label>
        </div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Planned schedule date<Input aria-label="Planned schedule date" type="date" className="mt-1 [color-scheme:light] dark:[color-scheme:dark]" value={p.scheduledDate || ""} onChange={e => change("scheduledDate", e.target.value || null)} /></label>
          <label className="text-sm">Lead technician<select aria-label="Lead technician" className={selectClass} value={p.assignedTechId ?? ""} onChange={e => change("assignedTechId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Unassigned</option>
            {(techs.data || []).filter(t => t.status === "active" || t.id === p.assignedTechId).map(t => <option key={t.id} value={t.id}>{t.name}{t.status !== "active" ? " (inactive)" : ""}</option>)}
          </select>{!p.assignedTechId && p.assignedTech && <span className="text-xs">Legacy assignment: {p.assignedTech}</span>}</label>
          <div className="text-sm">Salesperson<p className="mt-1 h-10 flex items-center rounded-md border border-dashed px-3 text-muted-foreground" data-testid="planning-salesperson">{p.salesPerson || "Not assigned"}</p><span className="text-xs text-muted-foreground">Change it under "People" at the top.</span></div>
          <label className="text-sm">Repair urgency<select aria-label="Repair urgency" className={selectClass} value={p.priority} onChange={e => change("priority", e.target.value)}>{["low","normal","high","urgent"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
        </div>
      </fieldset>
      {techs.error && <p role="alert" className="text-sm text-destructive">Staff choices could not load. Reload before changing assignments.</p>}
      {p.slots.length > 0 && <BookedAppointments slots={p.slots} techs={techs.data || []} canMove={can("schedule.write")} onMoved={async () => { await qc.invalidateQueries(); }} />}
      {earlyWarning && <div role="alertdialog" aria-labelledby="early-date-title" className="rounded-md border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2" data-testid="early-date-warning">
        <p id="early-date-title" className="font-semibold">Check the planned date</p>
        <p>{earlyWarning}</p>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={earlyConfirmed} onChange={e => setEarlyConfirmed(e.target.checked)} data-testid="checkbox-confirm-early-date" />
          <span>Yes, I know this date is before the estimate was created. The work really started on this date, and I want to use it to keep the schedule record accurate.</span></label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!earlyConfirmed || busy} onClick={() => save(undefined, true)} data-testid="button-save-early-date">Save with this date</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setEarlyWarning(""); setEarlyConfirmed(false); }}>Go back and change the date</Button>
        </div>
      </div>}
      {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" className="mt-2" disabled={busy} onClick={async () => { const fresh = await q.refetch(); if (!fresh.error) { setDraft(null); setError(""); setSaved(false); } }}>Reload latest record (discard edits)</Button></div>}
      {saved && <p role="status" className="text-sm text-primary">Planning changes saved.</p>}
      <div className="flex flex-wrap gap-3 items-center">
        {editable ? <><Button type="submit" disabled={busy || !draft}>{busy ? "Saving…" : "Save planning changes"}</Button><Button type="button" variant="outline" disabled={busy || !draft} onClick={() => { setDraft(null); setError(""); setSaved(false); }}>Discard edits</Button></> : <p className="text-sm text-muted-foreground">Read-only for your role.</p>}
        {can("schedule.read") && <Link className="text-sm underline" href="/scheduling">Open Scheduling</Link>}
      </div>
    </form>
  </CardContent></Card>;
}

// The booked calendar appointments for this work, each with "Move" (new day, time or technician in one step;
// checked like a new booking, and nothing changes if the new time isn't free).
function BookedAppointments({ slots, techs, canMove, onMoved }: { slots: any[]; techs: any[]; canMove: boolean; onMoved: () => Promise<void> }) {
  const [moving, setMoving] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const name = (id: number) => techs.find(t => t.id === id)?.name || "Technician";
  async function save() {
    setBusy(true); setError(""); setDone("");
    try {
      await apiRequest("POST", `/api/capacity/reschedule/${moving.id}`, { technicianId: Number(moving.technicianId), date: moving.date, startTime: moving.startTime, endTime: moving.endTime, retryKey: crypto.randomUUID(), ...(moving.partsOverride ? { partsOverride: true } : {}) });
      setDone(`Moved to ${moving.date} ${moving.startTime}–${moving.endTime} with ${name(Number(moving.technicianId))}.`); setMoving(null); await onMoved();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="rounded-md border p-3 text-sm space-y-2" data-testid="booked-appointments">
    <p className="font-medium">Booked on the calendar</p>
    {slots.map((s: any) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
      <span>{s.date} · {s.startTime}–{s.endTime} · {name(s.technicianId)} · {s.status.replaceAll("_", " ")}</span>
      {canMove && !moving && <Button type="button" size="sm" variant="outline" onClick={() => { setError(""); setDone(""); setMoving({ ...s, technicianId: String(s.technicianId) }); }} data-testid={`button-move-slot-${s.id}`}>Move</Button>}
    </div>)}
    {moving && <div className="grid gap-2 sm:grid-cols-4 rounded-md border p-2" data-testid="move-slot-form">
      <label>Day<Input aria-label="New day" type="date" className="mt-1" value={moving.date} onChange={e => setMoving({ ...moving, date: e.target.value })} /></label>
      <label>Start<Input aria-label="New start time" type="time" className="mt-1" value={moving.startTime} onChange={e => setMoving({ ...moving, startTime: e.target.value })} /></label>
      <label>End<Input aria-label="New end time" type="time" className="mt-1" value={moving.endTime} onChange={e => setMoving({ ...moving, endTime: e.target.value })} /></label>
      <label>Technician<select aria-label="New technician" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-2" value={moving.technicianId} onChange={e => setMoving({ ...moving, technicianId: e.target.value })}>
        {techs.filter(t => t.status !== "inactive").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {/Parts for this job are still outstanding/.test(error) && <label className="sm:col-span-4 flex items-center gap-2"><input type="checkbox" checked={!!moving.partsOverride} onChange={e => setMoving({ ...moving, partsOverride: e.target.checked })} /> Book anyway: I'm sure the parts will be here in time</label>}
      <div className="sm:col-span-4 flex gap-2"><Button type="button" size="sm" disabled={busy} onClick={save} data-testid="button-save-move">{busy ? "Moving…" : "Move appointment"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMoving(null)}>Cancel</Button></div>
    </div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {done && <p role="status" className="text-primary">{done}</p>}
    {!canMove && <p className="text-muted-foreground">Ask a scheduler to move it.</p>}
  </div>;
}
