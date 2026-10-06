import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {SERVICES} from "../shared/services";
import {categoriesFor,categoryAllowed,templateAllowed,repairActionsFor} from "../shared/estimate-rules";
const dir="/home/user/workspace/estimate-service-qa",base="http://127.0.0.1:5010";
const fixture=JSON.parse(readFileSync(`${dir}/fixture.json`,"utf8"));
let token="";
const results:any[]=[],documents:any[]=[];
const check=(name:string,passed:boolean)=>{results.push({name,passed});assert.ok(passed,name);};
async function api(method:string,path:string,body?:any,auth=token){
  const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth}`},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:response.headers.get("content-type")?.includes("json")?await response.json():await response.text()};
}
async function ok(method:string,path:string,body?:any,auth=token){const r=await api(method,path,body,auth);assert.ok([200,201].includes(r.status),`${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;}
async function denied(name:string,method:string,path:string,body?:any,auth=token){const r=await api(method,path,body,auth);check(name,[400,401,403,409].includes(r.status));}
try{
  token=(await ok("POST","/api/auth/login",fixture,"")).token;
  const me=await ok("GET","/api/auth/me");
  const email=`qa-sales-${randomUUID()}@qa.invalid`;
  const staff=await ok("POST","/api/staff",{fullName:"QA Sales Two",email,role:"advisor",technicianId:null});
  const advisor=(await ok("POST","/api/auth/activate",{email,activationCode:staff.activationCode,password:fixture.password},"")).token;
  const advisorMe=await ok("GET","/api/auth/me",undefined,advisor);
  const ownerId=me.user?.id||me.id,advisorId=advisorMe.user?.id||advisorMe.id;
  const techs=(await ok("GET","/api/technicians")).filter((t:any)=>t.status==="active").slice(0,2);
  const templates=await ok("GET","/api/service-templates");
  for(const service of SERVICES){
    const prefix=service.label;
    check(`${prefix}: categories exist`,categoriesFor(service.value).length>4);
    const customer=await ok("POST","/api/customers",{companyName:`QA Service ${prefix}`,customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
    const target=service.target==="asset"?await ok("POST","/api/assets",{customerId:customer.id,assetType:"sofa",name:"QA sofa"}):await ok("POST","/api/vehicles",{customerId:customer.id,vehicleType:service.domain,make:"QA",model:prefix});
    const e=await ok("POST","/api/estimates",{customerId:customer.id,serviceType:service.value,...(service.target==="asset"?{assetId:target.id}:{vehicleId:target.id}),taxRate:6});
    const path=`/api/estimates/${e.id}`,core=categoriesFor(service.value)[0].value;
    for(const forbidden of ["pdr_dent","pdr_hail","window_tint","upholstery","interior_vinyl","interior_fabric"].filter(c=>!categoryAllowed(service.value,c)))
      await denied(`${prefix}: rejects ${forbidden}`,"POST",`${path}/line-items`,{serviceCategory:forbidden,description:"Wrong service",unitPrice:25});
    const wrongTemplate=templates.find((t:any)=>!templateAllowed(service.value,t));
    if(wrongTemplate)await denied(`${prefix}: server rejects wrong-service template`,"POST",`${path}/line-items`,{templateId:wrongTemplate.id,serviceCategory:core,description:"Wrong shortcut",unitPrice:25});
    const labor=await ok("POST",`${path}/line-items`,{serviceCategory:core,lineType:"labor",description:"Service repair",quantity:2,unitPrice:100});
    await denied(`${prefix}: material cannot be labor`,"POST",`${path}/line-items`,{serviceCategory:"material",lineType:"labor",description:"Fabric",unitPrice:50});
    const material=await ok("POST",`${path}/line-items`,{serviceCategory:"material",description:"Material sold",quantity:3,unit:"yard",unitPrice:50,unitCost:20});
    check(`${prefix}: materials auto-classify non-labor`,material.lineType==="parts");
    const freight=await ok("POST",`${path}/line-items`,{serviceCategory:"freight_in",description:"Inbound freight",unitPrice:10,unitCost:8});
    await ok("POST",`${path}/line-items`,{serviceCategory:"freight_out",description:"Delivery",unitPrice:20,unitCost:15});
    const supplies=await ok("POST",`${path}/line-items`,{serviceCategory:"supplies",description:"Shop supplies",unitPrice:0,unitCost:10,useTaxRate:6,taxNote:"PRIVATE-PURCHASE-NOTE vendor collected no tax; consumed in shop"});
    await denied(`${prefix}: resale use-tax double count blocked`,"POST",`${path}/line-items`,{serviceCategory:"material",description:"Invalid use tax",unitPrice:5,unitCost:1,useTaxRate:6,taxNote:"not eligible"});
    await denied(`${prefix}: undocumented use tax blocked`,"POST",`${path}/line-items`,{serviceCategory:"supplies",description:"No note",unitPrice:5,unitCost:1,useTaxRate:6});
    await denied(`${prefix}: freight cannot receive technician credit`,"PATCH",`/api/estimates/line-items/${freight.id}/classification`,{expectedVersion:1,lineType:"labor",splits:[]});
    let current=await ok("GET",path);
    check(`${prefix}: correct parts and freight tax, excludes use tax`,current.subtotal===380&&current.taxAmount===9.6&&current.total===389.6);
    await ok("PATCH",path,{discount:38});
    current=await ok("GET",path);check(`${prefix}: discount apportions correct tax`,current.taxAmount===8.64&&current.total===350.64);
    await ok("PATCH",`/api/estimates/line-items/${labor.id}/classification`,{expectedVersion:1,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:6000},{technicianId:techs[1].id,shareBps:4000}]});
    await denied(`${prefix}: sales shares must total 100`,"PUT",`${path}/sales-team`,{version:1,splits:[{staffId:ownerId,shareBps:6000}]});
    await denied(`${prefix}: sales staff must be unique`,"PUT",`${path}/sales-team`,{version:1,splits:[{staffId:ownerId,shareBps:5000},{staffId:ownerId,shareBps:5000}]});
    await ok("PUT",`${path}/sales-team`,{version:1,splits:[{staffId:ownerId,shareBps:6000},{staffId:advisorId,shareBps:4000}]});
    await denied(`${prefix}: stale sales-team change blocked`,"PUT",`${path}/sales-team`,{version:1,splits:[]});
    await ok("PATCH",path,{status:"approved"});
    await ok("PATCH",`/api/estimates/line-items/${material.id}`,{expectedVersion:1,unitCost:21});
    current=await ok("GET",path);check(`${prefix}: edited line forces reapproval`,current.status==="draft"&&current.total===350.64);
    await denied(`${prefix}: stale line edit blocked`,"PATCH",`/api/estimates/line-items/${material.id}`,{expectedVersion:1,unitPrice:999});
    const advisorView=await ok("GET",path,undefined,advisor);
    check(`${prefix}: advisor cannot read internal purchase costs`,!JSON.stringify(advisorView).includes("unitCost")&&!JSON.stringify(advisorView).includes("PRIVATE-PURCHASE-NOTE"));
    await denied(`${prefix}: advisor cannot alter hidden costs`,"PATCH",`/api/estimates/line-items/${material.id}`,{expectedVersion:2,unitCost:0},advisor);
    const print=await ok("GET",`/print/estimate/${e.id}`);
    check(`${prefix}: customer print excludes internal cost and tax note`,!print.includes("PRIVATE-PURCHASE-NOTE")&&!print.includes("unitCost")&&print.includes("Sales tax after discount"));
    await ok("PATCH",path,{status:"approved"});
    const invoice=await ok("POST",`${path}/convert-invoice`,{});
    check(`${prefix}: invoice matches approved total`,invoice.total===350.64);
    check(`${prefix}: conversion idempotent`,(await ok("POST",`${path}/convert-invoice`,{})).id===invoice.id);
    const laborCredits=await ok("GET",`/api/invoices/${invoice.id}/labor`);
    check(`${prefix}: technician totals exclude freight materials and tax`,laborCredits.length===2&&laborCredits.reduce((n:number,r:any)=>n+r.net_labor_cents,0)===18000);
    const snapshot=await ok("GET",`/api/invoices/${invoice.id}/commercial`);
    check(`${prefix}: two salespeople reconcile to net sales`,snapshot.sales.length===2&&snapshot.sales.reduce((n:number,r:any)=>n+r.net_sales_cents,0)===34200);
    check(`${prefix}: use tax and costs preserved`,snapshot.costs.some((c:any)=>c.description==="Shop supplies"&&c.useTax===.6)&&snapshot.costs.some((c:any)=>c.description==="Material sold"&&c.unitCost===21));
    await denied(`${prefix}: issued cost snapshot locked`,"PATCH",`/api/estimates/line-items/${supplies.id}`,{expectedVersion:1,useTaxRate:0});
    await denied(`${prefix}: issued sales team locked`,"PUT",`${path}/sales-team`,{version:2,splits:[]});
    documents.push({service:service.value,estimateId:e.id,invoiceId:invoice.id,customerId:customer.id,targetId:target.id});
  }
  const report=await ok("GET","/api/reports/commercial");
  check("Accounting report includes all new use-tax costs",documents.every(d=>report.costs.some((c:any)=>c.invoice_id===d.invoiceId&&c.description==="Shop supplies"&&c.use_tax===.6)));
  for(const service of SERVICES)for(const template of templates.filter((t:any)=>templateAllowed(service.value,t)))check(`${service.value}: matching template remains available ${template.id}`,template.serviceType===service.value);
  check("Furniture has no dent categories",!categoriesFor("upholstery").some(c=>c.value.startsWith("pdr")));
  check("Furniture offers reupholstery and foam operations",repairActionsFor("upholstery").includes("reupholster")&&repairActionsFor("upholstery").includes("foam_replacement"));
}finally{
  writeFileSync(`${dir}/service-results.json`,JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,failures:results.filter(r=>!r.passed),results},null,2));
  writeFileSync(`${dir}/documents.json`,JSON.stringify(documents,null,2));
  console.log({total:results.length,passed:results.filter(r=>r.passed).length,failures:results.filter(r=>!r.passed)});
}
