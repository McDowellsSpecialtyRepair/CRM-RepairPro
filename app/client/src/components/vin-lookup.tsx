import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {apiRequest} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";
import {normalizeVin,isModernVin,decodeFields,decodedVehicleType,vehicleDescription} from "@shared/vin";

// Only replace empty fields or values supplied by this lookup. Preserve manual edits.
export function useVinAutofill<T extends Record<string,any>>(setFields:Dispatch<SetStateAction<T>>,vin:string){
  const applied=useRef<Record<string,any>>({});
  useEffect(()=>{
    setFields(current=>{
      const next={...current};
      for(const [key,value] of Object.entries(applied.current))if(next[key]===value)(next as any)[key]="";
      applied.current={};return next;
    });
  },[normalizeVin(vin)]);
  return (data:any,force=false)=>setFields(current=>{
    const next={...current};
    for(const key of decodeFields)if(data[key]&&(force||!current[key]||current[key]===applied.current[key])){
      (next as any)[key]=data[key];applied.current[key]=data[key];
    }
    (next as any).vehicleType=decodedVehicleType(data.vehicleType,current.vehicleType);
    return next;
  });
}

export function VinLookup({vin,customerId,enabled=true,onDecoded,onUseVehicle,excludeEstimateId}:{
 vin:string;customerId?:number;enabled?:boolean;onDecoded?:(data:any,force?:boolean)=>void;onUseVehicle?:(v:any)=>void;excludeEstimateId?:number;
}){
  const normalized=normalizeVin(vin),[settled,setSettled]=useState("");
  const cb=useRef(onDecoded);cb.current=onDecoded;
  const applied=useRef("");
  useEffect(()=>{applied.current="";setSettled("");if(!enabled)return;const timer=setTimeout(()=>setSettled(normalized),450);return()=>clearTimeout(timer);},[normalized,enabled]);
  const ready=enabled&&settled===normalized&&/^[A-Z0-9]{5,30}$/.test(settled);
  const history=useQuery<any>({
    queryKey:["vin-history",settled,customerId],queryFn:()=>apiRequest("GET",`/api/vin-history/${settled}${customerId?`?customerId=${customerId}`:""}`),
    enabled:ready,staleTime:0,refetchOnWindowFocus:true,
  });
  const decoded=useQuery<any>({
    queryKey:["vin-decode",settled],queryFn:()=>apiRequest("GET",`/api/vin-decode/${settled}`),
    enabled:ready&&isModernVin(settled)&&!!onDecoded,staleTime:3600000,
  });
  useEffect(()=>{
    if(enabled&&settled===normalized&&decoded.data?.clean&&decoded.data.vin===normalized&&applied.current!==normalized){
      applied.current=normalized;cb.current?.(decoded.data);
    }
  },[decoded.data,normalized,settled,enabled]);
  if(!enabled||!normalized)return null;
  const h=settled===normalized?history.data:undefined,d=settled===normalized?decoded.data:undefined;
  const estimates=(h?.estimates||[]).filter((e:any)=>e.id!==excludeEstimateId);
  const hasPrior=!!(estimates.length||h?.invoices?.length||h?.jobs?.length);
  return <div className="space-y-3 text-sm" data-testid="vin-lookup">
    {onDecoded&&<div className="rounded-md border bg-muted/30 p-3 space-y-2" aria-live="polite">
      {!isModernVin(normalized)?<p>Automatic decoding needs a complete 17-character VIN without I, O or Q. Older identifiers and boat HINs can be checked against shop history; enter their specifications manually.</p>:
       decoded.isFetching||settled!==normalized?<p>Looking up vehicle specifications…</p>:
       decoded.isError?<><p role="alert">{decoded.error.message}</p><Button type="button" variant="outline" size="sm" onClick={()=>void decoded.refetch()}>Retry VIN decode</Button></>:
       d?.clean?<><p><strong>NHTSA match: {vehicleDescription(d)}</strong></p><p className="text-xs text-muted-foreground">{d.bodyClass} · {d.engineInfo} · {d.driveType}</p><p className="text-xs">Available fields filled automatically. Existing manual entries are preserved. Verify trim and equipment; color and upholstery are not inferred.</p><Button type="button" size="sm" variant="outline" onClick={()=>cb.current?.(d,true)}>Use decoded details</Button><a className="ml-3 underline text-xs" href={d.sourceUrl} target="_blank" rel="noreferrer">NHTSA details</a></>:
       d?<><p role="alert">VIN needs review: {d.errorText||"Not enough vehicle data returned."} No fields were automatically filled.</p>{d.suggestedVin&&<p>Provider suggestion: {d.suggestedVin}. Verify it on the vehicle; it was not substituted.</p>}</>:null}
    </div>}
    {normalized.length>=5&&<div className={`rounded-md border p-3 space-y-2 ${hasPrior?"border-amber-600/40 bg-amber-500/5":"bg-card"}`} aria-live="polite">
      {history.isFetching||settled!==normalized?<p>Checking this VIN across shop customer records…</p>:
       history.isError?<><p role="alert">Shop history could not be checked. Do not assume there is no prior work.</p><Button type="button" size="sm" variant="outline" onClick={()=>void history.refetch()}>Retry history lookup</Button></>:
       h?<><h3 className="font-semibold">{hasPrior?"Prior shop work found for this VIN":h.vehicles.length?"This VIN is already in the shop database":"No matching shop vehicle history found"}</h3>
        <p>{estimates.length} estimates · {h.invoices.length} invoices · {h.jobs.length} work orders{h.limited?" visible to your role":""}. Exact VIN matches only.</p>
        {h.vehicles.map((v:any)=><div key={v.id} className="border-t pt-2"><p>{v.customer} · <strong>{v.sameCustomer?"Same customer":"Different customer"}</strong></p><p className="text-xs text-muted-foreground">{vehicleDescription(v)}</p>{v.sameCustomer&&onUseVehicle&&<Button type="button" size="sm" variant="outline" className="mt-2" onClick={()=>onUseVehicle(v)}>Use this customer's existing vehicle</Button>}</div>)}
        {(h.vehicles.some((v:any)=>!v.sameCustomer))&&<p className="text-xs">A previous record may belong to a prior owner or dealer. Verify with the customer. No accounts, vehicles or history are merged or transferred automatically.</p>}
        {[["estimates",estimates],["invoices",h.invoices],["jobs",h.jobs]].map(([type,rows]:any)=>(rows as any[]).map(r=><Link key={`${type}-${r.id}`} href={`/${type}/${r.id}`} className="block rounded border p-2 hover:bg-muted"><strong>{r.number}</strong> · {r.status==="sent"&&type==="invoices"?"issued":r.status}<span className="block text-xs">{r.date?.slice(0,10)} · {r.customer} · {r.sameCustomer?"Same customer":"Different customer"} · {r.serviceType?.replace(/_/g," ")}</span></Link>))}
        {h.limited&&<p className="text-xs">Some document history is restricted by your role. Ask a service advisor to review estimates and invoices.</p>}
        <Button type="button" size="sm" variant="ghost" onClick={()=>void history.refetch()}>Recheck shop history</Button>
       </>:null}
    </div>}
  </div>;
}
