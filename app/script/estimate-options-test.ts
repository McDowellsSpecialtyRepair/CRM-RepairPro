import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {SERVICES} from "../shared/services";
const dir=process.env.QA_DIR||"/home/user/workspace/estimate-sequences";
const f=JSON.parse(readFileSync(`${dir}/fixture.json`,"utf8"));
let token="";
const tests:{name:string,passed:boolean,observed?:any}[]=[];
function check(name:string,passed:boolean,observed?:any){tests.push({name,passed,observed});}
async function api(method:string,path:string,body?:any){
 const r=await fetch((process.env.QA_BASE||"http://127.0.0.1:5005")+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
 const data=r.headers.get("content-type")?.includes("application/json")?await r.json():await r.text();
 return {status:r.status,data};
}
async function ok(method:string,path:string,body?:any){const r=await api(method,path,body);if(![200,201].includes(r.status))throw Error(`${path} ${r.status} ${JSON.stringify(r.data)}`);return r.data;}
async function blocked(name:string,method:string,path:string,body?:any){const r=await api(method,path,body);check(name,[400,403,404,409].includes(r.status),r.status);}
try{
 token=(await ok("POST","/api/auth/login",f)).token;
 const c=await ok("POST","/api/customers",{companyName:"QA API Estimate Options",customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const other=await ok("POST","/api/customers",{companyName:"QA Different Customer",customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const v=await ok("POST","/api/vehicles",{customerId:c.id,vehicleType:"auto",make:"QA",model:"Sedan"});
 const rv=await ok("POST","/api/vehicles",{customerId:c.id,vehicleType:"rv",make:"QA",model:"RV"});
 const marine=await ok("POST","/api/vehicles",{customerId:c.id,vehicleType:"marine",make:"QA",model:"Marine"});
 const a=await ok("POST","/api/assets",{customerId:c.id,assetType:"sofa",name:"QA Sofa"});
 const techs=(await ok("GET","/api/technicians")).filter((t:any)=>t.status==="active").slice(0,2);
 await blocked("Unknown service rejected","POST","/api/estimates",{customerId:c.id,serviceType:"other-service"});
 await blocked("Invalid validity date rejected","POST","/api/estimates",{customerId:c.id,serviceType:"pdr",validUntil:"2026-02-30"});
 await blocked("Other customer target rejected","POST","/api/estimates",{customerId:other.id,serviceType:"pdr",vehicleId:v.id});
 await blocked("RV cannot be assigned to PDR","POST","/api/estimates",{customerId:c.id,serviceType:"pdr",vehicleId:rv.id});
 await blocked("Vehicle cannot be assigned to furniture","POST","/api/estimates",{customerId:c.id,serviceType:"upholstery",vehicleId:v.id});
 await blocked("Asset cannot be assigned to vehicle service","POST","/api/estimates",{customerId:c.id,serviceType:"pdr",assetId:a.id});
 await blocked("Both vehicle and asset rejected","POST","/api/estimates",{customerId:c.id,serviceType:"pdr",vehicleId:v.id,assetId:a.id});
 for(const svc of SERVICES){
  const target=svc.target==="asset"?{assetId:a.id}:{vehicleId:svc.domain==="rv"?rv.id:svc.domain==="marine"?marine.id:v.id};
  const e=await ok("POST","/api/estimates",{customerId:c.id,serviceType:svc.value,...target});
  const path=`/api/estimates/${e.id}`;
  await blocked(`${svc.value}: empty approval blocked`,"PATCH",path,{status:"approved"});
  await blocked(`${svc.value}: draft invoice blocked`,"POST",`${path}/convert-invoice`,{});
  await blocked(`${svc.value}: impossible validity edit blocked`,"PATCH",path,{validUntil:"2026-02-30"});
  await ok("PATCH",path,{validUntil:"2028-02-29",notes:"QA notes persisted"});
  const before=await ok("GET",path);
  check(`${svc.value}: notes and leap-day validity persist`,before.notes==="QA notes persisted"&&before.validUntil==="2028-02-29");
  await blocked(`${svc.value}: invalid bulk atomic`,"POST",`${path}/line-items/bulk`,{items:[{description:"Valid",serviceCategory:"labor",unitPrice:20},{description:"Invalid",serviceCategory:"labor",quantity:-1}]});
  check(`${svc.value}: invalid bulk leaves no partial lines`,(await ok("GET",path)).lineItems.length===0);
  for(const bad of [{quantity:0},{quantity:-1},{unitPrice:-1},{description:"   "},{lineType:"bad"}])
    await blocked(`${svc.value}: invalid line ${JSON.stringify(bad)}`,"POST",`${path}/line-items`,{description:"QA line",serviceCategory:"labor",unitPrice:100,...bad});
  const part=await ok("POST",`${path}/line-items`,{description:"QA parts",serviceCategory:"material",lineType:"parts",unitPrice:100});
  const labor=await ok("POST",`${path}/line-items`,{description:"QA labor",serviceCategory:"labor",lineType:"labor",quantity:2.5,unitPrice:120});
  await blocked(`${svc.value}: excessive discount blocked`,"PATCH",path,{discount:401});
  check(`${svc.value}: discount failure rolls back`,(await ok("GET",path)).discount===0);
  await ok("PATCH",path,{discount:40});
  const calc=await ok("GET",path);
  check(`${svc.value}: parts-tax and fractional quantity`,calc.subtotal===400&&calc.taxAmount===5.4&&calc.total===365.4);
  await ok("PATCH",path,{status:"approved"});
  await blocked(`${svc.value}: unallocated labor blocked`,"POST",`${path}/convert-invoice`,{});
  const classification=`/api/estimates/line-items/${labor.id}/classification`;
  const splits=techs.map((t:any,i:number)=>({technicianId:t.id,shareBps:i?4000:6000}));
  await blocked(`${svc.value}: 110% allocation blocked`,"PATCH",classification,{expectedVersion:1,lineType:"labor",splits:[{...splits[0],shareBps:7000},splits[1]]});
  await ok("PATCH",classification,{expectedVersion:1,lineType:"labor",splits});
  await blocked(`${svc.value}: stale split blocked`,"PATCH",classification,{expectedVersion:1,lineType:"labor",splits});
  check(`${svc.value}: classification resets approval`,(await ok("GET",path)).status==="draft");
  for(const status of ["rejected","expired","draft"]){
    await ok("PATCH",path,{status});
    await blocked(`${svc.value}: ${status} cannot invoice`,"POST",`${path}/convert-invoice`,{});
  }
  await ok("PATCH",path,{status:"approved"});
  await ok("PATCH",path,{...target});
  const reset=await ok("GET",path);
  check(`${svc.value}: target save clears approval/date`,reset.status==="draft"&&reset.approvedDate===null);
  await ok("PATCH",path,{status:"approved"});
  const inv=await ok("POST",`${path}/convert-invoice`,{});
  check(`${svc.value}: converts matching customer/service`,inv.customerId===c.id&&inv.estimateId===e.id&&inv.total===365.4);
  const dup=await ok("POST",`${path}/convert-invoice`,{});
  check(`${svc.value}: conversion retry not duplicate`,dup.id===inv.id);
  const credits=await ok("GET",`/api/invoices/${inv.id}/labor`);
  check(`${svc.value}: two exact net credits`,credits.length===2&&credits[0].net_labor_cents===16200&&credits[1].net_labor_cents===10800);
  await blocked(`${svc.value}: issued estimate line deletion blocked`,"DELETE",`/api/estimates/line-items/${part.id}`);
  await blocked(`${svc.value}: issued estimate target locked`,"PATCH",path,{vehicleId:null,assetId:null});
  const print=await api("GET",`/print/estimate/${e.id}`);
  check(`${svc.value}: print document available`,print.status===200&&typeof print.data==="string"&&print.data.includes(e.estimateNumber)&&print.data.includes("365.40"));
  const pay={invoiceId:inv.id,customerId:c.id,amount:365.4,paymentMethod:"cash",paymentDate:"2026-09-26",idempotencyKey:randomUUID()};
  await ok("POST","/api/payments",pay);
  check(`${svc.value}: final payment reconciles`,(await ok("GET",`/api/invoices/${inv.id}`)).balanceDue===0);
 }
 const ex=await ok("POST","/api/customers",{companyName:"QA Tax Exempt",customerType:"retail",taxExempt:1,email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const e=await ok("POST","/api/estimates",{customerId:ex.id,serviceType:"pdr"});
 await ok("POST",`/api/estimates/${e.id}/line-items`,{description:"Exempt part",lineType:"parts",serviceCategory:"material",unitPrice:100});
 check("Tax exempt parts have zero tax",(await ok("GET",`/api/estimates/${e.id}`)).taxAmount===0);
} finally {
 writeFileSync(`${dir}/api-results.json`,JSON.stringify(tests,null,2));
 console.log(JSON.stringify({total:tests.length,passed:tests.filter(t=>t.passed).length,failures:tests.filter(t=>!t.passed)},null,2));
 if(tests.some(t=>!t.passed))process.exitCode=1;
}
