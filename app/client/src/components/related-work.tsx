import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
export function RelatedWork({ customerId, vehicleId, estimates = false }: { customerId?: number; vehicleId?: number; estimates?: boolean }) {
  const { can } = useAuth();
  const jobs = useQuery<any[]>({ queryKey: ["/api/jobs"], staleTime: 0, refetchOnWindowFocus: true, enabled: can("jobs.read") });
  const quotes = useQuery<any[]>({ queryKey: ["/api/estimates"], staleTime: 0, refetchOnWindowFocus: true, enabled: estimates && can("estimates.read") });
  const match = (r: any) => vehicleId ? r.vehicleId === vehicleId : r.customerId === customerId;
  return <Card><CardContent className="p-5 space-y-3"><h2 className="font-semibold">Work orders{estimates ? " & estimates" : ""}</h2>
    {jobs.error && <p role="alert" className="text-sm">{jobs.error.message}</p>}
    {(jobs.data || []).filter(match).map(j => <Link key={j.id} href={`/jobs/${j.id}`} className="block rounded-md border p-3 hover:bg-muted/40"><span className="text-sm font-medium underline">{j.jobNumber} · {j.title}</span><p className="text-xs text-muted-foreground mt-1">{j.status.replaceAll("_", " ")} · {j.priority} · {j.assignedTech || "Unassigned"} · {j.scheduledDate || "Date not planned"}</p></Link>)}
    {jobs.data && !jobs.data.some(match) && <p className="text-sm text-muted-foreground">No work orders linked to this {vehicleId ? "vehicle" : "customer"}.</p>}
    {estimates && (quotes.data || []).filter(match).map(e => <Link key={e.id} href={`/estimates/${e.id}`} className="block text-sm underline border rounded-md p-3">{e.estimateNumber} · {e.status} · Open estimate</Link>)}
  </CardContent></Card>;
}
