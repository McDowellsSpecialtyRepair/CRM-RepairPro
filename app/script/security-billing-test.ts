import assert from "node:assert/strict";
import { readFileSync,writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { sqlite } from "../server/storage-db";
import "../server/security";
import { apportion } from "../server/labor";
const base=process.env.QA_BASE||"http://127.0.0.1:5001";
const qaDir=process.env.QA_DIR||"/home/user/workspace/staff-billing-qa";
const results: any[]=[];
const check=(name:string,yes:boolean)=>{results.push({name,passed:yes});assert.ok(yes,name);};
async function req(method:string,path:string,body?:any,token?:string) {
  const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:r.headers.get("content-type")?.includes("application/json")?await r.json():await r.text()};
}
let owner="";
async function ok(method:string,path:string,body?:any,token=owner) {
  const r=await req(method,path,body,token);assert.ok([200,201].includes(r.status),`${path}: HTTP ${r.status}`);return r.data;
}
async function blocked(name:string,method:string,path:string,body?:any,token=owner){const r=await req(method,path,body,token);check(name,[400,401,403,404,409].includes(r.status));}
const password=randomBytes(24).toString("base64url");
try {
  const invite=JSON.parse(readFileSync(`${qaDir}/owner.json`,"utf8"));
  check("Unauthenticated customer access denied",(await req("GET","/api/customers")).status===401);
  check("Unauthenticated print denied",(await req("GET","/print/invoice/1")).status===401);
  owner=(await ok("POST","/api/auth/activate",{email:invite.email,activationCode:invite.activationCode,password},"")).token;
  await blocked("One-time activation cannot be reused","POST","/api/auth/activate",{email:invite.email,activationCode:invite.activationCode,password},"");
  const hash=sqlite.prepare("SELECT password_hash FROM staff_accounts WHERE email=?").get(invite.email) as any;
  check("Password stored as scrypt hash, not plaintext",hash.password_hash.startsWith("scrypt$32768$")&&!hash.password_hash.includes(password));
  const c=await ok("POST","/api/customers",{customerType:"retail",companyName:"QA Labor Split",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
  const techs=await ok("GET","/api/technicians");
  const active=techs.filter((t:any)=>t.status==="active").slice(0,2);
  assert.equal(active.length,2);
  const e=await ok("POST","/api/estimates",{customerId:c.id,serviceType:"pdr",taxRate:6});
  const part=await ok("POST",`/api/estimates/${e.id}/line-items`,{description:"Replacement panel",serviceCategory:"material",lineType:"parts",quantity:1,unitPrice:100});
  const labor=await ok("POST",`/api/estimates/${e.id}/line-items`,{description:"Repair labor",serviceCategory:"labor",lineType:"labor",quantity:1,unitPrice:300});
  let calc=await ok("PATCH",`/api/estimates/${e.id}`,{discount:40});
  check("Parts-only tax on discounted parts: 90 x 6%=5.40",calc.taxAmount===5.4&&calc.total===365.4);
  await blocked("Manual sent status forbidden","PATCH",`/api/estimates/${e.id}`,{status:"sent"});
  const send=await ok("POST",`/api/estimates/${e.id}/send`,{to:"wrong@qa.invalid"});
  check("Unconfigured email not successful, not delivered",!send.success&&!send.delivered&&!send.providerAccepted&&send.to==="service@mcdowellsrepair.com");
  check("Failed send keeps draft status",(await ok("GET",`/api/estimates/${e.id}`)).status==="draft");
  await ok("PATCH",`/api/estimates/${e.id}`,{status:"approved"});
  await blocked("Unallocated labor cannot be invoiced","POST",`/api/estimates/${e.id}/convert-invoice`,{});
  const split=[{technicianId:active[0].id,shareBps:6000},{technicianId:active[1].id,shareBps:4000}];
  const endpoint=`/api/estimates/line-items/${labor.id}/classification`;
  await blocked("Overallocated labor rejected","PATCH",endpoint,{expectedVersion:1,lineType:"labor",splits:[{...split[0],shareBps:7000},split[1]]});
  await blocked("Duplicate technician rejected","PATCH",endpoint,{expectedVersion:1,lineType:"labor",splits:[split[0],{...split[1],technicianId:split[0].technicianId}]});
  await blocked("Parts cannot carry labor credits","PATCH",`/api/estimates/line-items/${part.id}/classification`,{expectedVersion:1,lineType:"parts",splits:split});
  await ok("PATCH",endpoint,{expectedVersion:1,lineType:"labor",splits:split});
  await blocked("Stale labor split cannot overwrite a newer split","PATCH",endpoint,{expectedVersion:1,lineType:"labor",splits:split});
  check("Changing splits requires reapproval",(await ok("GET",`/api/estimates/${e.id}`)).status==="draft");
  await ok("PATCH",`/api/estimates/${e.id}`,{status:"approved"});
  const inv=await ok("POST",`/api/estimates/${e.id}/convert-invoice`,{});
  const credits=await ok("GET",`/api/invoices/${inv.id}/labor`);
  check("Two techs receive 162 and 108, exactly 270 net labor",credits.length===2&&credits[0].net_labor_cents===16200&&credits[1].net_labor_cents===10800);
  check("Repeat invoice conversion is idempotent",(await ok("POST",`/api/estimates/${e.id}/convert-invoice`,{})).id===inv.id);
  await blocked("Invoiced split editing forbidden","PATCH",endpoint,{lineType:"labor",splits:split});
  const pay={invoiceId:inv.id,customerId:c.id,amount:100,paymentMethod:"cash",paymentDate:"2026-09-26",idempotencyKey:randomBytes(16).toString("hex")};
  const payment=await ok("POST","/api/payments",pay);
  check("Payment retry idempotent",(await ok("POST","/api/payments",pay)).id===payment.id);
  await blocked("Overpayment forbidden","POST","/api/payments",{...pay,amount:300,idempotencyKey:"overpay"});
  await ok("POST","/api/payments",{...pay,amount:265.4,idempotencyKey:"remaining"});
  const paid=await ok("GET",`/api/invoices/${inv.id}`);
  check("Invoice paid ledger reconciles",paid.status==="paid"&&paid.balanceDue===0&&paid.amountPaid===365.4);
  const report=await ok("GET","/api/reports/technician-labor");
  check("Labor report sums credited sales once",report.rows.filter((r:any)=>r.invoice_id===inv.id).reduce((s:number,r:any)=>s+r.net_labor_cents,0)===27000);
  check("Penny splits never duplicate or lose money",apportion(101,[3333,3333,3334]).reduce((s,x)=>s+x,0)===101);
  const exempt=await ok("POST","/api/customers",{customerType:"retail",companyName:"QA Exempt",taxExempt:1,confirmDuplicate:true,email:"service@mcdowellsrepair.com"});
  const ex=await ok("POST","/api/estimates",{customerId:exempt.id,serviceType:"pdr",taxRate:6});
  await ok("POST",`/api/estimates/${ex.id}/line-items`,{description:"Exempt part",serviceCategory:"material",lineType:"parts",unitPrice:100});
  check("Exempt customer pays no parts tax",(await ok("GET",`/api/estimates/${ex.id}`)).taxAmount===0);
  const staff=await ok("POST","/api/staff",{fullName:"QA Tech",email:"tech@qa.invalid",role:"technician",technicianId:active[0].id});
  const techToken=(await ok("POST","/api/auth/activate",{email:"tech@qa.invalid",activationCode:staff.activationCode,password},"")).token;
  for(const path of ["/api/customers","/api/invoices","/api/staff","/api/staff/audit","/api/reports/technician-labor","/print/invoice/1"])
    await blocked(`Technician denied ${path}`,"GET",path,undefined,techToken);
  await blocked("Technician cannot self-promote","PATCH",`/api/staff/${staff.user?.id||staff.id||999}`,{role:"owner"},techToken);
  check("Technician assigned-work endpoint available",Array.isArray(await ok("GET","/api/my-work",undefined,techToken)));
  const auditRows=sqlite.prepare("SELECT * FROM security_audit WHERE entity='customers' AND record_id=?").all(String(c.id)) as any[];
  check("Customer write audit identifies owner with after-state",auditRows.some(a=>a.actor_id&&a.after_json.includes("QA Labor Split")));
  for(const sql of ["UPDATE security_audit SET event='tampered' WHERE id=1","DELETE FROM invoice_labor_credits"]){
    let denied=false;try{sqlite.exec(sql);}catch{denied=true;}check(`Database rejects ${sql.split(" ")[0]} audit/credit tampering`,denied);
  }
  const concurrent=await Promise.all(Array.from({length:40},()=>req("GET","/api/auth/me",undefined,owner)));
  check("40 concurrent authenticated requests succeed",concurrent.every(r=>r.status===200));
  const account=sqlite.prepare("SELECT id FROM staff_accounts WHERE email='tech@qa.invalid'").get() as any;
  await ok("POST",`/api/staff/${account.id}/revoke-sessions`,{reason:"QA revocation"});
  await blocked("Revoked token stops working","GET","/api/my-work",undefined,techToken);
  const second=(await ok("POST","/api/auth/login",{email:invite.email,password},"")).token;
  await ok("POST","/api/auth/logout",{},second);
  await blocked("Logged-out token stops working","GET","/api/auth/me",undefined,second);
  check("Foreign keys clean",(sqlite.pragma("foreign_key_check") as any[]).length===0);
  check("Physical integrity clean",(sqlite.pragma("integrity_check") as any[])[0].integrity_check==="ok");
  writeFileSync(`${qaDir}/browser-fixture.json`,JSON.stringify({email:invite.email,password,estimateId:e.id,invoiceId:inv.id}),{mode:0o600});
} finally {
  writeFileSync(`${qaDir}/results.json`,JSON.stringify(results,null,2));
  console.log(`${results.filter(r=>r.passed).length}/${results.length} checks passed`);
  sqlite.close();
}
