import { readFileSync, writeFileSync } from "node:fs";
const dir = "/home/user/workspace/workorders-qa";
const f = JSON.parse(readFileSync(`${dir}/ui-fixture.json`, "utf8"));
const out: any[] = [];
let token = "";
async function req(method: string, path: string, body?: any) {
  const r = await fetch("http://127.0.0.1:5006" + path, {method, headers: {"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:await r.json()};
}
async function ok(method:string,path:string,body?:any) { const r=await req(method,path,body); if(![200,201].includes(r.status))throw Error(`${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data; }
function check(name:string,passed:boolean) {out.push({name,passed});}
async function block(name:string,path:string,body:any,status:number) {check(name,(await req("POST",path,body)).status===status);}
try {
  token=(await ok("POST","/api/auth/login",{email:f.email,password:f.password})).token;
  const base={customerId:f.customerId,vehicleId:f.vehicleId,serviceType:"pdr"};
  const job=await ok("POST","/api/jobs",{...base,title:"QA Link Existing Estimate"});
  const e=await ok("POST","/api/estimates",base);
  await ok("POST",`/api/estimates/${e.id}/line-items`,{description:"Repair material",lineType:"parts",serviceCategory:"material",unitPrice:120});
  await ok("PATCH",`/api/estimates/${e.id}`,{status:"approved"});
  const wrong=await ok("POST","/api/jobs",{...base,serviceType:"hail",title:"QA Wrong Service"});
  await block("Mismatched service cannot link",`/api/jobs/${wrong.id}/link-estimate`,{estimateId:e.id},400);
  const other=await ok("POST","/api/jobs",{...base,vehicleId:null,title:"QA Wrong Item"});
  await block("Mismatched repair item cannot link",`/api/jobs/${other.id}/link-estimate`,{estimateId:e.id},400);
  const linked=await ok("POST",`/api/jobs/${job.id}/link-estimate`,{estimateId:e.id});
  check("Explicit link saves job association",linked.jobId===job.id);
  check("Approved estimate resets for review without price change",linked.status==="draft"&&linked.total===127.2&&linked.approvedDate===null);
  const again=await ok("POST",`/api/jobs/${job.id}/link-estimate`,{estimateId:e.id});
  check("Link retry is idempotent",again.id===e.id);
  const j2=await ok("POST","/api/jobs",{...base,title:"QA Another Matching Job"});
  await block("Estimate cannot be stolen from another work order",`/api/jobs/${j2.id}/link-estimate`,{estimateId:e.id},409);
  await block("Issued estimate cannot be relinked",`/api/jobs/${j2.id}/link-estimate`,{estimateId:f.records[0].estimate.id},409);
  const second=await ok("POST","/api/estimates",base);
  await block("Existing active linked estimate blocks replacement",`/api/jobs/${job.id}/link-estimate`,{estimateId:second.id},409);
  await block("Invalid estimate ID rejected",`/api/jobs/${j2.id}/link-estimate`,{estimateId:999999},404);
  const p=await ok("GET",`/api/jobs/${j2.id}/planning`);
  await ok("PATCH",`/api/jobs/${j2.id}/planning`,{revision:p.revision,status:"cancelled"});
  await block("Cancelled job cannot link an estimate",`/api/jobs/${j2.id}/link-estimate`,{estimateId:second.id},409);
  const prod=f.production;
  const pp=await ok("GET",`/api/jobs/${prod.job_id}/planning`);
  for(const status of ["in_progress","completed"]) check(`Production safety blocks premature ${status}`,(await req("PATCH",`/api/jobs/${prod.job_id}/planning`,{revision:pp.revision,status})).status===409);
  for(const priority of ["low","normal","high","urgent"]) {
    const before=await ok("GET",`/api/estimates/${second.id}/planning`);
    const after=await ok("PATCH",`/api/estimates/${second.id}/planning`,{revision:before.revision,priority});
    check(`Standalone estimate urgency ${priority}`,after.priority===priority&&!after.jobId);
  }
  const before=await ok("GET",`/api/estimates/${second.id}/planning`);
  await ok("PATCH",`/api/estimates/${second.id}/planning`,{revision:before.revision,scheduledDate:"2028-02-29",assignedTechId:f.techs[0].id,salesPersonId:f.staff[0].id});
  const after=await ok("GET",`/api/estimates/${second.id}/planning`);
  check("Standalone estimate stores valid leap-day date and staff",after.scheduledDate==="2028-02-29"&&after.assignedTechId===f.techs[0].id&&after.salesPersonId===f.staff[0].id);
  const raw=await ok("POST","/api/jobs",{...base,title:"QA Browser Link Target"});
  writeFileSync(`${dir}/link-fixture.json`,JSON.stringify({jobId:raw.id,estimateId:second.id}));
} catch(e:any){out.push({name:"Link test runner completed",passed:false,observed:e.message});}
writeFileSync(`${dir}/link-results.json`,JSON.stringify(out,null,2));
console.log({total:out.length,passed:out.filter(t=>t.passed).length,failures:out.filter(t=>!t.passed)});
if(out.some(t=>!t.passed))process.exitCode=1;
