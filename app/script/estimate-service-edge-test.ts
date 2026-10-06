import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {sqlite} from "../server/storage-db";
import "../server/security";
const dir="/home/user/workspace/estimate-service-qa",base="http://127.0.0.1:5010";
let token="";
const results:any[]=[];
const check=(name:string,pass:boolean)=>{results.push({name,passed:pass});assert.ok(pass,name);};
async function request(method:string,path:string,body?:any){
 const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
}
async function ok(method:string,path:string,body?:any){const r=await request(method,path,body);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
async function blocked(name:string,method:string,path:string,body?:any){const r=await request(method,path,body);check(name,[400,401,403,404,409].includes(r.status));}
try{
 token=(await ok("POST","/api/auth/login",JSON.parse(readFileSync(`${dir}/fixture.json`,"utf8")))).token;
 const customer=await ok("POST","/api/customers",{companyName:"QA Estimating Edge Cases",customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const tech=(await ok("GET","/api/technicians")).find((t:any)=>t.status==="active");
 for(const serviceType of ["upholstery","rv_upholstery","marine_upholstery"]){
  const e=await ok("POST","/api/estimates",{customerId:customer.id,serviceType,taxRate:6}),path=`/api/estimates/${e.id}`;
  await blocked(`${serviceType}: fabrication cannot be hidden as repair`,"POST",path+"/line-items",{serviceCategory:"labor",repairAction:"fabricate",description:"New furniture",unitPrice:100});
  const labor=await ok("POST",path+"/line-items",{serviceCategory:"fabrication",repairAction:"fabricate",description:"New fabricated cushion",quantity:1,unitPrice:100});
  await ok("POST",path+"/line-items",{serviceCategory:"material",description:"Fabric",quantity:1.5,unit:"yard",unitPrice:20.25,unitCost:10.1});
  const calc=await ok("GET",path);
  check(`${serviceType}: fabrication exception and fractional material round correctly`,calc.subtotal===130.38&&calc.taxAmount===7.82&&calc.total===138.2);
  await blocked(`${serviceType}: fabrication classification cannot become non-labor`,"PATCH",`/api/estimates/line-items/${labor.id}/classification`,{expectedVersion:1,lineType:"parts",splits:[]});
  await ok("PATCH",`/api/estimates/line-items/${labor.id}/classification`,{expectedVersion:1,lineType:"labor",splits:[{technicianId:tech.id,shareBps:10000}]});
  await ok("PATCH",path,{status:"approved"});
  const inv=await ok("POST",path+"/convert-invoice",{});
  check(`${serviceType}: fabrication is labor production without its tax`,(await ok("GET",`/api/invoices/${inv.id}/labor`))[0].net_labor_cents===10000);
 }
 const e=await ok("POST","/api/estimates",{customerId:customer.id,serviceType:"upholstery"}),path=`/api/estimates/${e.id}`;
 const line=await ok("POST",path+"/line-items",{serviceCategory:"upholstery",description:"Legacy line safety",unitPrice:100});
 // Isolated fixture simulates a preexisting mixed-service line. Never alter live estimates.
 sqlite.prepare("UPDATE estimate_line_items SET service_category='pdr_dent' WHERE id=?").run(line.id);
 for(const [name,method,suffix,body] of [
  ["approval","PATCH","",{status:"approved"}],
  ["sending","POST","/send",{to:"service@mcdowellsrepair.com"}],
 ] as const) await blocked(`Historical furniture PDR line blocks ${name}`,method,path+suffix,body);
 sqlite.prepare("UPDATE estimates SET status='approved' WHERE id=?").run(e.id);
 await blocked("Historical furniture PDR line blocks invoice","POST",path+"/convert-invoice",{});
 await ok("PATCH",`/api/estimates/line-items/${line.id}`,{expectedVersion:1,serviceCategory:"upholstery"});
 check("Historical line correction preserves price and requires approval",(await ok("GET",path)).status==="draft"&&(await ok("GET",path)).lineItems[0].unitPrice===100);
 await blocked("Null salesperson rejected with validation error","PUT",path+"/sales-team",{version:1,splits:[null]});
 await blocked("Missing commercial snapshot returns not found","GET","/api/invoices/99999999/commercial");
 await blocked("Overflow purchase cost blocked","POST",path+"/line-items",{serviceCategory:"supplies",description:"Too large",quantity:1e6,unitCost:1e9});
 await blocked("Negative purchase cost blocked","POST",path+"/line-items",{serviceCategory:"supplies",description:"Negative",unitCost:-1});
 await blocked("Use tax over 100 blocked","POST",path+"/line-items",{serviceCategory:"supplies",description:"Bad rate",unitCost:10,useTaxRate:101,taxNote:"QA"});
 const stale=await ok("GET",path);
 const race=await Promise.all([101,102].map(unitPrice=>request("PATCH",`/api/estimates/line-items/${line.id}`,{expectedVersion:stale.lineItems[0].allocationVersion,unitPrice})));
 check("Concurrent edits: exactly one wins and one is rejected",race.filter(r=>r.status===200).length===1&&race.filter(r=>r.status===409).length===1);
 const stable=await ok("GET",path);
 await blocked("Cross-service bulk rejects entire batch","POST",path+"/line-items/bulk",{items:[{serviceCategory:"material",description:"Valid material",unitPrice:10},{serviceCategory:"pdr_dent",description:"Wrong service",unitPrice:10}]});
 check("Rejected bulk leaves lines and totals unchanged",JSON.stringify(stable)===JSON.stringify(await ok("GET",path)));
 check("SQLite integrity check",sqlite.pragma("integrity_check")[0].integrity_check==="ok");
 check("No foreign-key violations",sqlite.pragma("foreign_key_check").length===0);
} finally {
 writeFileSync(`${dir}/edge-results.json`,JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,results},null,2));
 console.log({total:results.length,passed:results.filter(r=>r.passed).length,failures:results.filter(r=>!r.passed)});
}
