import {documentBreakdown} from "@shared/estimate-rules";
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
export function DocumentBreakdown({lines,subtotal}:{lines:any[];subtotal:number}){
  const result=documentBreakdown(lines,subtotal);
  return <div data-testid="document-breakdown" className="space-y-2">
    {result.rows.map(r=><div key={r.key} className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground min-w-0">{r.label}</span>
      <span className="tabular-nums whitespace-nowrap shrink-0">{money(r.cents)}</span>
    </div>)}
    {result.needsReview&&<p role="note" className="text-xs rounded border p-3">{result.note}</p>}
  </div>;
}
