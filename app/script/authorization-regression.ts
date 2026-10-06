import {readFileSync,writeFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import {sqlite} from "../server/storage-db";
import {tokenHash} from "../server/security";
const qaDir=process.env.QA_DIR||"/home/user/workspace/staff-billing-qa";
const f=JSON.parse(readFileSync(`${qaDir}/browser-fixture.json`,"utf8"));
const results:any[]=[];
const check=(name:string,value:boolean)=>{results.push({name,passed:value});assert.ok(value,name);};
let owner="";
async function call(method:string,path:string,body?:any,token=owner){const r=await fetch((process.env.QA_BASE||"http://127.0.0.1:5001")+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};}
async function ok(method:string,path:string,body?:any,token=owner){const r=await call(method,path,body,token);assert.ok([200,201].includes(r.status),`${method} ${path}: ${r.status}`);return r.data;}
try{
  owner=(await ok("POST","/api/auth/login",{email:f.email,password:f.password},"")).token;
  // A numbered estimate in a reusable fixture is not necessarily the original
  // business record. Verify preservation against its actual starting state.
  const existingEstimate=sqlite.prepare("SELECT id FROM estimates WHERE estimate_number='EST-2026-000023'").get() as any;
  const existingEstimateBefore=existingEstimate?await ok("GET",`/api/estimates/${existingEstimate.id}`):null;
  const existingDeliveryBefore=existingEstimate?await ok("GET",`/api/delivery/estimate/${existingEstimate.id}`):null;
  const roleTokens:Record<string,string>={};
  for(const role of ["admin","manager","advisor","support","accountant","auditor"]){
    const email=`${role}-${randomBytes(4).toString("hex")}@qa.invalid`;
    const invited=await ok("POST","/api/staff",{fullName:`QA ${role}`,email,role,technicianId:null});
    const act=await ok("POST","/api/auth/activate",{email,activationCode:invited.activationCode,password:f.password},"");
    roleTokens[role]=act.token;
    check(`${role} named login succeeds`,act.user.role===role);
  }
  const scenarios=[
    ["support","GET","/api/invoices",undefined,403],
    ["support","GET","/api/reports/technician-labor",undefined,403],
    ["support","GET","/api/customers",undefined,200],
    ["advisor","GET","/api/staff",undefined,403],
    ["advisor","GET","/api/reports/technician-labor",undefined,403],
    ["manager","GET","/api/staff",undefined,403],
    ["manager","GET","/api/reports/technician-labor",undefined,200],
    ["accountant","POST","/api/estimates",{customerId:1,serviceType:"pdr"},403],
    ["accountant","GET","/api/reports/technician-labor",undefined,200],
    ["auditor","POST","/api/reports/definitions",{},403],
    ["auditor","PATCH","/api/customers/1",{notes:"unauthorized"},403],
    ["auditor","GET","/api/staff/audit",undefined,200],
  ] as const;
  for(const [role,method,path,body,status] of scenarios) check(`${role} ${method} ${path} => ${status}`,(await call(method,path,body,roleTokens[role])).status===status);
  const support=await ok("GET","/api/customers/1",undefined,roleTokens.support);
  check("Support response excludes typed financial data",!/"(?:total|balanceDue|creditLimit|subtotal|amountPaid)":/.test(JSON.stringify(support)));
  check("Support cannot update credit limit",(await call("PATCH","/api/customers/1",{creditLimit:500},roleTokens.support)).status===403);
  const ownerRow=sqlite.prepare("SELECT id,version FROM staff_accounts WHERE email=?").get(f.email) as any;
  check("Admin cannot edit owner",(await call("PATCH",`/api/staff/${ownerRow.id}`,{role:"admin",status:"active",technicianId:null,version:ownerRow.version,reason:"QA blocked"},roleTokens.admin)).status===403);
  check("Unknown endpoint fails closed",(await call("GET","/api/not-a-real-endpoint")).status===403);
  check("Alternate case API path fails closed",(await call("GET","/API/customers")).status===403);
  const before=sqlite.prepare("SELECT last_seen FROM staff_sessions WHERE token_hash=?").get(tokenHash(owner)) as any;
  await ok("GET","/api/auth/me");
  const after=sqlite.prepare("SELECT last_seen FROM staff_sessions WHERE token_hash=?").get(tokenHash(owner)) as any;
  check("Background me poll does not extend idle timeout",before.last_seen===after.last_seen);
  sqlite.prepare("UPDATE staff_sessions SET last_seen=? WHERE token_hash=?").run(Date.now()-31*60000,tokenHash(roleTokens.advisor));
  check("Idle session expires",(await call("GET","/api/customers",undefined,roleTokens.advisor)).status===401);
  const badEmail=`bad-${randomBytes(4).toString("hex")}@qa.invalid`;
  for(let i=0;i<5;i++)await call("POST","/api/auth/login",{email:badEmail,password:"Wrong, unknown login"},"");
  check("Repeated failed login rate limited",(await call("POST","/api/auth/login",{email:badEmail,password:"Wrong again"},"")).status===429);
  const invitations:any[]=[];
  for(let i=0;i<40;i++){
    const email=`load-${i}-${randomBytes(4).toString("hex")}@qa.invalid`;
    const invite=await ok("POST","/api/staff",{fullName:`Load test ${i+1}`,email,role:"support",technicianId:null});
    invitations.push({...invite,email});
  }
  const sessions:any[]=[];
  for(let i=0;i<invitations.length;i+=4)
    sessions.push(...await Promise.all(invitations.slice(i,i+4).map(x=>ok("POST","/api/auth/activate",{email:x.email,activationCode:x.activationCode,password:f.password},""))));
  check("40 different staff accounts activated",sessions.length===40&&new Set(sessions.map(s=>s.user.id)).size===40);
  const accesses=await Promise.all(sessions.map(s=>call("GET","/api/customers",undefined,s.token)));
  check("40 separate simultaneous staff sessions can read authorized data",accesses.every(r=>r.status===200));
  const sample=sessions[0];
  const staff=await ok("GET","/api/staff");
  const sr=staff.find((s:any)=>s.id===sample.user.id);
  await ok("PATCH",`/api/staff/${sr.id}`,{role:"support",status:"disabled",technicianId:null,version:sr.version,reason:"QA disable"});
  check("Disabling staff immediately revokes access",(await call("GET","/api/customers",undefined,sample.token)).status===401);
  check("Disabled staff cannot login",(await call("POST","/api/auth/login",{email:sample.user.email,password:f.password},"")).status===401);
  check("Stale staff update rejected",(await call("PATCH",`/api/staff/${sr.id}`,{role:"support",status:"active",technicianId:null,version:sr.version,reason:"stale QA"})).status===409);
  const audit=await ok("GET","/api/staff/audit");
  check("Audit API excludes plaintext passwords and activation secrets",!JSON.stringify(audit).includes(f.password)&&!JSON.stringify(audit).includes(invitations[0].activationCode));
  const knownRow=sqlite.prepare("SELECT id FROM estimates WHERE estimate_number='EST-2026-000023'").get() as any;
  if(knownRow){
    const known=await ok("GET",`/api/estimates/${knownRow.id}`);
    check("Existing EST-2026-000023 state retained during staff workload",JSON.stringify(known)===JSON.stringify(existingEstimateBefore));
    const history=await ok("GET",`/api/delivery/estimate/${knownRow.id}`);
    check("Existing estimate delivery history retained during staff workload",JSON.stringify(history)===JSON.stringify(existingDeliveryBefore));
  }else console.log("SKIPPED: legacy EST-2026-000023 checks; not present in fresh fixture database.");
  const invEmail=await ok("POST",`/api/invoices/${f.invoiceId}/email`,{to:"wrong@qa.invalid"});
  check("Invoice email preparation cannot falsely claim sending",invEmail.recipientEmail==="service@mcdowellsrepair.com"&&!invEmail.success&&!invEmail.delivered);
  const c=await ok("POST","/api/customers",{customerType:"retail",companyName:"Browser labor test",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
  const e=await ok("POST","/api/estimates",{customerId:c.id,serviceType:"pdr",taxRate:6});
  await ok("POST",`/api/estimates/${e.id}/line-items`,{serviceCategory:"labor",lineType:"labor",description:"Browser labor allocation",quantity:1,unitPrice:101});
  f.estimateDraftId=e.id;writeFileSync(`${qaDir}/browser-fixture.json`,JSON.stringify(f),{mode:0o600});
  check("Foreign key check after multi-user workload clean",(sqlite.pragma("foreign_key_check") as any[]).length===0);
}finally{writeFileSync(`${qaDir}/authorization-results.json`,JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.passed).length}/${results.length} authorization checks passed`);sqlite.close();}
