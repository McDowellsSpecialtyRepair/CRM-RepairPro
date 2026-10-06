import { HAIL_CARRIERS, HAIL_SOURCE, HAIL_RULES, HAIL_REFERENCE_ROWS, HAIL_RANGES, HAIL_SIZES } from "@shared/hail-reference";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function HailSourceNotice({carrier}:{carrier:string}) {
  const [open,setOpen]=useState(false);
  return <div className="rounded-md border p-3 text-sm space-y-2" data-testid="hail-source-notice">
    {carrier===HAIL_SOURCE.carrier?<><p>Carrier-hosted reference: <strong>State Farm, revision {HAIL_SOURCE.revision}</strong>. Checked {HAIL_SOURCE.checked}; confirm applicability to this claim. Not a payment guarantee.</p>
    <Button variant="outline" onClick={()=>setOpen(true)}>View saved State Farm matrix</Button>
    <div className="flex flex-col gap-2">
      <a className="text-primary underline" href={HAIL_SOURCE.url} target="_blank" rel="noopener noreferrer">Open original PDF on State Farm website</a>
      <a className="text-primary underline" href={HAIL_SOURCE.scopeUrl} target="_blank" rel="noopener noreferrer">State Farm PDR resources (alternate access)</a>
    </div>
    <p className="text-xs text-muted-foreground">If State Farm shows a 404 or blocks access, use the saved matrix above. It contains the 204 transcribed source cells and notes, not a live document or the original PDF. For a printable copy, use Print all pricing on the Pricing Matrix page.</p>
    <p className="text-xs text-muted-foreground">This document is for the State Farm PDR agreement. Use within your authorized repair workflow; do not redistribute as a public price list.</p>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-4xl w-[calc(100%-1rem)] max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Saved State Farm matrix</DialogTitle><DialogDescription>Transcribed reference, revision {HAIL_SOURCE.revision}. Checked {HAIL_SOURCE.checked}. Confirm claim applicability; not a guarantee of carrier payment.</DialogDescription></DialogHeader>
      <StateFarmReferenceTables />
    </DialogContent></Dialog>
    </>:<p><strong>Current {carrier} matrix not verified.</strong> Existing seeded tables are historical working references, not authenticated carrier instructions. Use a claim-specific document and manually agreed pricing; no rate is borrowed from another insurer.</p>}
  </div>;
}
export function HailReference({carrier}:{carrier:string}) {
  return <div className="space-y-4">
    <HailSourceNotice carrier={carrier}/>
    {carrier===HAIL_SOURCE.carrier?<StateFarmReferenceTables />:<p className="text-sm">Oversized, double-oversized, stretched/sharp, glue-pull-only, R&I and other adjustments are available in the hail estimate editor as explicit manual amounts. Upload or obtain the carrier's current matrix before treating any amount as carrier-authorized.</p>}
  </div>;
}

function StateFarmReferenceTables() {
  return <div className="space-y-4 min-w-0">
    <p className="text-xs text-muted-foreground sm:hidden">Swipe tables sideways to see all dent sizes and prices.</p>
    <details className="border rounded-md p-3" open><summary className="font-medium cursor-pointer">Carrier adjustments and exceptions</summary><dl className="mt-3 space-y-3">{HAIL_RULES.map(([name,rule])=><div key={name}><dt className="text-sm font-semibold">{name}</dt><dd className="text-sm text-muted-foreground">{rule}</dd></div>)}</dl></details>
    {Array.from(new Set(HAIL_REFERENCE_ROWS.map(r=>r.panel))).map(panel=><div key={panel} className="border rounded-md p-3"><h3 className="font-medium text-sm mb-2">{panel}</h3><div className="overflow-x-auto"><table className="w-full text-xs" data-testid="verified-hail-table"><thead><tr><th className="text-left p-2">Dents</th>{HAIL_SIZES.map(s=><th className="text-right p-2" key={s}>{s.replace("_"," ")}</th>)}</tr></thead><tbody>{HAIL_RANGES.map(([min,max])=><tr className="border-t" key={min}><td className="p-2">{min}–{max}</td>{HAIL_SIZES.map(s=>{const r=HAIL_REFERENCE_ROWS.find(r=>r.panel===panel&&r.min===min&&r.sizeCategory===s);return <td className="text-right p-2 tabular-nums" key={s}>{r?typeof r.price==="number"?`$${r.price.toFixed(2)}`:r.price:"Not published"}</td>;})}</tr>)}</tbody></table></div></div>)}
  </div>;
}
