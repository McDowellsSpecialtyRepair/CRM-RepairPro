import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {VehicleSplat, type VehicleType} from "./vehicle-splat";
import {HailSourceNotice} from "./hail-reference";
import {HAIL_CARRIERS,HAIL_SIZES,HAIL_SOURCE,HAIL_UPCHARGES,HAIL_EXTRAS,priceHailPanel,savedHailCarriers,type HailDraft,type HailExtra} from "@shared/hail-reference";

const PANELS:Record<string,[string,string]>={
  hood:["Hood","Hood"],roof:["Roof","Roof"],"cab-roof":["Cab roof","Roof"],trunk:["Trunk lid","Deck Lid"],"trunk-lid":["Trunk lid","Deck Lid"],
  liftgate:["Liftgate (confirm matrix mapping)",""],tailgate:["Tailgate (confirm matrix mapping)",""],
  "lf-fender":["Left front fender","Fender"],"rf-fender":["Right front fender","Fender"],
  "lf-door":["Left front door","Door"],"rf-door":["Right front door","Door"],"lr-door":["Left rear door","Door"],"rr-door":["Right rear door","Door"],
  "lr-quarter":["Left quarter","Quarter"],"rr-quarter":["Right quarter","Quarter"],
  "bed-side-l":["Left bed side (confirm matrix mapping)",""],"bed-side-r":["Right bed side (confirm matrix mapping)",""],
  "left-rail":["Left roof rail","Roof Rail"],"right-rail":["Right roof rail","Roof Rail"],
  "left-corner":["Left cab corner","Cab Corner"],"right-corner":["Right cab corner","Cab Corner"],cowl:["Cowl","Cowl, Other"],other:["Other panel (manual)",""],
};
const fresh=(id="hood"):HailDraft=>({panelId:id,panelName:PANELS[id]?.[0]||id,matrixPanel:PANELS[id]?.[1]||"",count:1,size:"nickel",upcharge:"none",baseOverride:null,note:"",extras:{}});
const control="w-full h-11 rounded-md border bg-background px-3 text-sm";
const currency=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export function HailEstimator({estimate,vehicle,onAdd}:{estimate:any;vehicle?:any;onAdd:(items:any[],carrier?:string)=>Promise<void>}) {
  const priorCarriers=savedHailCarriers(estimate.lineItems||[]);
  const [chosenCarrier,setCarrier]=useState(priorCarriers[0]||"State Farm"),[draft,setDraft]=useState<HailDraft>(fresh());
  const carrier=priorCarriers[0]||chosenCarrier;
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [body,setBody]=useState<VehicleType>(vehicle?.vehicleType==="truck"?"pickup":/suv|sport utility|mpv/i.test(vehicle?.bodyClass||"")?"suv":"sedan");
  const [marked,setMarked]=useState(false);
  const result=priceHailPanel(carrier,draft),patch=(p:Partial<HailDraft>)=>{setDraft(d=>({...d,...p}));setMarked(true);setMessage("");};
  if(priorCarriers.length>1)result.errors.push("This estimate contains mixed carrier-tagged lines. Reconcile or remove them before adding more carrier work.");
  const existing=(estimate.lineItems||[]).filter((l:any)=>l.panelLocation===draft.panelName);
  const choose=(id:string,name?:string)=>{
    if(marked && !window.confirm("Discard unsaved panel entries and switch panels?"))return;
    setDraft({...fresh(id),...(!PANELS[id]?{panelName:name||id}:{})});setMarked(false);setMessage("");setError("");
  };
  return <Card data-testid="card-damage-map"><CardHeader><CardTitle className="text-base">Carrier hail estimate</CardTitle><p className="text-sm text-muted-foreground">Build and save one panel at a time. Base work and adjustments become separate labor lines, with the source revision retained.</p></CardHeader><CardContent className="space-y-4">
    <label className="block text-sm">Insurance company<select className={control} aria-label="Hail insurance company" disabled={priorCarriers.length>0} value={carrier} onChange={e=>{if(marked&&!window.confirm("Discard unsaved entries and change carrier?"))return;setCarrier(e.target.value);setDraft(fresh(draft.panelId));setMarked(false);setMessage("");}}>{HAIL_CARRIERS.map(c=><option key={c}>{c}</option>)}</select></label>
    {priorCarriers.length>0&&<p className="text-xs text-muted-foreground">Carrier is locked to the saved hail lines. To correct the carrier, remove those draft lines first or start a separate estimate; existing work is never repriced silently.</p>}
    <HailSourceNotice carrier={carrier}/>
    <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">Choose panel on vehicle diagram</summary><label className="text-sm block my-2">Body style<select aria-label="Hail body style" className={control} value={body} onChange={e=>setBody(e.target.value as VehicleType)}><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="pickup">Pickup</option></select></label><VehicleSplat vehicleType={body} view="exterior" damages={[]} selectedPanel={draft.panelId} onPanelClick={choose}/></details>
    <label className="block text-sm">Panel<select className={control} aria-label="Hail panel" value={draft.panelId} onChange={e=>choose(e.target.value)}>{Object.entries(PANELS).map(([id,[name]])=><option key={id} value={id}>{name}</option>)}{!PANELS[draft.panelId]&&<option value={draft.panelId}>{draft.panelName}</option>}</select></label>
    {!draft.matrixPanel&&<p role="status" className="text-sm">No verified automatic mapping for this panel. Enter a documented manual amount; do not substitute a different panel without claim approval.</p>}
    {existing.length>0&&<p className="text-sm rounded-md border p-3">This estimate already has {existing.length} line(s) for {draft.panelName}. Review existing charges to avoid duplicate billing. Added amounts are additional, not replacements.</p>}
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">Regular dent count<input className={control} type="number" min="0" max="9999" step="1" aria-label="Regular dent count" value={draft.count} onChange={e=>patch({count:e.target.value===""?0:Number(e.target.value)})}/></label>
      <label className="text-sm">Majority regular dent size<select className={control} aria-label="Hail dent size" value={draft.size} onChange={e=>patch({size:e.target.value})}>{HAIL_SIZES.map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></label>
      <label className="text-sm">Panel base override (USD)<input className={control} inputMode="decimal" aria-label="Hail base override" placeholder="Published rate when available" value={draft.baseOverride??""} onChange={e=>patch({baseOverride:e.target.value===""?null:Number(e.target.value),upcharge:"none"})}/></label>
      <label className="text-sm">One eligible matrix upcharge<select aria-label="Hail upcharge" className={control} value={draft.upcharge} onChange={e=>patch({upcharge:e.target.value})} disabled={carrier!==HAIL_SOURCE.carrier||draft.baseOverride!=null||typeof result.reference!=="number"}>{Object.entries(HAIL_UPCHARGES).map(([v,n])=><option key={v} value={v}>{n}{v!=="none"?" +25%":""}</option>)}</select></label>
    </div>
    <p className="text-xs text-muted-foreground">Do not count the same dent twice: oversized, double-oversized and separately priced stretched dents belong in their separate rows, not the regular count. Glue-pull-only is an additional method/access amount; enter 0 if included in the base or limited-access upcharge. Confirm the claim-specific count treatment.</p>
    <fieldset className="border rounded-md p-3 space-y-3"><legend className="px-1 text-sm font-medium">Separate variations and operations</legend>{Object.entries(HAIL_EXTRAS).map(([key,label])=>{const k=key as HailExtra,v=draft.extras[k];return <div key={k} className="space-y-2"><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!v} aria-label={label} onChange={e=>{const extras={...draft.extras};if(e.target.checked)extras[k]={count:1,unit:null};else delete extras[k];patch({extras});}}/>{label}</label>{v&&<div className="grid grid-cols-2 gap-2 pl-6"><label className="text-xs">Count / quantity<input type="number" min="1" max="9999" step="1" className={control} aria-label={`${k} count`} value={v.count} onChange={e=>patch({extras:{...draft.extras,[k]:{...v,count:Number(e.target.value)}}})}/></label><label className="text-xs">Unit amount (USD)<input inputMode="decimal" className={control} aria-label={`${k} unit amount`} placeholder={k==="oversized"&&carrier===HAIL_SOURCE.carrier?"Published: $50":"Required; 0 if included"} value={v.unit??""} onChange={e=>patch({extras:{...draft.extras,[k]:{...v,unit:e.target.value===""?null:Number(e.target.value)}}})}/></label></div>}</div>;})}</fieldset>
    <p className="text-sm">Corrosion protection: State Farm lists $10 per panel, capped at $30 per vehicle. Review existing vehicle/estimate charges before adding it manually; combination repairs require separate review. Split labor and materials when entering a mixed charge.</p>
    <label className="block text-sm">Line remark / repairability / approval reference<textarea aria-label="Hail line remark" className="w-full min-h-24 border rounded-md p-3 bg-background mt-1" maxLength={250} value={draft.note} onChange={e=>patch({note:e.target.value})} placeholder="Describe oversized damage, glue-only access, repairability and any adjuster agreement. A proposal is not carrier approval."/></label>
    {result.errors.length>0&&<div role="alert" className="text-sm border rounded-md p-3 space-y-1">{result.errors.map(e=><p key={e}>{e}</p>)}</div>}
    {result.lines.length>0&&<div className="space-y-2" data-testid="hail-line-preview">{result.lines.map((l,i)=><div key={i} className="rounded-md border p-3 text-sm"><p>{l.description.split(". "+carrier)[0]}</p><p className="mt-1 tabular-nums">{l.quantity} × {currency(l.unitPrice)} = {currency(l.total)}</p></div>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold" data-testid="hail-panel-total">Panel total: {currency(result.total)}</p><Button data-testid="button-add-splat-items" disabled={busy||result.errors.length>0||!result.lines.length} onClick={async()=>{setBusy(true);setError("");try{await onAdd(result.lines,carrier);setMessage(`Added ${result.lines.length} item(s), ${currency(result.total)}. Review the saved estimate lines below.`);setDraft(fresh(draft.panelId));setMarked(false);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?"Saving…":"Add panel to estimate"}</Button><Button variant="outline" onClick={()=>{setDraft(fresh(draft.panelId));setMarked(false);setError("");}}>Reset unsaved panel</Button></div>
    {message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </CardContent></Card>;
}
