import {useState,useEffect} from "react";
import {useQuery} from "@tanstack/react-query";
import {apiRequest,queryClient} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {TAX_GUIDE,purchaseTotals} from "@shared/estimate-rules";
import {useAuth} from "@/components/auth-provider";
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export function EstimateCommercial({estimate}:any){
  const {can}=useAuth();
  const lines=estimate.lineItems||[],cost=lines.reduce((n:number,l:any)=>n+purchaseTotals(l).costCents,0)/100;
  const useTax=lines.reduce((n:number,l:any)=>n+purchaseTotals(l).useTaxCents,0)/100;
  // Salespeople and their shares are set once, under "People on this estimate" at the top.
  return <div className="border rounded-lg p-4 space-y-4">
    <h2 className="font-semibold">Material costs & use tax</h2>
    <p className="text-sm">Purchase costs are internal estimates, not customer prices. Use tax on shop-consumed purchases is internal and is never added to the customer's sales tax.</p>
    {can("costs.read")?<div className="flex flex-wrap gap-4 text-sm"><span>Estimated purchase cost: <strong>{money(cost)}</strong></span><span>Estimated use tax: <strong>{money(useTax)}</strong></span></div>:<p className="text-sm">Internal purchase costs and use tax require cost-management access.</p>}
    <p className="text-xs text-muted-foreground">Use Add materials or Add freight below. For tax owed on shop-consumed purchases, choose Shop-consumed supplies and enter the purchase cost, rate and tax note. Confirm applicability with your accountant. <a href={TAX_GUIDE} target="_blank" rel="noopener noreferrer" className="underline">Idaho tax guidance</a></p>
    <p className="text-xs text-muted-foreground">Salespeople and their shares are set under "People on this estimate" at the top.</p>
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
