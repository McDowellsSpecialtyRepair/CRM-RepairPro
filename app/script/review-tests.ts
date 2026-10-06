import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID,createHash} from "node:crypto";
import {sqlite} from "../server/storage-db";
import "../server/security";
import {defaultReport,REPORT_SOURCES,type ReportSource} from "../shared/reporting";
import {SERVICES} from "../client/src/lib/services";
import {normalizeVin,isModernVin} from "../shared/vin";
import {parseVinResponse} from "../server/vin";
import {buildPricingCatalog,pricingHtml} from "../server/pricing-catalog";
import {storage} from "../server/storage";
const dir="/home/user/workspace/review-qa",f=JSON.parse(readFileSync(`${dir}/browser-fixture.json`,"utf8")),base="http://127.0.0.1:5001";
const results:any[]=[],snapshots:any={services:[],reports:[],limitations:[]};
let token="";
const check=(name:string,value:any)=>{results.push({name,passed:!!value});assert.ok(value,name);};
async function req(method:string,path:string,body?:any,auth=token){const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(auth?{Authorization:`Bearer ${auth}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get("content-type")?.includes("application/json")?await r.json():await r.text()};}
async function ok(method:string,path:string,body?:any,auth=token){const r=await req(method,path,body,auth);assert.ok([200,201].includes(r.status),`${path} ${r.status} ${JSON.stringify(r.data).slice(0,300)}`);return r.data;}
const block=async(name:string,method:string,path:string,body?:any,auth=token)=>{const r=await req(method,path,body,auth);check(name,[400,401,403,404,409].includes(r.status));};
const fingerprint=()=>createHash("sha256").update(JSON.stringify(["invoices","payments","qb_sync_log"].map(t=>sqlite.prepare(`select * from ${t} order by id`).all()))).digest("hex");
try{
 token=(await ok("POST","/api/auth/login",{email:f.email,password:f.password},"")).token;
 const t=await ok("GET","/api/technicians"),techs=t.filter((t:any)=>t.status==="active").slice(0,2);
 const customer=await ok("POST","/api/customers",{companyName:"QA All Services Retail",customerType:"retail",email:"service@mcdowellsrepair.com",phone:"2085550191",address:"100 QA Avenue",city:"Boise",state:"ID",zip:"83702",confirmDuplicate:true});
 snapshots.customerId=customer.id;
 for(const svc of SERVICES){
   let v:any=null,a:any=null;
   if(svc.target==="asset")a=await ok("POST","/api/assets",{customerId:customer.id,assetType:"sofa",name:"QA Sofa"});
   else v=await ok("POST","/api/vehicles",{customerId:customer.id,year:"2016",make:"QA",model:svc.label,vin:svc.value==="interior_repair"?"JTHCZ1BLXGA004107":null,vehicleType:svc.domain==="auto"?"auto":svc.domain});
   const e=await ok("POST","/api/estimates",{customerId:customer.id,vehicleId:v?.id,assetId:a?.id,serviceType:svc.value,taxRate:6});
   await ok("POST",`/api/estimates/${e.id}/line-items`,{description:"QA material",serviceCategory:"material",lineType:"parts",unitPrice:100,quantity:1});
   const line=await ok("POST",`/api/estimates/${e.id}/line-items`,{description:`QA ${svc.label} labor`,serviceCategory:"labor",lineType:"labor",unitPrice:300,quantity:1});
   await ok("PATCH",`/api/estimates/line-items/${line.id}/classification`,{expectedVersion:1,lineType:"labor",splits:techs.map((t:any,i:number)=>({technicianId:t.id,shareBps:i?4000:6000}))});
   await ok("PATCH",`/api/estimates/${e.id}`,{discount:40,status:"approved"});
   const inv=await ok("POST",`/api/estimates/${e.id}/convert-invoice`,{});
   check(`${svc.label}: invoice $365.40 with $5.40 parts tax`,inv.total===365.4&&inv.taxAmount===5.4);
   const repeats=await Promise.all([ok("POST",`/api/estimates/${e.id}/convert-invoice`,{}),ok("POST",`/api/estimates/${e.id}/convert-invoice`,{})]);
   check(`${svc.label}: concurrent invoice retries create one invoice`,repeats.every(x=>x.id===inv.id));
   const credits=await ok("GET",`/api/invoices/${inv.id}/labor`);
   check(`${svc.label}: two technicians share $270 net labor exactly`,credits.length===2&&credits.reduce((n:number,x:any)=>n+x.net_labor_cents,0)===27000);
   const payment={invoiceId:inv.id,customerId:customer.id,amount:100,paymentMethod:"cash",paymentDate:"2026-09-26",idempotencyKey:randomUUID()};
   const pp=await Promise.all([ok("POST","/api/payments",payment),ok("POST","/api/payments",payment)]);
   check(`${svc.label}: concurrent payment retry posts once`,pp[0].id===pp[1].id);
   const partial=await ok("GET",`/api/invoices/${inv.id}`);
   check(`${svc.label}: partial balance $265.40`,partial.balanceDue===265.4&&partial.status==="partial");
   await block(`${svc.label}: overpayment rejected`,"POST","/api/payments",{...payment,idempotencyKey:randomUUID(),amount:300});
   await ok("POST","/api/payments",{...payment,idempotencyKey:randomUUID(),amount:265.4});
   const paid=await ok("GET",`/api/invoices/${inv.id}`);
   check(`${svc.label}: paid status reconciles`,paid.status==="paid"&&paid.balanceDue===0&&paid.amountPaid===365.4);
   const html=await ok("GET",`/print/invoice/${inv.id}`);
   check(`${svc.label}: printable invoice contains invoice number`,String(html).includes(inv.invoiceNumber));
   snapshots.services.push({service:svc.label,estimateId:e.id,invoiceId:inv.id,vehicleId:v?.id,invoice:paid,credits});
 }
 // Independent report aggregation versus SQL, for every supported grouping.
 for(const [source,def] of Object.entries(REPORT_SOURCES)){
   for(const group of ["none",...def.groups]){
     const config={...defaultReport(source as ReportSource),group,metrics:Object.keys(def.metrics)};
     const report=await ok("POST","/api/reports/run",config);
     check(`Report ${source}/${group}: returns all supported measures`,config.metrics.every(m=>Object.hasOwn(report.totals,m)));
     check(`Report ${source}/${group}: row count reconciles`,report.rows.reduce((n:number,r:any)=>n+r.values.count,0)===report.count);
     if(group==="none")snapshots.reports.push({source,definition:def,config,report});
   }
 }
 const sql=sqlite.prepare("SELECT sum(round((subtotal-discount)*100)) sales,sum(round(tax_amount*100)) tax,sum(round(total*100)) gross FROM invoices WHERE status NOT IN ('draft','void')").get() as any;
 const invReport=snapshots.reports.find((r:any)=>r.source==="invoices").report;
 check("Sales, tax and gross independently reconcile to SQL cents",Math.round(invReport.totals.sales*100)===sql.sales&&Math.round(invReport.totals.tax*100)===sql.tax&&Math.round(invReport.totals.gross*100)===sql.gross);
 const paidSql=sqlite.prepare("SELECT sum(round(amount*100)) n FROM payments").get() as any;
 check("Cash collection report independently reconciles to ledger cents",Math.round(snapshots.reports.find((r:any)=>r.source==="payments").report.totals.collected*100)===paidSql.n);
 const cfg={...defaultReport(),group:"none",metrics:["sales","count"],formula:{name:"Average sale",left:"sales",op:"/" as const,right:"count"}};
 const calc=await ok("POST","/api/reports/run",cfg);
 check("Custom division calculates from grand totals",calc.totals.calculated===calc.totals.sales/calc.totals.count);
 const zero=await ok("POST","/api/reports/run",{...cfg,search:"no-match-"+randomUUID()});
 check("Empty result has zero count and null divide-by-zero",zero.count===0&&zero.totals.calculated===null);
 const comparison=await ok("POST","/api/reports/run",{...cfg,start:"2026-09-01",end:"2026-09-30",compare:true});
 check("Previous period has equal-length prior dates",comparison.comparison.start==="2026-08-02"&&comparison.comparison.end==="2026-08-31");
 for(const bad of [{start:"2026-02-30"},{metrics:["not_real"]},{group:"creditCardNumber"},{formula:{name:"Bad",left:"sales",op:"eval",right:"count"}}])
   await block("Invalid report configuration rejected "+JSON.stringify(bad),"POST","/api/reports/run",{...cfg,...bad});
 const saved=await ok("POST","/api/reports/definitions",{name:"QA All-services review",config:cfg});
 check("Saved report reload preserves configuration",(await ok("GET","/api/reports/definitions")).some((x:any)=>x.id===saved.id&&x.config.formula.name==="Average sale"));
 // Contacts and merge safety.
 for(const key of ["phone","email","address"]){
   const incoming=key==="phone"?{phone:"2085550192"}:key==="email"?{email:"different@qa.invalid"}:{address:"101 QA Avenue",city:"Boise",state:"ID",zip:"83702"};
   const d=await ok("POST",`/api/customers/${customer.id}/contact-diffs`,incoming);
   check(`Only changed ${key} produces advisor question`,d.diffs.length===1&&d.diffs[0].key===key);
 }
 const dealer=await ok("POST","/api/customers",{companyName:"QA All Services Dealer",customerType:"dealership",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const dv=await ok("POST","/api/vehicles",{customerId:dealer.id,vin:"jthcz1blxga004107",year:"2016",make:"Lexus",model:"GS",vehicleType:"auto"});
 const de=await ok("POST","/api/estimates",{customerId:dealer.id,vehicleId:dv.id,serviceType:"interior_repair"});
 const history=await ok("GET",`/api/vin-history/JTHCZ1BLXGA004107?customerId=${customer.id}`);
 check("VIN history finds both customers without transferring ownership",history.vehicles.some((v:any)=>v.customerId===customer.id&&v.sameCustomer)&&history.vehicles.some((v:any)=>v.id===dv.id&&!v.sameCustomer)&&history.estimates.some((e:any)=>e.id===de.id));
 check("VIN history includes invoiced prior service",history.invoices.some((i:any)=>i.id===snapshots.services.find((s:any)=>s.service==="Auto Interior Repair").invoiceId));
 check("VIN normalizes pasted lowercase and whitespace",normalizeVin(" jthcz1blxga004107 ")==="JTHCZ1BLXGA004107");
 check("Invalid VIN does not qualify for automatic decoding",!isModernVin("IIIIIIIIIIIIIIIII"));
 const clean=parseVinResponse("JTHCZ1BLXGA004107",{Results:[{ErrorCode:"0",ModelYear:"2016",Make:"LEXUS",Model:"GS",DisplacementL:"3.5",EngineCylinders:"6"}]});
 check("Decoder clean response provides description fields",clean.clean&&clean.year==="2016"&&clean.make==="LEXUS");
 const partial=parseVinResponse("JTHCZ1BLXGA004107",{Results:[{ErrorCode:"1",Make:"LEXUS",SuggestedVIN:"verify-me"}]});
 check("Decoder warning response never qualifies for autofill",!partial.clean&&partial.suggestedVin==="verify-me");
 const live=await req("GET","/api/vin-decode/JTHCZ1BLXGA004107");
 snapshots.liveVin=live;
 if(live.status===200)check("Live VIN provider returns matching input identifier",live.data.vin==="JTHCZ1BLXGA004107");
 else snapshots.limitations.push("Live NHTSA VIN provider unavailable during review: "+live.status+". Mock-response and local history tests are separate.");
 const dup=await ok("POST","/api/customers",{companyName:"QA Merge Source",customerType:"retail",email:"service@mcdowellsrepair.com",phone:"2085550198",confirmDuplicate:true});
 const preview=await ok("GET",`/api/customers/${customer.id}/merge-preview?sourceId=${dup.id}`);
 await block("Merge without explicit confirmation blocked","POST",`/api/customers/${customer.id}/merge`,{sourceId:dup.id,version:preview.version});
 await block("Merge with missing contact answers blocked","POST",`/api/customers/${customer.id}/merge`,{sourceId:dup.id,version:preview.version,confirmed:true,contactAnswers:[]});
 await ok("PATCH",`/api/customers/${dup.id}`,{notes:"Changed since preview"});
 await block("Stale merge snapshot rejected","POST",`/api/customers/${customer.id}/merge`,{sourceId:dup.id,version:preview.version,confirmed:true,contactAnswers:preview.contactDiffs.map((d:any)=>({...d,answer:"kept"}))});
 const fresh=await ok("GET",`/api/customers/${customer.id}/merge-preview?sourceId=${dup.id}`);
 const merged=await ok("POST",`/api/customers/${customer.id}/merge`,{sourceId:dup.id,version:fresh.version,confirmed:true,contactAnswers:fresh.contactDiffs.map((d:any)=>({...d,answer:"both"}))});
 check("Confirmed merge keeps customer and records extra number",merged.keepId===customer.id&&(await ok("GET",`/api/customers/${customer.id}`)).mobile==="2085550198");
 await block("Merging removed source again does not repeat","POST",`/api/customers/${customer.id}/merge`,{sourceId:dup.id,confirmed:true,version:fresh.version,contactAnswers:[]});
 // Catalog and QB boundaries.
 const cat=buildPricingCatalog(storage.getPricingMatrices(),storage.getServiceTemplates());
 const expectedMatrixIds=storage.getPricingMatrices().map(m=>m.id).sort((a,b)=>a-b);
 check("Pricing catalog covers all matrix IDs exactly once",JSON.stringify(cat.tables.flatMap(t=>t.ids).sort((a,b)=>a-b))===JSON.stringify(expectedMatrixIds));
 check("Pricing HTML escapes stored markup",pricingHtml(buildPricingCatalog([{id:999,name:"<script>alert(1)</script>",matrixType:"labor",price:2}],[])).includes("&lt;script&gt;"));
 await block("Anonymous pricing print denied","GET","/print/pricing-matrices",undefined,"");
 const printed=await ok("GET","/print/pricing-matrices");check("Authorized print includes sourced and legacy insurer tables and quote-required furniture",printed.includes("Carrier-published State Farm: Hood")&&printed.includes("Legacy insurance hail:")&&printed.includes("(UNVERIFIED)")&&printed.includes("Quote required for each selected panel"));
 const before=fingerprint();
 await block("QuickBooks sync fails closed, not simulated success","POST","/api/qb-sync/run",{});
 await block("Forged QuickBooks success log rejected","POST","/api/qb-sync",{status:"success",recordId:1});
 check("Blocked QB actions leave financial data and sync log unchanged",before===fingerprint());
 const delivery=await ok("GET",`/api/delivery/invoice/${snapshots.services[0].invoiceId}`);
 check("SMS and WhatsApp correctly report unconfigured",!delivery.smsConfigured&&!delivery.whatsappConfigured);
 snapshots.operations=await ok("GET","/api/operations");
 snapshots.capacity=await ok("GET","/api/capacity");
 snapshots.labor=await ok("GET","/api/reports/technician-labor");
 snapshots.campaigns=await ok("GET","/api/campaigns");
 snapshots.mainTables={invoices:storage.getInvoices(),payments:storage.getPayments(),estimates:storage.getEstimates()};
 check("Final physical integrity passes",(sqlite.pragma("integrity_check") as any[])[0].integrity_check==="ok");
 check("Final foreign key integrity passes",sqlite.pragma("foreign_key_check").length===0);
 await sqlite.backup(`${dir}/restore-drill.db`);
 const {default:Database}=await import("better-sqlite3");const restore=new Database(`${dir}/restore-drill.db`,{readonly:true});
 check("Backup restore has same invoice count",restore.prepare("select count(*) n from invoices").get().n===(sqlite.prepare("select count(*) n from invoices").get() as any).n);
 check("Restored backup physical integrity passes",(restore.pragma("integrity_check") as any[])[0].integrity_check==="ok");restore.close();
}finally{
 writeFileSync(`${dir}/review-results.json`,JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
 writeFileSync(`${dir}/snapshots.json`,JSON.stringify(snapshots,null,2));
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,last:results.at(-1),limitations:snapshots.limitations}));sqlite.close();
}
