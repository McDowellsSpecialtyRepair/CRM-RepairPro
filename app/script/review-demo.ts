import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {defaultReport,REPORT_SOURCES,type ReportSource} from "../shared/reporting";
import {localToday,addDays} from "../shared/operations";
const dir="/home/user/workspace/review-qa",f=JSON.parse(readFileSync(`${dir}/browser-fixture.json`,"utf8"));
let token="";
async function api(method:string,path:string,body?:any){const r=await fetch("http://127.0.0.1:5001"+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(JSON.stringify(x));return x;}
token=(await api("POST","/api/auth/login",{email:f.email,password:f.password})).token;
const techs=(await api("GET","/api/technicians")).filter((t:any)=>t.status==="active").slice(0,2);
const scenarios=[
  {name:"EXAMPLE • Awaiting customer decision",stage:"unsold",price:450},
  {name:"EXAMPLE • Sold, waiting to schedule",stage:"unscheduled",price:650},
  {name:"EXAMPLE • Interior work in progress",stage:"in_progress",price:800},
  {name:"EXAMPLE • Waiting for upholstery material",stage:"on_hold",price:900},
  {name:"EXAMPLE • Finished, ready to invoice",stage:"completed",price:500},
];
const examples:any[]=[];
for(const scenario of scenarios){
 const c=await api("POST","/api/customers",{companyName:scenario.name,customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
 const e=await api("POST","/api/estimates",{customerId:c.id,serviceType:"interior_repair",taxRate:6});
 const line=await api("POST",`/api/estimates/${e.id}/line-items`,{description:"EXAMPLE labor service",serviceCategory:"labor",lineType:"labor",quantity:1,unitPrice:scenario.price});
 await api("PATCH",`/api/estimates/line-items/${line.id}/classification`,{expectedVersion:1,lineType:"labor",splits:techs.map((t:any,i:number)=>({technicianId:t.id,shareBps:i?4000:6000}))});
 if(scenario.stage==="unsold"){
   const owners=await api("GET","/api/operations/owners");
   await api("PUT",`/api/operations/followups/${e.id}`,{version:0,ownerId:owners[0].id,nextDate:localToday(),state:"open",reason:"",note:"EXAMPLE ONLY: ask about estimate decision",presentedDate:localToday(),contacted:false});
   examples.push({...scenario,customerId:c.id,estimateId:e.id});continue;
 }
 await api("PATCH",`/api/estimates/${e.id}`,{status:"approved"});
 let p=await api("POST","/api/operations/start",{estimateId:e.id,department:"Interior Repair"});
 const patch=(p:any,more:any={})=>({version:p.version,department:p.department,promisedDate:addDays(localToday(),2),forecastDate:addDays(localToday(),1),holdReason:p.hold_reason,partsReady:true,qc:p.qc,costComplete:!!p.cost_complete,notes:"Synthetic example, not actual customer activity",action:"save",...more});
 p=await api("PATCH",`/api/operations/cases/${p.id}`,patch(p,scenario.stage==="in_progress"?{action:"start"}:scenario.stage==="on_hold"?{holdReason:"Parts / materials",partsReady:false}:{}));
 if(scenario.stage==="completed"){
   p=await api("PATCH",`/api/operations/tasks/${p.tasks[0].id}`,{version:p.tasks[0].version,completed:true,estimatedMinutes:120,standardMinutes:120});
   p=await api("PATCH",`/api/operations/cases/${p.id}`,patch(p,{qc:"pass",action:"complete"}));
 }
 examples.push({...scenario,customerId:c.id,estimateId:e.id,caseId:p.id});
}
const reports=[];
for(const [source,definition] of Object.entries(REPORT_SOURCES)){
 const config={...defaultReport(source as ReportSource),metrics:Object.keys(definition.metrics)};
 reports.push({source,definition,config,report:await api("POST","/api/reports/run",config)});
}
writeFileSync(`${dir}/demo-data.json`,JSON.stringify({label:"SYNTHETIC QA DATABASE • NOT SHOP PERFORMANCE",examples,operations:await api("GET","/api/operations"),reports,campaigns:await api("GET","/api/campaigns"),labor:await api("GET","/api/reports/technician-labor"),generatedAt:new Date().toISOString()},null,2));
console.log("Created five explicitly labeled demo scenarios in isolated QA database; snapshots saved.");
