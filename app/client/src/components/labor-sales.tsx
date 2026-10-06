import { useState,useEffect,useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {nonLaborCategory} from "@shared/estimate-rules";
const money = (c: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100);
const select = "h-11 rounded-md border bg-background px-2 text-sm min-w-0";

function LaborEditor({line,techs,estimateId,disabled,onDirtyChange}: any) {
  const [type,setType] = useState(line.lineType);
  const [splits,setSplits] = useState<any[]>(line.allocations.map((a:any) => ({technicianId:a.technician_id,percent:String(a.share_bps/100)})));
  const [error,setError] = useState(""), [busy,setBusy] = useState(false), [saved,setSaved] = useState(false);
  const original=line.allocations.map((a:any)=>({technicianId:a.technician_id,percent:String(a.share_bps/100)}));
  const dirty=type!==line.lineType||JSON.stringify(splits)!==JSON.stringify(original);
  useEffect(()=>{onDirtyChange?.(line.id,dirty||busy);},[line.id,dirty,busy,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(line.id,false),[line.id,onDirtyChange]);
  return <fieldset disabled={disabled || busy} className="rounded-lg border p-4 space-y-3">
    <div className="flex flex-wrap gap-3 justify-between items-center"><div><p className="font-medium text-sm">{line.description}</p><p className="text-sm text-muted-foreground">{money(Math.round(line.total*100))} before discount</p></div>
      <select aria-label={`Type for ${line.description}`} className={select} value={type} onChange={e => {setType(e.target.value);setSaved(false);if(e.target.value==="parts")setSplits([]);}}>
        <option value="legacy" disabled>Needs classification</option><option value="parts" disabled={line.serviceCategory==="fabrication"}>Non-labor: materials / freight / supplies</option><option value="labor" disabled={nonLaborCategory(line.serviceCategory)}>Labor</option>
      </select></div>
    {type==="labor" && <div className="space-y-2">{splits.map((s,i) => <div key={i} className="flex flex-wrap gap-2 items-center">
      <select aria-label={`Technician ${i+1} for ${line.description}`} className={`${select} flex-1 min-w-36`} value={s.technicianId} onChange={e => {setSplits(splits.map((a,j)=>j===i?{...a,technicianId:Number(e.target.value)}:a));setSaved(false);}}><option value="0">Choose technician</option>{techs.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <Input aria-label={`Percent ${i+1} for ${line.description}`} type="number" min=".01" max="100" step=".01" className="w-24 h-11" value={s.percent} onChange={e=>{setSplits(splits.map((a,j)=>j===i?{...a,percent:e.target.value}:a));setSaved(false);}}/><span>%</span>
      <Button variant="ghost" onClick={()=>{setSplits(splits.filter((_,j)=>j!==i));setSaved(false);}}>Remove</Button>
    </div>)}<Button variant="outline" onClick={()=>{setSplits([...splits,{technicianId:0,percent:splits.length?"":"100"}]);setSaved(false);}}>Add technician</Button><p className="text-xs text-muted-foreground">Assigned: {splits.reduce((s,a)=>s+Number(a.percent || 0),0).toFixed(2)}%. Labor must total 100% before invoicing.</p></div>}
    {!disabled && <Button size="sm" disabled={type==="legacy"} onClick={async()=>{setBusy(true);setError("");try{
      await apiRequest("PATCH",`/api/estimates/line-items/${line.id}/classification`,{expectedVersion:line.allocationVersion,lineType:type,splits:type==="labor"?splits.map(s=>({technicianId:s.technicianId,shareBps:Math.round(Number(s.percent)*100)})):[]});
      await queryClient.invalidateQueries({queryKey:["/api/estimates"]});setSaved(true);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?"Saving…":"Save classification & split"}</Button>}
    {dirty&&<Button variant="ghost" onClick={()=>{setType(line.lineType);setSplits(original);setError("");}}>Cancel technician changes</Button>}
    {saved && <p role="status" className="text-xs">Saved. Reapprove the estimate before invoicing.</p>}{error && <p role="alert" className="text-destructive text-sm">{error}</p>}
  </fieldset>;
}
export function EstimateLabor({id,locked,onDirtyChange}: {id:string;locked:boolean;onDirtyChange?:(dirty:boolean)=>void}) {
  const {can} = useAuth();
  const data=useQuery<any[]>({queryKey:["/api/estimates",id,"labor"],queryFn:()=>apiRequest("GET",`/api/estimates/${id}/labor`)});
  const techs=useQuery<any[]>({queryKey:["/api/technicians"]});
  const [dirtyLines,setDirtyLines]=useState<Record<number,boolean>>({});
  const setLineDirty=useCallback((lineId:number,dirty:boolean)=>setDirtyLines(prev=>prev[lineId]===dirty?prev:{...prev,[lineId]:dirty}),[]);
  const dirty=Object.values(dirtyLines).some(Boolean);
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  return <Card><CardContent className="pt-5 space-y-4"><h2 className="font-semibold">Labor & multiple technicians</h2><p className="text-sm text-muted-foreground">Split each labor line among the technicians who produced it. Labor credit excludes materials, freight, supplies and customer tax. Category determines sales tax: repair labor is separate from taxable new fabrication. Lead technician in planning does not allocate labor sales automatically.</p>
    {(data.error||techs.error) && <p role="alert">Could not load labor assignments. Try reopening this estimate.</p>}
    {data.data?.some(l=>l.lineType==="legacy") && <p className="text-sm text-amber-700 dark:text-amber-400">Existing lines require classification before this estimate can be reapproved or invoiced. Previously issued invoices remain unchanged.</p>}
    {data.data?.filter(l=>l.lineType!=="parts").map(l=><LaborEditor key={`${l.id}-${l.allocationVersion}`} line={l} techs={(techs.data||[]).filter(t=>t.status==="active")} estimateId={id} disabled={locked||!can("estimates.write")} onDirtyChange={setLineDirty}/>)}
    {!!data.data?.length&&data.data.every(l=>l.lineType==="parts")&&<p className="text-sm">These are non-labor charges. Add a repair-labor line to assign technicians.</p>}
    {data.data?.length===0 && <p className="text-sm">Add line items to classify and allocate their labor.</p>}
  </CardContent></Card>;
}
export function InvoiceLabor({id,lines}: any) {
  const data=useQuery<any[]>({queryKey:["/api/invoices",String(id),"labor"],queryFn:()=>apiRequest("GET",`/api/invoices/${id}/labor`)});
  return <Card><CardContent className="pt-5 space-y-3"><h2 className="font-semibold">Invoice labor credit</h2><p className="text-sm text-muted-foreground">Locked at issue. Each amount is this technician’s share of labor after discount, excluding parts and tax.</p>
    {lines.some((l:any)=>l.lineType==="legacy") && <p className="text-sm text-amber-700 dark:text-amber-400">Legacy invoice: original totals retained. No technician credits have been invented for unclassified lines.</p>}
    {data.isError && <p role="alert">Unable to load labor credits.</p>}
    {(data.data||[]).map(r=><div key={r.id} className="border-t pt-2 text-sm flex flex-wrap justify-between gap-2"><span>{r.technician_name} · {r.description} · {r.share_bps/100}%</span><strong>{money(r.net_labor_cents)}</strong></div>)}
    {data.data?.length===0 && <p className="text-sm text-muted-foreground">No recorded labor credits on this invoice.</p>}
  </CardContent></Card>;
}
export function DeliveryStatus({type,id}: {type:"estimate"|"invoice";id:string}) {
  const {can} = useAuth();
  const [notice,setNotice] = useState(""),[busy,setBusy] = useState(false);
  const data=useQuery<any>({queryKey:["/api/delivery",type,id],queryFn:()=>apiRequest("GET",`/api/delivery/${type}/${id}`)});
  return <Card><CardContent className="pt-5 space-y-3"><h2 className="font-semibold">Delivery status</h2>
    <p className="text-sm">Test email is restricted to <strong>service@mcdowellsrepair.com</strong>. Issued or approved does not mean delivered.</p>
    <div className="flex flex-wrap gap-2"><span className="text-sm border rounded px-3 py-2">Email: {data.data?.emailConfigured?"configured":"not configured"}</span><Button variant="outline" disabled>Text / SMS: not connected</Button><Button variant="outline" disabled>WhatsApp: setup paused</Button></div>
    <p className="text-xs text-muted-foreground">No automatic text or WhatsApp messages will be attempted. Setup can resume after your social media team restores access.</p>
    {type==="invoice" && can("billing.write") && data.data && !data.data.emailConfigured && <Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await apiRequest("POST",`/api/invoices/${id}/email`,{});setNotice(r.message);await data.refetch();}catch(e:any){setNotice(e.message);}finally{setBusy(false);}}}>{busy?"Preparing…":"Prepare test email (not sent)"}</Button>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {data.isError && <p role="alert">Could not load delivery history.</p>}
    {data.data?.attempts.map((a:any)=><div key={a.id} className="text-sm border-t pt-2"><p>{a.channel} · {a.state.replace(/_/g," ")} · {a.recipient}</p><p className="text-xs text-muted-foreground">{a.detail} {new Date(a.created_at).toLocaleString()}</p></div>)}
    {data.data?.attempts.length===0 && <p className="text-sm text-muted-foreground">No provider delivery record exists. Do not assume this document has been sent.</p>}
  </CardContent></Card>;
}
export default function TechnicianLaborReport() {
  const [from,setFrom]=useState(""),[to,setTo]=useState("");
  const data=useQuery<any>({queryKey:["/api/reports/technician-labor",from,to],queryFn:()=>apiRequest("GET",`/api/reports/technician-labor?${new URLSearchParams({...(from?{from}:{}),...(to?{to}:{})})}`)});
  const groups = new Map<number,{name:string;total:number;invoices:Set<number>}>();
  for(const r of data.data?.rows||[]){const g=groups.get(r.technician_id)||{name:r.technician_name,total:0,invoices:new Set<number>()};g.total+=r.net_labor_cents;g.invoices.add(r.invoice_id);groups.set(r.technician_id,g);}
  return <div className="space-y-4"><h1 className="text-xl font-bold">Technician labor sales</h1><p className="text-sm text-muted-foreground">Accumulate invoiced labor production for compensation review. These are sales credits, not calculated paychecks; commission rates are not configured.</p>
    <div className="flex flex-wrap gap-3"><label className="text-sm">Invoice date from<Input aria-label="Invoice date from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">Through<Input aria-label="Invoice date through" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    {data.isError && <p role="alert" className="text-destructive">Could not load report. Check the date range.</p>}{data.isLoading && <p>Loading labor credits…</p>}
    <p className="text-sm">{data.data?.basis}</p>{data.data?.legacyInvoices>0 && <p className="text-sm text-amber-700 dark:text-amber-400">{data.data.legacyInvoices} legacy invoices contain unclassified sales and are not included in technician credits. Review separately before payroll.</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from(groups).map(([id,g])=><Card key={id}><CardContent className="pt-4"><h2 className="font-semibold">{g.name}</h2><p className="text-xl font-bold mt-2">{money(g.total)}</p><p className="text-sm text-muted-foreground">{g.invoices.size} invoices with credited labor</p></CardContent></Card>)}</div>
    {data.data?.rows.length===0 && <p>No issued labor credits in this date range. Allocate labor in an estimate, approve it and create an invoice to begin.</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Technician</th><th className="p-2">Invoice / date</th><th className="p-2">Labor</th><th className="p-2">Share</th><th className="p-2 text-right">Net credit</th></tr></thead><tbody>{data.data?.rows.map((r:any,i:number)=><tr key={i} className="border-b"><td className="p-2">{r.technician_name}</td><td className="p-2"><Link className="underline" href={`/invoices/${r.invoice_id}`}>{r.invoice_number}</Link><div className="text-xs">{r.issue_date}</div></td><td className="p-2">{r.description}</td><td className="p-2">{r.share_bps/100}%</td><td className="p-2 text-right">{money(r.net_labor_cents)}</td></tr>)}</tbody></table></div>
  </div>;
}
