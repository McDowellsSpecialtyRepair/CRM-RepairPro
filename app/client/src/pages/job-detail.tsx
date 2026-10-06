import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { WorkPlanning } from "@/components/work-planning";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERVICE_LABELS } from "@/lib/services";
import { useState } from "react";

const cash = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const { can } = useAuth(), qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const quotes = useQuery<any[]>({ queryKey: ["/api/estimates"], enabled: can("estimates.read") });
  const q = useQuery<any>({ queryKey: ["/api/jobs", id, "detail"], staleTime: 0, refetchOnWindowFocus: true, queryFn: () => apiRequest("GET", `/api/jobs/${id}/detail`) });
  const create = useMutation({ mutationFn: () => apiRequest("POST", `/api/jobs/${id}/estimate`), onSuccess: async (e: any) => { await qc.invalidateQueries(); navigate(`/estimates/${e.id}`); } });
  const link = useMutation({ mutationFn: () => apiRequest("POST", `/api/jobs/${id}/link-estimate`, { estimateId: Number(selected) }), onSuccess: async () => { setSelected(""); await qc.invalidateQueries(); } });
  if (q.isLoading) return <p role="status">Loading work order…</p>;
  if (q.error || !q.data) return <div className="space-y-3"><Link href="/jobs" className="underline">Back to work orders</Link><p role="alert">{q.error?.message || "Work order not found."}</p><Button onClick={() => q.refetch()}>Retry</Button></div>;
  const j = q.data, c = j.customer;
  const candidates = (quotes.data || []).filter(e => !e.jobId && !e.invoiceId && ["draft","sent","approved"].includes(e.status) && e.customerId === j.customerId && e.serviceType === j.serviceType && e.vehicleId === j.vehicleId && e.assetId === j.assetId);
  const item = j.vehicle ? [j.vehicle.year,j.vehicle.make,j.vehicle.model].filter(Boolean).join(" ") : j.asset?.name || "No item attached";
  return <div className="space-y-5">
    <Link href="/jobs" className="text-sm underline">Back to work orders</Link>
    <header className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-muted-foreground">{j.jobNumber}</p><h1 className="text-xl font-bold break-words">{j.title}</h1><p className="text-sm mt-2">{SERVICE_LABELS[j.serviceType] || j.serviceType} · {item}</p>{j.vehicle?.vin && <p className="text-xs mt-1">VIN: {j.vehicle.vin}</p>}</div><Badge variant="secondary" className="self-start">{j.status.replaceAll("_", " ")}</Badge></header>
    <Card><CardContent className="p-5 flex flex-wrap gap-4 justify-between"><div><h2 className="text-xs text-muted-foreground">Customer</h2><Link href={`/customers/${j.customerId}`} className="font-medium underline">{c?.companyName || [c?.firstName,c?.lastName].filter(Boolean).join(" ") || `Customer ${j.customerId}`}</Link><p className="text-sm mt-1">{[c?.phone,c?.email].filter(Boolean).join(" · ")}</p></div><div className="flex flex-wrap gap-4 items-center">{j.vehicleId && <Link className="text-sm underline" href={`/vehicles/${j.vehicleId}`}>Vehicle & service history</Link>}{j.production && can("operations.read") && <Link className="text-sm underline" href={`/operations/${j.production}`}>Production tasks & labor progress</Link>}</div></CardContent></Card>
    <WorkPlanning key={id} kind="jobs" id={id} />
    <section className="space-y-3"><h2 className="font-semibold">Estimated repair scope</h2>
      {j.estimates.length === 0 && candidates.length > 0 && can("estimates.write") && can("jobs.write") && !["completed","cancelled"].includes(j.status) && <Card><CardContent className="p-5 space-y-3">
        <label className="block text-sm">Link a matching existing estimate<select aria-label="Link a matching existing estimate" className="mt-1 block h-10 w-full rounded-md border bg-background px-3" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose an estimate</option>{candidates.map(e => <option key={e.id} value={e.id}>{e.estimateNumber} · {e.status}</option>)}</select></label>
        <p className="text-xs text-muted-foreground">Only unlinked estimates matching this customer, service and repair item are offered. Linking an approved estimate returns it to draft for review. The work order's planning will be used; estimate amounts and labor splits stay unchanged.</p>
        <Button disabled={!selected || link.isPending} onClick={() => link.mutate()}>Link selected estimate</Button>{link.error && <p role="alert" className="text-sm text-destructive">{link.error.message}</p>}
      </CardContent></Card>}
      {j.estimates.length === 0 && <Card><CardContent className="p-5 space-y-3"><p className="text-sm">No estimate is linked to this work order. Estimates are not matched automatically by customer or VIN.</p>{can("estimates.write") && can("jobs.write") && !["completed","cancelled"].includes(j.status) && <Button disabled={create.isPending} onClick={() => create.mutate()}>Create linked estimate</Button>}{create.error && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}</CardContent></Card>}
      {j.estimates.map((e: any) => <Card key={e.id}><CardContent className="p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div>{can("estimates.read") ? <Link href={`/estimates/${e.id}`} className="font-semibold underline">{e.estimateNumber} · Open estimate</Link> : <h3 className="font-semibold">{e.estimateNumber}</h3>}<p className="text-xs mt-1">{e.status} {e.status === "invoiced" ? "· Financial details locked after invoicing" : ""}</p></div>{e.total !== undefined && <p className="font-semibold">{cash(e.total)}</p>}</div>
        {e.notes && <p className="text-sm whitespace-pre-wrap">{e.notes}</p>}
        {!e.lineItems.length && <p className="text-sm text-muted-foreground">No line items added yet.</p>}
        <ul className="divide-y">{e.lineItems.map((l: any) => <li key={l.id} className="py-3 flex justify-between gap-4 text-sm"><div className="min-w-0"><p className="break-words">{l.description}</p><p className="text-xs text-muted-foreground mt-1">{l.lineType} · {l.quantity} {l.unit}{l.panelLocation ? ` · ${l.panelLocation}` : ""}</p></div>{l.total !== undefined && <span className="shrink-0">{cash(l.total)}</span>}</li>)}</ul>
      </CardContent></Card>)}
    </section>
    {j.invoices.length > 0 && <section className="space-y-3"><h2 className="font-semibold">Linked invoices</h2>{j.invoices.map((i: any) => <Link key={i.id} href={`/invoices/${i.id}`} className="block rounded-md border p-4 hover:bg-muted/40"><span className="font-medium underline">{i.invoiceNumber}</span><span className="text-sm ml-3">{i.status} · {cash(i.total)}</span></Link>)}</section>}
  </div>;
}
