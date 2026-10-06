import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
export function AssignedWorkScope({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const q = useQuery<any>({ queryKey: ["/api/my-work", id, "scope"], queryFn: () => apiRequest("GET", `/api/my-work/${id}/scope`), enabled: open });
  return <div><Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close work details" : "Open work details & estimated scope"}</Button>
    {open && <div className="mt-3 rounded-md border p-3 space-y-3 text-sm">
      {q.isLoading && <p role="status">Loading assigned work…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data && <><p>Urgency: {q.data.priority}</p><p className="whitespace-pre-wrap">{q.data.description || "No additional instructions."}</p><h3 className="font-semibold">Estimated scope</h3>
        {!q.data.lines.length && <p>No linked estimate lines yet.</p>}
        {q.data.lines.map((l: any, i: number) => <p key={i}>{l.estimateNumber} ({l.status}) · {l.description} · {l.quantity} {l.unit}{l.panelLocation ? ` · ${l.panelLocation}` : ""}</p>)}
        <h3 className="font-semibold">Repair notes</h3>{q.data.notes.map((n: any, i: number) => <p key={i}>{n.description} · {n.author}</p>)}
      </>}
    </div>}
  </div>;
}
