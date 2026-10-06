import {useState,useEffect} from "react";
import {useQuery} from "@tanstack/react-query";
import {apiRequest,queryClient} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {TAX_GUIDE,purchaseTotals} from "@shared/estimate-rules";
import {useAuth} from "@/components/auth-provider";
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
function TeamEditor({id,data,staff,locked,onDirtyChange}:any){
  const [splits,setSplits]=useState<any[]>(data.rows.map((r:any)=>({staffId:r.staff_id,percent:String(r.share_bps/100)})));
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  const original=data.rows.map((r:any)=>({staffId:r.staff_id,percent:String(r.share_bps/100)}));
  const dirty=JSON.stringify(splits)!==JSON.stringify(original);
  useEffect(()=>{onDirtyChange?.(dirty||busy);},[dirty,busy,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
  return <fieldset disabled={locked||busy} className="space-y-3">
    {splits.map((s,i)=><div key={i} className="flex flex-wrap gap-2">
      <select aria-label={`Salesperson ${i+1}`} className="border rounded bg-background h-10 px-2 flex-1 min-w-40" value={s.staffId} onChange={e=>{setSplits(splits.map((r,j)=>i===j?{...r,staffId:Number(e.target.value)}:r));setSaved(false);}}><option value="0">Choose salesperson</option>{staff.map((r:any)=><option value={r.id} key={r.id}>{r.name}</option>)}</select>
      <Input aria-label={`Sales share ${i+1}`} className="w-24" type="number" min=".01" max="100" step=".01" value={s.percent} onChange={e=>{setSplits(splits.map((r,j)=>j===i?{...r,percent:e.target.value}:r));setSaved(false);}}/><span>%</span>
      <Button variant="ghost" onClick={()=>{setSplits(splits.filter((_,j)=>i!==j));setSaved(false);}}>Remove salesperson</Button>
    </div>)}
    <p className="text-xs">Assigned: {splits.reduce((n,s)=>n+Number(s.percent||0),0).toFixed(2)}%. Shares must total 100%, or leave the team unassigned.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setSplits([...splits,{staffId:0,percent:splits.length?"":"100"}]);setSaved(false);}}>Add salesperson</Button>
    <Button onClick={async()=>{setBusy(true);setError("");try{await apiRequest("PUT",`/api/estimates/${id}/sales-team`,{version:data.version,splits:splits.map(s=>({staffId:s.staffId,shareBps:Math.round(Number(s.percent)*100)}))});await queryClient.invalidateQueries({queryKey:["/api/estimates",String(id)]});setSaved(true);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Save sales team</Button></div>
    {dirty&&<Button variant="ghost" onClick={()=>{setSplits(original);setError("");}}>Cancel sales changes</Button>}
    {saved&&<p role="status">Sales team saved.</p>}{error&&<p role="alert" className="text-destructive">{error}</p>}
  </fieldset>;
}
export function EstimateCommercial({estimate,onDirtyChange}:any){
  const {can}=useAuth();
  const id=String(estimate.id),locked=estimate.status==="invoiced"||!can("estimates.write");
  const team=useQuery({queryKey:["/api/estimates",id,"sales-team"],queryFn:()=>apiRequest("GET",`/api/estimates/${id}/sales-team`)});
  const staff=useQuery({queryKey:["/api/estimate-sales/staff"],queryFn:()=>apiRequest("GET","/api/estimate-sales/staff")});
  const lines=estimate.lineItems||[],cost=lines.reduce((n:number,l:any)=>n+purchaseTotals(l).costCents,0)/100;
  const useTax=lines.reduce((n:number,l:any)=>n+purchaseTotals(l).useTaxCents,0)/100;
  return <div className="border rounded-lg p-4 space-y-4">
    <h2 className="font-semibold">Material costs, use tax & sales team</h2>
    <p className="text-sm">Purchase costs are internal estimates, not customer prices. Use tax on shop-consumed purchases is internal and is never added to the customer's sales tax.</p>
    {can("costs.read")?<div className="flex flex-wrap gap-4 text-sm"><span>Estimated purchase cost: <strong>{money(cost)}</strong></span><span>Estimated use tax: <strong>{money(useTax)}</strong></span></div>:<p className="text-sm">Internal purchase costs and use tax require cost-management access.</p>}
    <p className="text-xs text-muted-foreground">Use Add materials or Add freight below. For tax owed on shop-consumed purchases, choose Shop-consumed supplies and enter the purchase cost, rate and tax note. Confirm applicability with your accountant. <a href={TAX_GUIDE} target="_blank" rel="noopener noreferrer" className="underline">Idaho tax guidance</a></p>
    <h3 className="font-medium">Multiple salespeople</h3><p className="text-xs text-muted-foreground">Sales credit splits the net invoice sales before customer tax. These are attribution amounts, not commission pay. The lead salesperson in planning remains separate.</p>
    {(team.isError||staff.isError)&&<p role="alert">Sales team could not load. Reopen the estimate to retry.</p>}
    {team.data&&staff.data&&<TeamEditor key={`${id}-${team.data.version}`} id={id} data={team.data} staff={staff.data} locked={locked} onDirtyChange={onDirtyChange}/>}
  </div>;
}
export function InvoiceCommercial({id}:any){
  const {can}=useAuth();
  const data=useQuery({queryKey:["/api/invoices",String(id),"commercial"],queryFn:()=>apiRequest("GET",`/api/invoices/${id}/commercial`)});
  return <div className="border rounded-lg p-4 space-y-3"><h2 className="font-semibold">Internal cost & sales attribution snapshot</h2>
    <p className="text-xs">Locked at invoice issue. Estimated costs and use tax are not vendor bills, customer charges or filed taxes.</p>
    {data.isError&&<p role="alert">Could not load the commercial snapshot.</p>}
    {data.data?.sales.map((s:any)=><p key={s.staff_id} className="text-sm">{s.staff_name}: {s.share_bps/100}% · {money(s.net_sales_cents/100)} net sales credit</p>)}
    {data.data?.sales.length===0&&<p className="text-sm">No sales team was assigned at issue.</p>}
    {can("costs.read")&&data.data?.costs?.filter((c:any)=>c.estimatedCost||c.useTax).map((c:any,i:number)=><p key={i} className="text-sm">{c.description}: cost {money(c.estimatedCost)} · use tax {money(c.useTax)}</p>)}
  </div>;
}
export function CommercialReport(){
  const {can}=useAuth();
  const data=useQuery({queryKey:["/api/reports/commercial"],queryFn:()=>apiRequest("GET","/api/reports/commercial")});
  return <div className="border rounded-lg p-4 space-y-3"><h2 className="font-semibold">Invoiced costs, use tax & salesperson credit</h2>
    <p className="text-sm">{data.data?.basis}</p>{data.isError&&<p role="alert">Commercial report unavailable for this account.</p>}
    {can("costs.read")&&<><p className="text-sm">Estimated purchase costs: {money((data.data?.costs||[]).reduce((n:number,c:any)=>n+Math.round(c.estimated_cost*100),0)/100)} · Estimated use tax: {money((data.data?.costs||[]).reduce((n:number,c:any)=>n+Math.round(c.use_tax*100),0)/100)}</p>
    <details><summary className="cursor-pointer">Cost and use-tax details</summary>{data.data?.costs?.map((c:any,i:number)=><p key={i} className="text-sm border-t py-2">{c.invoice_number} · {c.description} · cost {money(c.estimated_cost)} · use tax {money(c.use_tax)}</p>)}</details></>}
    <details><summary className="cursor-pointer">Salesperson credit details</summary>{data.data?.sales.map((s:any,i:number)=><p key={i} className="text-sm border-t py-2">{s.invoice_number} · {s.staff_name} · {s.share_bps/100}% · {money(s.net_sales_cents/100)}</p>)}</details>
  </div>;
}
