import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Boise", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Who changed what, and when, on this customer, estimate or work order (from the permanent audit log, which
// records the staff login for every change). Opened on request so the page stays short.
export function ChangeHistory({ kind, id }: { kind: "customers" | "estimates" | "jobs"; id: number }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const url = `/api/history/${kind}/${id}`;
  const q = useQuery<any[]>({ queryKey: [url], enabled: open, staleTime: 0, queryFn: () => apiRequest("GET", url) });
  if (!can("history.read")) return null;
  const label = kind === "customers" ? "customer" : kind === "jobs" ? "work order" : "estimate";
  return <Card data-testid="card-change-history"><CardContent className="p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><History className="h-4 w-4" /><h2 className="font-semibold text-sm">Change history</h2></div>
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)} data-testid="button-toggle-history">{open ? "Hide" : "Show who changed what"}</Button>
    </div>
    {open && <>
      <p className="text-xs text-muted-foreground">Every change to this {label} is recorded with the staff login that made it and can't be edited or deleted. Newest first.</p>
      {q.isLoading && <p role="status" className="text-sm">Loading…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">The change history could not load. {(q.error as Error).message}</p>}
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
      <ol className="divide-y rounded-md border text-sm" data-testid="history-entries">{(q.data || []).map(e => <li key={e.id} className="p-3 space-y-1">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-medium">{e.what}</span>
          <span className="text-xs text-muted-foreground">{when(e.at)}</span>
        </div>
        <p className="text-xs">By <strong>{e.by}</strong>{e.login ? ` (${e.login})` : ""}</p>
        {e.changes.length > 0 && <ul className="text-xs space-y-0.5">{e.changes.map((c: any, i: number) => <li key={i} className="break-words">
          <span className="text-muted-foreground">{c.field}:</span> {c.from ? <><span className="line-through decoration-muted-foreground/60">{c.from}</span> → </> : ""}<span>{c.to}</span>
        </li>)}</ul>}
      </li>)}</ol>
    </>}
  </CardContent></Card>;
}
