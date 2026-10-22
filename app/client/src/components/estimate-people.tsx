import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Users, Plus, Trash2 } from "lucide-react";

// One place for the people on an estimate: up to 3 salespeople with their share of the sales credit
// (totalling 100%), the estimator and the follow-up salesperson. Saved with a single button. A work order
// keeps one salesperson (its sales credit comes from the estimate).
type Split = { staffId: number | null; percent: number };
const MAX_SALES = 3;

export function EstimatePeople({ kind, id, locked, onDirtyChange }: { kind: "estimates" | "jobs"; id: number; locked?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const url = `/api/${kind}/${id}/planning`;
  const q = useQuery<any>({ queryKey: [url], staleTime: 0, queryFn: () => apiRequest("GET", url) });
  const staff = useQuery<any[]>({ queryKey: ["/api/people/staff"], queryFn: () => apiRequest("GET", "/api/people/staff") });
  const [draft, setDraft] = useState<{ splits: Split[]; salesPersonId: number | null; estimatorId: number | null; followUpId: number | null } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const editable = can(`${kind}.write`) && !locked;
  // Unsaved people changes block Send, Approve and Convert until saved or cancelled.
  useEffect(() => { onDirtyChange?.(!!draft || busy); }, [draft, busy, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  if (q.isLoading) return null;
  if (q.error) return <p role="alert" className="text-sm text-destructive">The people on this {kind === "jobs" ? "work order" : "estimate"} could not load. {(q.error as Error).message}</p>;
  const p = q.data;
  if (!p) return null;
  const fromServer = () => ({
    splits: (p.salesTeam || []).map((r: any) => ({ staffId: r.staff_id, percent: r.share_bps / 100 })) as Split[],
    salesPersonId: p.salesPersonId ?? null, estimatorId: p.estimatorId ?? null, followUpId: p.followUpId ?? null,
  });
  const d = draft || fromServer();
  const set = (next: Partial<typeof d>) => { setDraft({ ...d, ...next }); setSaved(false); setError(""); };
  const people = staff.data || [];
  const nameOf = (sid: number | null) => people.find(s => s.id === sid)?.name;
  const select = "mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  const options = (current: number | null, taken: (number | null)[] = []) => <>
    <option value="">Not assigned</option>
    {current && !people.some(s => s.id === current) && <option value={current}>Previous staff member</option>}
    {people.filter(s => s.id === current || !taken.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
  </>;
  const total = Math.round(d.splits.reduce((n, s) => n + (s.percent || 0), 0) * 100) / 100;
  const totalOk = d.splits.length === 0 || Math.abs(total - 100) < 0.001;

  async function save() {
    if (kind === "estimates" && d.splits.some(s => !s.staffId)) { setError("Choose a person on every salesperson row, or remove the empty row."); return; }
    if (kind === "estimates" && !totalOk) { setError(`Salesperson shares must add up to 100%. They add up to ${total}% now.`); return; }
    setBusy(true); setError("");
    try {
      const body: any = { revision: p.peopleRevision, estimatorId: d.estimatorId, followUpId: d.followUpId };
      if (kind === "estimates") body.salesTeam = d.splits.map(s => ({ staffId: s.staffId, shareBps: Math.round(s.percent * 100) }));
      else body.salesPersonId = d.salesPersonId;
      const result = await apiRequest("PATCH", `/api/${kind}/${id}/people`, body);
      qc.setQueryData([url], result);
      await qc.invalidateQueries({ queryKey: ["/api/estimates", String(id), "sales-team"] });
      // A linked work order shares these people; refresh its planning box too.
      await qc.invalidateQueries({ predicate: x => typeof x.queryKey[0] === "string" && x.queryKey[0] !== url && x.queryKey[0].endsWith("/planning") });
      setDraft(null); setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function reload() { setDraft(null); setError(""); setSaved(false); await q.refetch(); }

  return <Card data-testid="card-estimate-people"><CardContent className="p-4 space-y-4">
    <div className="flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="font-semibold text-sm">People on this {kind === "jobs" ? "work order" : "estimate"}</h2></div>
    <fieldset disabled={!editable || busy} className="space-y-4">
      {kind === "estimates" ? <div className="space-y-2" data-testid="sales-team-rows">
        <p className="text-sm font-medium">Salespeople and their share of the sales credit</p>
        {d.splits.length === 0 && <p className="text-sm text-muted-foreground">No salesperson yet.</p>}
        {d.splits.map((s, i) => <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="text-sm flex-1 min-w-48">Salesperson {i + 1}
            <select aria-label={`Salesperson ${i + 1}`} className={select} value={s.staffId ?? ""}
              onChange={e => set({ splits: d.splits.map((r, j) => j === i ? { ...r, staffId: e.target.value ? Number(e.target.value) : null } : r) })}>
              {options(s.staffId, d.splits.filter((_, j) => j !== i).map(r => r.staffId))}
            </select></label>
          <label className="text-sm w-28">Share %
            <NumberInput aria-label={`Salesperson ${i + 1} share percent`} className="mt-1 h-11" value={s.percent}
              onValueChange={n => set({ splits: d.splits.map((r, j) => j === i ? { ...r, percent: n } : r) })} /></label>
          <Button type="button" variant="ghost" className="h-11" aria-label={`Remove salesperson ${i + 1}`}
            onClick={() => { const rest = d.splits.filter((_, j) => j !== i); set({ splits: rest.length === 1 ? [{ ...rest[0], percent: 100 }] : rest }); }}><Trash2 className="h-4 w-4" /></Button>
        </div>)}
        <div className="flex flex-wrap items-center gap-3">
          {d.splits.length < MAX_SALES && <Button type="button" variant="outline" size="sm" data-testid="button-add-salesperson"
            onClick={() => set({ splits: [...d.splits, { staffId: null, percent: d.splits.length ? Math.max(0, 100 - total) : 100 }] })}><Plus className="h-4 w-4 mr-1" /> Add salesperson</Button>}
          {d.splits.length > 0 && <span className={`text-sm ${totalOk ? "text-muted-foreground" : "text-destructive font-medium"}`} data-testid="sales-share-total">
            Total: {total}%{totalOk ? "" : " (must be 100%)"}</span>}
        </div>
        <p className="text-xs text-muted-foreground">Up to {MAX_SALES} salespeople. The shares split the sales credit (before tax) and must add up to 100%. The person with the largest share is the lead salesperson. This is sales attribution for commission reports, not a payroll calculation.</p>
      </div> : <label className="text-sm block sm:max-w-sm">Salesperson
        <select aria-label="Salesperson" className={select} value={d.salesPersonId ?? ""} onChange={e => set({ salesPersonId: e.target.value ? Number(e.target.value) : null })}>{options(d.salesPersonId)}</select></label>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Estimator
          <select aria-label="Estimator" className={select} value={d.estimatorId ?? ""} onChange={e => set({ estimatorId: e.target.value ? Number(e.target.value) : null })}>{options(d.estimatorId)}</select></label>
        <label className="text-sm">Follow-up salesperson
          <select aria-label="Follow-up salesperson" className={select} value={d.followUpId ?? ""} onChange={e => set({ followUpId: e.target.value ? Number(e.target.value) : null })}>{options(d.followUpId)}</select></label>
      </div>
    </fieldset>
    <p className="text-xs text-muted-foreground">Choices are active staff with the Owner, Administrator, Manager or Service advisor role (service writers use Service advisor). Add people under Staff access.{!draft && d.splits.length > 0 && nameOf(p.salesPersonId) ? ` Lead salesperson: ${nameOf(p.salesPersonId)}.` : ""}</p>
    {staff.error && <p role="alert" className="text-sm text-destructive">Staff choices could not load. Reload before changing people.</p>}
    {error && <div role="alert" className="text-sm text-destructive space-y-2"><p>{error}</p>
      {/someone else changed/i.test(error) && <Button type="button" size="sm" variant="outline" onClick={reload}>Reload people (discard my changes)</Button>}</div>}
    {saved && !draft && <p role="status" className="text-sm text-primary">People saved.</p>}
    {editable && draft && <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={save} disabled={busy} data-testid="button-save-people">{busy ? "Saving…" : "Save people"}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setError(""); }} data-testid="button-cancel-people">Cancel</Button>
    </div>}
  </CardContent></Card>;
}
