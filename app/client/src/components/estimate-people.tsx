import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

// Salesperson, Estimator and Follow-up salesperson on an estimate or work order. The percentage split of
// sales credit stays in the sales team further down; this only names who sold, estimated and follows up.
const FIELDS = [
  ["salesPersonId", "Salesperson", "salesPerson"],
  ["estimatorId", "Estimator", "estimator"],
  ["followUpId", "Follow-up salesperson", "followUp"],
] as const;

export function EstimatePeople({ kind, id, locked }: { kind: "estimates" | "jobs"; id: number; locked?: boolean }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const url = `/api/${kind}/${id}/planning`;
  const q = useQuery<any>({ queryKey: [url], staleTime: 0, queryFn: () => apiRequest("GET", url) });
  const staff = useQuery<any[]>({ queryKey: ["/api/people/staff"], queryFn: () => apiRequest("GET", "/api/people/staff") });
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const editable = can(`${kind}.write`) && !locked;
  const p = draft || q.data;
  if (q.isLoading) return null;
  if (q.error) return <p role="alert" className="text-sm text-destructive">The people on this estimate could not load. {(q.error as Error).message}</p>;
  if (!p) return null;
  const select = "mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  async function save() {
    setBusy(true); setError("");
    try {
      const result = await apiRequest("PATCH", `/api/${kind}/${id}/people`, { revision: p.revision, salesPersonId: p.salesPersonId ?? null, estimatorId: p.estimatorId ?? null, followUpId: p.followUpId ?? null });
      qc.setQueryData([url], result); setDraft(null); setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <Card data-testid="card-estimate-people"><CardContent className="p-4 space-y-3">
    <div className="flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="font-semibold text-sm">People on this {kind === "jobs" ? "work order" : "estimate"}</h2></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {FIELDS.map(([key, label, nameKey]) => <label key={key} className="text-sm">{label}
        <select aria-label={label} className={select} disabled={!editable || busy} value={p[key] ?? ""}
          onChange={e => { setDraft({ ...p, [key]: e.target.value ? Number(e.target.value) : null }); setSaved(false); }}>
          <option value="">Not assigned</option>
          {p[key] && !staff.data?.some(s => s.id === p[key]) && <option value={p[key]}>{p[nameKey] || "Previous staff member"}</option>}
          {(staff.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>)}
    </div>
    <p className="text-xs text-muted-foreground">Choices are active staff with the Owner, Administrator, Manager or Service advisor role (service writers use Service advisor). Add people under Staff access. How sales credit is split by percentage is set in the sales team, further down.</p>
    {staff.error && <p role="alert" className="text-sm text-destructive">Staff choices could not load. Reload before changing people.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && !draft && <p role="status" className="text-sm text-primary">People saved.</p>}
    {editable && draft && <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={save} disabled={busy} data-testid="button-save-people">{busy ? "Saving…" : "Save people"}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setError(""); }}>Cancel</Button>
    </div>}
  </CardContent></Card>;
}
