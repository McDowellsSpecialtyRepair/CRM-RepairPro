import {useQuery} from "@tanstack/react-query";
import {apiRequest} from "@/lib/queryClient";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Link} from "wouter";
import {localToday} from "@shared/operations";
import {CommercialReport} from "@/components/estimate-commercial";
import {useAuth} from "@/components/auth-provider";
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const cents=(n:any)=>Math.round(Number(n||0)*100);
export default function Accounting(){
  const {can}=useAuth();
  const invoices=useQuery<any[]>({queryKey:["/api/invoices"],queryFn:()=>apiRequest("GET","/api/invoices")});
  const payments=useQuery<any[]>({queryKey:["/api/payments"],queryFn:()=>apiRequest("GET","/api/payments")});
  if(invoices.isError||payments.isError)return <p role="alert">Accounting data could not be loaded. Do not treat this as a zero balance.</p>;
  if(invoices.isLoading||payments.isLoading)return <p>Loading recorded financial data…</p>;
  const issued=(invoices.data||[]).filter(i=>!["draft","void"].includes(i.status));
  const collected=(payments.data||[]).reduce((n,p)=>n+cents(p.amount),0);
  const paid=new Map<number,number>();
  (payments.data||[]).forEach(p=>paid.set(p.invoiceId,(paid.get(p.invoiceId)||0)+cents(p.amount)));
  const aging:Record<string,number>={"Current":0,"1–30 days":0,"31–60 days":0,"61–90 days":0,"91+ days":0,"No due date":0};
  for(const i of issued){const balance=cents(i.total)-(paid.get(i.id)||0);if(balance<=0)continue;
    const days=(Date.parse(localToday())-Date.parse(i.dueDate))/86400000;
    const bucket=!i.dueDate||!Number.isFinite(days)?"No due date":days<=0?"Current":days<=30?"1–30 days":days<=60?"31–60 days":days<=90?"61–90 days":"91+ days";aging[bucket]+=balance;
  }
  const ar=Object.values(aging).reduce((a,b)=>a+b,0);
  const sales=issued.reduce((n,i)=>n+cents(i.subtotal)-cents(i.discount),0);
  return <div className="space-y-6">
    {can("reports.read")&&<CommercialReport/>}
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-xl font-bold">Accounting & QuickBooks</h1><p className="text-sm text-muted-foreground">Recorded CRM transactions, not bank-reconciled financial statements.</p></div><Button disabled data-testid="button-run-sync">Desktop sync not configured</Button></div>
    <div className="rounded-md border border-amber-600/40 bg-amber-500/5 p-4 text-sm" role="status"><strong>QuickBooks Desktop Enterprise is not connected.</strong><p>No records are being transmitted. Any older simulated sync IDs or success logs are unverified and must be reconciled before the first real transfer.</p></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Net billed sales",money(sales/100)],["Recorded collections",money(collected/100)],["Outstanding issued A/R",money(ar/100)],["Issued invoices",String(issued.length)],
    ].map(([title,value])=><Card key={title}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="text-lg font-bold tabular-nums">{value}</p></CardContent></Card>)}</div>
    <p className="text-xs text-muted-foreground">All dates. Sales exclude tax; collections include tax and are recorded payments, not bank settlement. Draft and void invoices are excluded from sales and A/R. Aging as of {localToday()}.</p>
    <Tabs defaultValue="sync"><TabsList className="flex-wrap h-auto"><TabsTrigger value="sync" data-testid="tab-sync">QB handoff</TabsTrigger><TabsTrigger value="ledger" data-testid="tab-ledger">General ledger</TabsTrigger><TabsTrigger value="reports" data-testid="tab-reports">Financial reports</TabsTrigger></TabsList>
      <TabsContent value="sync"><Card><CardHeader><CardTitle className="text-base">Desktop integration prerequisites</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>A verified Desktop bridge, company-file approval, customer and item mappings, tax mappings, invoice acknowledgments, linked payments and retry reconciliation are required before enabling sync.</p><p>Prepared transaction data is not a QuickBooks receipt. Technician labor credits are sales attribution, not payroll entries.</p></CardContent></Card></TabsContent>
      <TabsContent value="ledger"><Card><CardHeader><CardTitle className="text-base">General ledger unavailable</CardTitle></CardHeader><CardContent className="text-sm"><p>RepairPro does not yet maintain a complete double-entry general ledger, opening balances, accounts payable, payroll liabilities or bank reconciliation. Use your reconciled QuickBooks Desktop company file for the general ledger and financial statements.</p></CardContent></Card></TabsContent>
      <TabsContent value="reports"><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Current A/R aging</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><tbody>{Object.entries(aging).map(([k,v])=><tr key={k} className="border-b"><th className="text-left py-2 font-medium">{k}</th><td className="text-right tabular-nums">{money(v/100)}</td></tr>)}<tr><th className="text-left py-2">Total</th><td className="text-right font-bold">{money(ar/100)}</td></tr></tbody></table></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Sales and collections reporting</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Report Studio provides date filters, customer and service groupings, previous-period comparisons and calculations. It does not produce a verified profit-and-loss statement.</p><Link href="/reports" className="underline">Open Report Studio</Link><p>Use Operations for reviewed direct contribution. It excludes overhead and is not net income.</p></CardContent></Card></div></TabsContent>
    </Tabs>
  </div>;
}
