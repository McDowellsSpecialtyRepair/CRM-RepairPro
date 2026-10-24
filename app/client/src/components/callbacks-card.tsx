import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneCall } from "lucide-react";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Boise" });
const select = "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

// Callbacks (as in RoadFS) on an estimate or work order: dated follow-ups with a type and an assigned person.
// Parts types keep the job off "Ready to schedule" until they are done.
export function CallbacksCard({ kind, id }: { kind: "estimates" | "jobs"; id: number }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const url = `/api/${kind}/${id}/callbacks`;
  const q = useQuery<any>({ queryKey: [url], queryFn: () => apiRequest("GET", url), enabled: can("schedule.read") });
  const types = useQuery<any[]>({ queryKey: ["/api/callback-types"], queryFn: () => apiRequest("GET", "/api/callback-types"), enabled: can("schedule.read") });
  const staff = useQuery<any[]>({ queryKey: ["/api/people/staff"], queryFn: () => apiRequest("GET", "/api/people/staff"), enabled: can("schedule.read") });
  const [form, setForm] = useState<{ typeId: string; dueDate: string; assignedStaffId: string; note: string } | null>(null);
  const [doneNote, setDoneNote] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  if (!can("schedule.read")) return null;
  const write = can("schedule.write");
  async function run(fn: () => Promise<any>) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); await qc.invalidateQueries({ queryKey: [url] }); await qc.invalidateQueries({ queryKey: ["/api/waiting-work"] }); await qc.invalidateQueries({ queryKey: ["/api/callbacks"] }); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const list = q.data?.callbacks || [];
  const open = list.filter((c: any) => c.status === "open"), done = list.filter((c: any) => c.status === "done");
  // One line when there is nothing open: "Callbacks  No open callbacks.  [Add callback]".
  return <Card data-testid="card-callbacks"><CardContent className="p-3 sm:p-3 space-y-2 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><PhoneCall className="h-4 w-4" /><h2 className="font-semibold">Callbacks</h2>
        {open.length === 0 && !form && <span className="text-muted-foreground">No open callbacks.</span>}</div>
      {write && !form && <Button size="sm" variant="outline" onClick={() => setForm({ typeId: "", dueDate: today(), assignedStaffId: "", note: "" })} data-testid="button-add-callback">Add callback</Button>}
    </div>
    {q.data?.partsOutstanding
      ? <p className="rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 text-amber-900 dark:text-amber-100" data-testid="text-parts-outstanding">Parts outstanding: this job is not ready to schedule until the parts callbacks are done.</p>
      : null}
    {form && <div className="field-row rounded-md border p-3" data-testid="callback-form">
      <label>Type<select aria-label="Callback type" className={select} value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}>
        <option value="">Choose a type</option>{(types.data || []).filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}{t.parts ? " (parts)" : ""}</option>)}</select></label>
      <label>Date<Input aria-label="Callback date" type="date" className="mt-1" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
      <label>Assigned to<select aria-label="Assigned to" className={select} value={form.assignedStaffId} onChange={e => setForm({ ...form, assignedStaffId: e.target.value })}>
        <option value="">Anyone</option>{(staff.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Note<Input aria-label="Callback note" className="mt-1" maxLength={1000} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="For example: seat foam ordered from Acme, due Friday" /></label>
      <div className="field-full flex gap-2">
        <Button size="sm" disabled={busy || !form.typeId || !form.dueDate} data-testid="button-save-callback" onClick={() => run(async () => {
          await apiRequest("POST", url, { typeId: Number(form.typeId), dueDate: form.dueDate, assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : null, note: form.note || null });
          setForm(null);
        })}>Save callback</Button>
        <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
      </div>
    </div>}
    {open.length > 0 && <ul className="divide-y rounded-md border" data-testid="callbacks-open">{open.map((c: any) => <li key={c.id} className="p-2 space-y-1" data-testid={`callback-${c.id}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <span><strong>{c.type}</strong>{c.parts && <span className="ml-1 text-xs rounded bg-amber-100 dark:bg-amber-900/40 px-1.5">parts</span>} · {c.assignedTo || "Anyone"}</span>
        <span className={c.overdue ? "text-destructive font-medium" : "text-muted-foreground"}>{c.overdue ? "Overdue · " : "Due "}{c.dueDate}</span>
      </div>
      {c.note && <p className="text-muted-foreground">{c.note}</p>}
      {c.record && <p className="text-xs text-muted-foreground">On {c.record}{c.createdBy ? ` · added by ${c.createdBy}` : ""}</p>}
      {write && <div className="flex flex-wrap items-end gap-2">
        <Input aria-label={`Done note for ${c.type}`} className="h-8 flex-1 min-w-40" placeholder={c.parts ? "For example: parts arrived, on the shelf" : "What happened (optional)"} value={doneNote[c.id] || ""} onChange={e => setDoneNote({ ...doneNote, [c.id]: e.target.value })} />
        <Button size="sm" disabled={busy} data-testid={`button-callback-done-${c.id}`} onClick={() => run(async () => {
          const r = await apiRequest("PATCH", `/api/callbacks/${c.id}`, { done: true, doneNote: doneNote[c.id] || null });
          if (r.readyToSchedule) setNotice("All parts are in. This job is now Ready to schedule.");
        })}>{c.parts ? "Mark done / parts received" : "Mark done"}</Button>
      </div>}
    </li>)}</ul>}
    {done.length > 0 && <details><summary className="cursor-pointer text-muted-foreground">Done callbacks ({done.length})</summary>
      <ul className="mt-2 space-y-1">{done.map((c: any) => <li key={c.id} className="text-xs text-muted-foreground">{c.type} · due {c.dueDate} · done {String(c.doneAt || "").slice(0, 10)}{c.doneBy ? ` by ${c.doneBy}` : ""}{c.doneNote ? ` · ${c.doneNote}` : ""}</li>)}</ul>
    </details>}
    {notice && <p role="status" className="rounded-md border border-primary/40 bg-primary/5 p-2 text-primary font-medium" data-testid="text-ready-to-schedule">{notice}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </CardContent></Card>;
}
