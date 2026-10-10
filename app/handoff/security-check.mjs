// Local-only Phase 1 security regression suite. Temporary demo database only; never an
// operating database. Requires a build (dist/) and SMTP credentials are cleared.
import {spawn,execFileSync,spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync,statSync,readdirSync,utimesSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {createHash,randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Database=require("better-sqlite3");
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5189);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local test port");
const base=`http://127.0.0.1:${port}`;
try{await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});throw Error("Test port is already occupied; choose HANDOFF_TEST_PORT");}catch(e){if(e.message.includes("already occupied"))throw e;}
const work=mkdtempSync(join(tmpdir(),"repairpro-security-"));
const dbPath=join(work,"security.db"),emails=join(work,"emails");
const env={...process.env,DB_PATH:dbPath,EMAIL_OUTPUT_DIR:emails,PORT:String(port),NODE_ENV:"production",TRUST_PROXY:"loopback",SMTP_USER:"",SMTP_PASS:"",SMTP_HOST:"",BACKUP_ENCRYPTION_KEY:""};
delete env.HOST;delete env.EMAIL_TEST_COPY_RETENTION_DAYS; // default 30-day test-copy retention
const {NODE_ENV:_p,...devEnv}=env;
const results=[];let checks=0,child,log="";
function check(name,value){assert.ok(value,name);checks++;results.push({name,passed:true});}
const tsx=(args,e=devEnv)=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:root,env:e,stdio:"pipe"});
const node=(args,e=devEnv)=>spawnSync(process.execPath,args,{cwd:root,env:e,encoding:"utf8"});
async function call(method,path,body,{token,ip}={}){
 const headers={"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}),...(ip?{"X-Forwarded-For":ip}:{})};
 const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await r.text();let data=text;try{data=JSON.parse(text);}catch{}
 return {status:r.status,data,text,headers:r.headers};
}
async function ok(method,path,body,opts){const r=await call(method,path,body,opts);assert.ok(r.status===200||r.status===201,`${method} ${path}: ${r.status} ${r.text.slice(0,250)}`);return r.data;}
const password=()=>"Pp-"+randomBytes(18).toString("base64url");
function keysOf(value,out=new Set()){if(Array.isArray(value))value.forEach(v=>keysOf(v,out));else if(value&&typeof value==="object")for(const [k,v] of Object.entries(value)){out.add(k);keysOf(v,out);}return out;}
const sha=s=>`'sha256-${createHash("sha256").update(s).digest("base64")}'`;
const inlineScripts=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
async function startServer(extraEnv={}){
 log="";child=spawn(process.execPath,["dist/index.cjs"],{cwd:root,env:{...env,...extraEnv},stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{log+=b;});child.stderr.on("data",b=>{log+=b;});
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw Error("Server failed:\n"+log);
  try{const r=await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});if(r.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error("Server did not start:\n"+log);
}
try{
 // ---- configuration safety ----
 const unsafeProxy=node(["dist/index.cjs"],{...env,DB_PATH:join(work,"unsafe-proxy.db"),TRUST_PROXY:"true",PORT:String(port+1)});
 check("TRUST_PROXY=true is refused at startup",unsafeProxy.status!==0&&/TRUST_PROXY=true/.test(unsafeProxy.stderr+unsafeProxy.stdout));
 tsx(["script/seed-demo.ts"]);
 await startServer();
 check("Server listens on loopback by default",/serving on 127\.0\.0\.1:/.test(log));

 // ---- headers ----
 const page=await call("GET","/");
 const csp=page.headers.get("content-security-policy")||"";
 check("App page sends a Content-Security-Policy",/script-src 'self'/.test(csp)&&/frame-ancestors 'none'/.test(csp)&&/object-src 'none'/.test(csp));
 check("App page forbids framing and MIME sniffing",page.headers.get("x-frame-options")==="DENY"&&page.headers.get("x-content-type-options")==="nosniff");
 check("X-Powered-By is not sent",!page.headers.has("x-powered-by"));
 check("No HSTS over plain HTTP",!page.headers.has("strict-transport-security"));
 const viaHttps=await call("GET","/api/auth/status",undefined,{});
 const httpsHeaders=await fetch(base+"/api/auth/status",{headers:{"X-Forwarded-Proto":"https"}});
 check("HSTS sent when the trusted proxy reports HTTPS",(httpsHeaders.headers.get("strict-transport-security")||"").includes("max-age=")&&viaHttps.headers.get("cache-control")==="no-store");
 check("App page loads no Google Fonts",!/fonts\.googleapis|fonts\.gstatic/.test(page.text));
 check("Pinch zoom is allowed",!/maximum-scale/.test(page.text));

 // ---- accounts ----
 const ownerEmail="owner@example.invalid";
 tsx(["script/bootstrap-owner.ts",ownerEmail,join(work,"owner.json")]);
 const invite=JSON.parse(readFileSync(join(work,"owner.json"),"utf8")),ownerPassword=password();
 const owner=(await ok("POST","/api/auth/activate",{email:ownerEmail,activationCode:invite.activationCode,password:ownerPassword})).token;
 const staff={};
 for(const [role,extra] of [["advisor",{}],["support",{}],["technician",{technicianId:1}],["manager",{}],["accountant",{}],["auditor",{}]]){
  const email=`${role}@example.invalid`,r=await ok("POST","/api/staff",{email,fullName:`Test ${role}`,role,...extra},{token:owner});
  staff[role]=(await ok("POST","/api/auth/activate",{email,activationCode:r.activationCode,password:password()})).token;
 }
 check("Owner, advisor, support, technician, manager, accountant and auditor test accounts active",Object.values(staff).every(Boolean)&&!!owner);

 // ---- login lockout is per email and address ----
 for(let i=0;i<5;i++){const r=await call("POST","/api/auth/login",{email:ownerEmail,password:"wrong-password-attempt"},{ip:"10.0.0.1"});assert.equal(r.status,401);}
 check("Five failures lock that email from that address",(await call("POST","/api/auth/login",{email:ownerEmail,password:ownerPassword},{ip:"10.0.0.1"})).status===429);
 check("The same account can still sign in from another address",(await call("POST","/api/auth/login",{email:ownerEmail,password:ownerPassword},{ip:"10.0.0.2"})).status===200);
 for(let i=0;i<6;i++)await call("POST","/api/auth/login",{email:`${ownerEmail}:10.0.0.3`,password:"wrong-password-attempt"},{ip:"10.0.0.4"});
 check("A crafted email cannot lock the owner out of another address (no key collision)",(await call("POST","/api/auth/login",{email:ownerEmail,password:ownerPassword},{ip:"10.0.0.3"})).status===200);

 // ---- unauthenticated throttling without per-request audit rows ----
 const statuses=[];for(let i=0;i<125;i++)statuses.push((await call("GET","/api/invoices",undefined,{ip:"10.0.0.9"})).status);
 check("Unauthenticated requests receive 401 up to the limit",statuses.slice(0,120).every(s=>s===401));
 check("Repeated unauthenticated requests are throttled with 429",statuses.slice(120).every(s=>s===429));
 check("Other addresses are not throttled",(await call("GET","/api/invoices",undefined,{ip:"10.0.0.10"})).status===401);
 check("A stale session token from a throttled address still gets 401 (returns to sign-in)",(await call("GET","/api/invoices",undefined,{ip:"10.0.0.9",token:randomBytes(32).toString("base64url")})).status===401);

 // ---- mass assignment ----
 const c1=(await ok("GET","/api/customers",undefined,{token:owner}))[0];
 check("Customer number cannot be set on create",(await call("POST","/api/customers",{companyName:"Guard test",customerType:"retail",customerNumber:"CUST-999",confirmDuplicate:true},{token:owner})).status===400);
 check("Customer id cannot be set on create",(await call("POST","/api/customers",{companyName:"Guard test",customerType:"retail",id:9999,confirmDuplicate:true},{token:owner})).status===400);
 const created=await ok("POST","/api/customers",{companyName:"Guard test",customerType:"retail",confirmDuplicate:true},{token:owner});
 check("Normal customer create still works with server numbering",/^CUST-\d+$/.test(created.customerNumber));
 check("Customer number cannot be changed",(await call("PATCH",`/api/customers/${c1.id}`,{customerNumber:"CUST-X"},{token:owner})).status===400);
 check("Created date cannot be changed",(await call("PATCH",`/api/customers/${c1.id}`,{createdAt:"2000-01-01"},{token:owner})).status===400);
 check("Non-text values are rejected for text fields",(await call("PATCH",`/api/customers/${c1.id}`,{email:{$ne:1}},{token:owner})).status===400);
 const edited=await ok("PATCH",`/api/customers/${c1.id}`,{notes:"Edited by security check",notAColumn:1},{token:owner});
 check("Normal customer edit still works and ignores non-column keys",edited.notes==="Edited by security check"&&!("notAColumn" in edited));
 // ---- permissions: customer tax terms (PERM-01) and internal costs (PERM-02) ----
 const roles=await ok("GET","/api/staff/roles",undefined,{token:owner});
 const holders=p=>Object.keys(roles).filter(r=>roles[r].permissions.includes(p)).sort().join(",");
 check("Only owner, admin, manager and accounting hold customers.tax_terms",holders("customers.tax_terms")==="accountant,admin,manager,owner");
 check("Only owner, admin, manager, accounting and auditor hold costs.read",holders("costs.read")==="accountant,admin,auditor,manager,owner");
 const generalPatch=async(token,body)=>(await call("PATCH",`/api/customers/${c1.id}`,body,{token})).status;
 check("Owner can change tax-exempt status",await generalPatch(owner,{taxExempt:1})===200);
 check("Manager can change tax-exempt status and credit limit",await generalPatch(staff.manager,{taxExempt:0,creditLimit:2500})===200);
 for(const role of ["advisor","support","technician","auditor"]){
  check(`${role} cannot change tax-exempt status`,await generalPatch(staff[role],{taxExempt:1})===403);
  check(`${role} cannot change credit limit`,await generalPatch(staff[role],{creditLimit:99999})===403);
 }
 check("Advisor can still edit ordinary customer details",await generalPatch(staff.advisor,{notes:"Advisor edit"})===200);
 const taxTerms=async(token,body)=>call("PATCH",`/api/customers/${c1.id}/tax-terms`,body,{token});
 check("Accounting can change tax-exempt status through the tax-terms endpoint",(await taxTerms(staff.accountant,{taxExempt:true})).status===200&&(await ok("GET",`/api/customers/${c1.id}`,undefined,{token:owner})).taxExempt===1);
 check("Accounting can change credit limit through the tax-terms endpoint",(await taxTerms(staff.accountant,{creditLimit:750.5})).data.creditLimit===750.5);
 check("Accounting still cannot edit other customer details",await generalPatch(staff.accountant,{notes:"x"})===403);
 for(const role of ["advisor","support","technician","auditor"])check(`${role} cannot use the tax-terms endpoint`,(await taxTerms(staff[role],{taxExempt:false})).status===403);
 check("Tax-terms endpoint rejects other fields",(await taxTerms(staff.accountant,{taxExempt:false,notes:"x"})).status===400);
 check("Tax-terms endpoint rejects invalid values",(await taxTerms(staff.accountant,{taxExempt:"yes"})).status===400&&(await taxTerms(staff.accountant,{creditLimit:-5})).status===400);
 check("Advisor cannot set a third-party payer tax-exempt",(await call("POST","/api/third-party-payers",{customerId:c1.id,payerType:"insurance",payerName:"Guard payer",taxExempt:1},{token:staff.advisor})).status===403);
 await ok("PATCH",`/api/customers/${c1.id}/tax-terms`,{taxExempt:false},{token:staff.manager});
 const v1=(await ok("GET","/api/vehicles",undefined,{token:owner}))[0];
 check("A vehicle cannot be moved to another customer by PATCH",(await call("PATCH",`/api/vehicles/${v1.id}`,{customerId:created.id},{token:owner})).status===400);
 check("Job number cannot be supplied by the client",(await call("POST","/api/jobs",{customerId:c1.id,serviceType:"pdr",title:"Guard",jobNumber:"JOB-HACK"},{token:owner})).status===400);
 const job=await ok("POST","/api/jobs",{customerId:c1.id,serviceType:"pdr",title:"Guard job",status:"pending",priority:"normal"},{token:owner});
 check("Normal job create still assigns a server job number",/^JOB-\d{4}-\d+$/.test(job.jobNumber));
 check("Technician account link cannot be set through the technician API",(await call("PATCH","/api/technicians/1",{userId:5},{token:owner})).status===400);
 check("Booking number cannot be changed",(await call("PATCH","/api/bookings/1",{bookingNumber:"BK-X"},{token:owner})).status===400);
 const activity=await ok("POST","/api/activities",{customerId:c1.id,activityType:"note",description:"Guard note",performedBy:"Someone Else"},{token:staff.advisor});
 check("Activity author is always the signed-in user",activity.performedBy==="Test advisor");

 // ---- purchase-cost privacy ----
 const SECRET="SECRET-COST-NOTE-7731";
 const cust=await ok("POST","/api/customers",{companyName:"Cost privacy test",customerType:"retail",confirmDuplicate:true},{token:owner});
 const veh=await ok("POST","/api/vehicles",{customerId:cust.id,vehicleType:"auto",make:"Synthetic",model:"Test"},{token:owner});
 const est=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"pdr",vehicleId:veh.id,taxRate:6},{token:owner});
 const labor=await ok("POST",`/api/estimates/${est.id}/line-items`,{serviceCategory:"labor",description:"Repair labor",unitPrice:200},{token:owner});
 await ok("POST",`/api/estimates/${est.id}/line-items`,{serviceCategory:"material",description:"Material",quantity:2,unitPrice:50,unitCost:17.25},{token:owner});
 await ok("POST",`/api/estimates/${est.id}/line-items`,{serviceCategory:"supplies",description:"Consumed supplies",unitPrice:0,unitCost:10,useTaxRate:6,taxNote:SECRET},{token:owner});
 await ok("PATCH",`/api/estimates/line-items/${labor.id}/classification`,{expectedVersion:1,lineType:"labor",splits:[{technicianId:1,shareBps:10000}]},{token:owner});
 await ok("PATCH",`/api/estimates/${est.id}`,{status:"approved"},{token:owner});
 const inv=await ok("POST",`/api/estimates/${est.id}/convert-invoice`,{},{token:owner});
 const ownerView=await call("GET",`/api/invoices/${inv.id}`,undefined,{token:owner});
 check("Owner (cost access) still sees purchase costs and notes",ownerView.text.includes(SECRET)&&keysOf(ownerView.data).has("unitCost"));
 const claim=await ok("POST","/api/warranty-claims",{customerId:cust.id,claimNumber:"WC-SEC-1",claimDate:"2026-10-01",status:"open",issueDescription:"Guard claim",claimCost:432.1},{token:owner});
 for(const role of ["manager","accountant","auditor"])check(`${role} (cost access) sees warranty claim cost`,(await ok("GET",`/api/warranty-claims/${claim.id}`,undefined,{token:staff[role]})).claimCost===432.1);
 const COST_KEYS=["claimCost","claim_cost","unitCost","unit_cost","useTaxRate","use_tax_rate","taxNote","tax_note","estimatedCost","estimated_cost","useTax","use_tax","costs","costsCents","costCents","useTaxCents"];
 const ids={c:cust.id,v:veh.id,e:est.id,i:inv.id,j:job.id,w:claim.id};
 const endpoints=["/api/customers","/api/customers/{c}","/api/customers/lookup?q=Cost","/api/vehicles","/api/vehicles/{v}","/api/assets","/api/jobs","/api/jobs/{j}","/api/jobs/{j}/detail",
  "/api/estimates","/api/estimates/{e}","/api/estimates/{e}/labor","/api/estimates/{e}/planning","/api/estimates/{e}/sales-team","/api/invoices","/api/invoices/{i}","/api/invoices/{i}/labor",
  "/api/invoices/{i}/commercial","/api/payments","/api/operations","/api/operations/owners","/api/dashboard","/api/my-work","/api/reports/commercial","/api/service-history/customer/{c}",
  "/api/activities","/api/pricing-matrices","/api/service-templates","/api/capacity","/api/delivery/estimate/{e}","/api/delivery/invoice/{i}","/print/estimate/{e}","/print/invoice/{i}","/api/warranty-claims","/api/warranty-claims/{w}"].map(p=>p.replace(/\{(\w)\}/g,(_,k)=>ids[k]));
 for(const role of ["advisor","support","technician"]){
  let readable=0,leaks=[];
  for(const path of endpoints){
   const r=await call("GET",path,undefined,{token:staff[role]});
   if(r.status!==200)continue;readable++;
   if(r.text.includes(SECRET))leaks.push(`${path}: note text`);
   const found=COST_KEYS.filter(k=>keysOf(r.data).has(k));if(found.length)leaks.push(`${path}: ${found.join(",")}`);
  }
  check(`${role}: no purchase costs, warranty claim costs or cost notes in ${readable} readable endpoints${leaks.length?" — "+leaks.join("; "):""}`,readable>0&&leaks.length===0);
 }
 const history=await ok("GET","/api/service-history/customer/1",undefined,{token:staff.advisor});
 check("Advisor still sees the customer charge on service history (allowlisted 'cost')",history.length>0&&history.every(h=>"cost" in h));

 // ---- print pages and CSP hashes ----
 for(const path of [`/print/invoice/${inv.id}`,`/print/estimate/${est.id}`,"/print/pricing-matrices"]){
  const r=await call("GET",path,undefined,{token:owner}),pageCsp=r.headers.get("content-security-policy")||"";
  const scripts=inlineScripts(r.text);
  check(`${path}: every inline script is allowed by the CSP hash`,scripts.length>0&&scripts.every(s=>pageCsp.includes(sha(s))&&csp.includes(sha(s))));
  check(`${path}: no inline event handlers`,!/\son[a-z]+="/i.test(r.text));
 }

 // ---- email copies: temporary test copies vs. retained records (MAIL-01) ----
 const testDir=join(emails,"test-copies"),recordDir=join(emails,"sent-records");
 mkdirSync(testDir,{recursive:true});mkdirSync(recordDir,{recursive:true});
 const age=(file,days)=>{const t=(Date.now()-days*86400000)/1000;utimesSync(file,t,t);};
 const legacy=join(emails,"invoice-LEGACY.html"),oldTest=join(testDir,"invoice-OLDTEST.html"),recentTest=join(testDir,"invoice-RECENT.html"),record=join(recordDir,"invoice-CUSTOMER.html"),other=join(testDir,"keep-me.txt");
 for(const f of [legacy,oldTest,recentTest,record,other])writeFileSync(f,"x");
 age(legacy,400);age(oldTest,40);age(recentTest,5);age(record,400);age(other,40);
 await ok("POST",`/api/invoices/${inv.id}/email`,{},{token:owner});
 const est2=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"pdr",vehicleId:veh.id,taxRate:6},{token:owner});
 await ok("POST",`/api/estimates/${est2.id}/line-items`,{serviceCategory:"labor",description:"Repair labor",unitPrice:150},{token:owner});
 const sent=await call("POST",`/api/estimates/${est2.id}/send`,{},{token:owner});
 check("Estimate email still renders from its print page (internal server call)",sent.status===200&&readdirSync(testDir).some(f=>f.startsWith(`estimate-${est2.estimateNumber}`)));
 const copy=readdirSync(testDir).find(f=>f.startsWith(`invoice-${inv.invoiceNumber}`));
 check("Test-mailbox email copy is saved as a temporary copy with owner-only permissions",!!copy&&(statSync(join(testDir,copy)).mode&0o777)===0o600);
 check("Temporary test copies older than 30 days are removed",!existsSync(oldTest));
 check("Recent test copies and non-email files are kept",existsSync(recentTest)&&existsSync(other));
 check("Customer-facing sent records are never deleted automatically",existsSync(record));
 check("Email copies saved before this change are preserved",existsSync(legacy));
 const probe=join(work,"mail-probe.ts"),probeOut=join(work,"mail-probe-out");
 writeFileSync(probe,`import {saveEmailCopy,testCopyRetentionDays} from ${JSON.stringify(join(root,"server","delivery-config.ts"))};
console.log(JSON.stringify({customer:saveEmailCopy("invoice-A.html","<p>a</p>","customer@example.invalid"),mixed:saveEmailCopy("invoice-B.html","<p>b</p>","customer@example.invalid, service@mcdowellsrepair.com"),test:saveEmailCopy("invoice-C.html","<p>c</p>","Service@McDowellsRepair.com"),
 days:[testCopyRetentionDays(undefined),testCopyRetentionDays(""),testCopyRetentionDays("0"),testCopyRetentionDays("7"),testCopyRetentionDays("abc")]}));`);
 const probed=JSON.parse(tsx([probe],{...devEnv,EMAIL_OUTPUT_DIR:probeOut}).toString().trim().split("\n").pop());
 check("Copies to a customer address are classified as retained records",probed.customer.includes("/sent-records/")&&probed.mixed.includes("/sent-records/"));
 check("Copies only to the test mailbox are classified as temporary",probed.test.includes("/test-copies/"));
 check("Retention default is 30 days; 0 or invalid keeps copies",JSON.stringify(probed.days)==="[30,30,0,7,0]");

 // ---- encrypted backups ----
 if(child.exitCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}
 child=null;
 const backups=join(work,"backups");
 check("Backup without a key is refused",node(["handoff/database.mjs","backup",dbPath,join(backups,"plain.db")]).status!==0&&!existsSync(join(backups,"plain.db")));
 check("Explicitly unencrypted backup still works",node(["handoff/database.mjs","backup",dbPath,join(backups,"plain.db"),"--allow-unencrypted"]).status===0);
 const key=node(["handoff/database.mjs","keygen"]).stdout.trim(),keyed={...devEnv,BACKUP_ENCRYPTION_KEY:key};
 check("keygen prints a 256-bit key",/^[0-9a-f]{64}$/.test(key));
 const enc=join(backups,"backup.enc");
 check("Encrypted backup succeeds",node(["handoff/database.mjs","backup",dbPath,enc],keyed).status===0);
 const encBytes=readFileSync(enc);
 check("Encrypted backup is not readable as SQLite and leaves no plain copy",encBytes.subarray(0,6).toString()==="RPBK1\n"&&!encBytes.includes(Buffer.from("SQLite format 3"))&&!encBytes.includes(Buffer.from(SECRET))&&readdirSync(backups).every(f=>!f.includes(".plain-")));
 check("Encrypted backup has owner-only permissions",(statSync(enc).mode&0o777)===0o600);
 const restored=join(backups,"restored.db");
 check("Backup decrypts and passes integrity checks",node(["handoff/database.mjs","decrypt",enc,restored],keyed).status===0&&new Database(restored,{readonly:true}).prepare("SELECT COUNT(*) n FROM customers").get().n>0);
 const wrongKey={...devEnv,BACKUP_ENCRYPTION_KEY:randomBytes(32).toString("hex")};
 check("Wrong key cannot decrypt and leaves no output file",node(["handoff/database.mjs","decrypt",enc,join(backups,"wrong.db")],wrongKey).status!==0&&!existsSync(join(backups,"wrong.db"))&&!existsSync(join(backups,"wrong.db.partial")));
 const tampered=join(backups,"tampered.enc");const t=Buffer.from(encBytes);t[t.length-40]^=1;writeFileSync(tampered,t);
 check("Modified backup is rejected",node(["handoff/database.mjs","decrypt",tampered,join(backups,"tampered.db")],keyed).status!==0&&!existsSync(join(backups,"tampered.db")));
 tsx(["script/migrate.ts"],keyed);
 const pre=readdirSync(work).filter(f=>f.startsWith("security.db.pre-migrate-"));
 check("db:migrate writes only an encrypted pre-migration backup when a key is set",pre.length===1&&pre[0].endsWith(".bak.enc"));

 const db=new Database(dbPath,{readonly:true});
 const auditCount=e=>db.prepare("SELECT COUNT(*) n FROM security_audit WHERE event=?").get(e).n;
 check("Rejected anonymous requests are not audited one by one",auditCount("access.unauthenticated")===0);
 check("Throttling is recorded once per address",auditCount("access.unauthenticated_throttled")===1);
 db.close();
 const report={status:"PASS",checks,scope:"Phase 1 security controls on a temporary demo database",node:process.version,results};
 console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e.stack);if(log)console.error(log.slice(-3000));process.exitCode=1;}
finally{
 if(child&&child.exitCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}
 rmSync(work,{recursive:true,force:true});
}
