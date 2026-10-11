// Phase 2.1 estimating regression suite: saved individual dent records, the line items they
// produce, locks, permissions, audit history, customer creation and VIN-only vehicles.
// Temporary demo database only; never an operating database. Requires a build (dist/).
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Database=require("better-sqlite3");
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5191);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local test port");
const base=`http://127.0.0.1:${port}`;
try{await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});throw Error("Test port is already occupied; choose HANDOFF_TEST_PORT");}catch(e){if(e.message.includes("already occupied"))throw e;}
const work=mkdtempSync(join(tmpdir(),"repairpro-estimating-"));
const dbPath=join(work,"estimating.db");
const env={...process.env,DB_PATH:dbPath,EMAIL_OUTPUT_DIR:join(work,"emails"),PORT:String(port),NODE_ENV:"production",SMTP_USER:"",SMTP_PASS:"",SMTP_HOST:"",BACKUP_ENCRYPTION_KEY:""};
delete env.HOST;delete env.TRUST_PROXY;
const {NODE_ENV:_p,...devEnv}=env;
const results=[];let checks=0,child,log="";
function check(name,value){assert.ok(value,name);checks++;results.push({name,passed:true});}
const tsx=args=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:root,env:devEnv,stdio:"pipe"});
let token;
async function call(method,path,body,as=token){
 const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(as?{Authorization:`Bearer ${as}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await r.text();let data=text;try{data=JSON.parse(text);}catch{}
 return {status:r.status,data,text};
}
async function ok(method,path,body,as){const r=await call(method,path,body,as);assert.ok(r.status===200||r.status===201,`${method} ${path}: ${r.status} ${r.text.slice(0,300)}`);return r.data;}
const password=()=>"Pp-"+randomBytes(18).toString("base64url");
async function startServer(){
 log="";child=spawn(process.execPath,["dist/index.cjs"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{log+=b;});child.stderr.on("data",b=>{log+=b;});
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw Error("Server failed:\n"+log);
  try{const r=await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});if(r.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error("Server did not start:\n"+log);
}
async function stopServer(){if(child&&child.exitCode===null&&child.signalCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}}
// Every pre-existing estimate, line and invoice exactly as stored (money and identity).
const snapshot=db=>JSON.stringify({
 estimates:db.prepare("SELECT id,estimate_number,status,subtotal,tax_rate,tax_amount,discount,total,invoice_id FROM estimates ORDER BY id").all(),
 lines:db.prepare("SELECT id,estimate_id,description,quantity,unit_price,total,line_type,service_category FROM estimate_line_items ORDER BY id").all(),
 invoices:db.prepare("SELECT id,invoice_number,subtotal,tax_amount,discount,total,amount_paid,balance_due,status FROM invoices ORDER BY id").all(),
});
try{
 tsx(["script/seed-demo.ts"]);
 // ---- upgrade: a database from before Phase 2.1 gains the dent table without any other change ----
 let db=new Database(dbPath);
 db.exec("DROP TRIGGER IF EXISTS estimate_dents_lock_insert;DROP TRIGGER IF EXISTS estimate_dents_lock_update;DROP TRIGGER IF EXISTS estimate_dents_lock_delete;DROP TRIGGER IF EXISTS estimate_dents_estimate_fixed;");
 for(const op of ["insert","update","delete"])db.exec(`DROP TRIGGER IF EXISTS staff_audit_estimate_dents_${op}`);
 db.exec("DROP TABLE IF EXISTS estimate_dents");
 const before=snapshot(db);db.close();
 await startServer();
 db=new Database(dbPath,{readonly:true});
 check("Upgrade creates the dent table on an existing database",!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='estimate_dents'").get());
 check("Upgrade adds dent locks and row-level audit triggers",["estimate_dents_lock_insert","estimate_dents_lock_update","estimate_dents_lock_delete","staff_audit_estimate_dents_insert","staff_audit_estimate_dents_update","staff_audit_estimate_dents_delete"].every(t=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(t)));
 check("Upgrade leaves every existing estimate, line and invoice unchanged",snapshot(db)===before);
 check("Existing estimates have no invented dent records",db.prepare("SELECT COUNT(*) n FROM estimate_dents").get().n===0);
 db.close();

 // ---- accounts ----
 const ownerEmail="owner@example.invalid";
 tsx(["script/bootstrap-owner.ts",ownerEmail,join(work,"owner.json")]);
 const invite=JSON.parse(readFileSync(join(work,"owner.json"),"utf8"));
 const owner=(await ok("POST","/api/auth/activate",{email:ownerEmail,activationCode:invite.activationCode,password:password()})).token;
 const staff={};
 for(const [role,extra] of [["advisor",{}],["technician",{technicianId:1}],["auditor",{}]]){
  const email=`${role}@example.invalid`,r=await ok("POST","/api/staff",{email,fullName:`Test ${role}`,role,...extra},owner);
  staff[role]=(await ok("POST","/api/auth/activate",{email,activationCode:r.activationCode,password:password()})).token;
 }
 token=staff.advisor;

 // ---- New Estimate: create a customer, duplicate check, VIN-only vehicle ----
 const cust=await ok("POST","/api/customers",{customerType:"retail",firstName:"Dana",lastName:"Phase-Two",phone:"555-010-2101",status:"active"});
 check("Advisor can create a customer from New Estimate",cust.id>0&&/^CUST-/.test(cust.customerNumber));
 const dup=await call("POST","/api/customers",{customerType:"retail",firstName:"Dana",lastName:"Phase-Two",phone:"555-010-2101",status:"active"});
 check("Likely duplicate customer is refused until confirmed",dup.status===409&&dup.data.duplicate===true&&dup.data.matches.some(m=>m.id===cust.id));
 const dup2=await ok("POST","/api/customers",{customerType:"retail",firstName:"Dana",lastName:"Phase-Two",phone:"555-010-2101",status:"active",confirmDuplicate:true});
 check("Confirmed different customer is created separately",dup2.id!==cust.id);
 check("New Estimate customer creation cannot set tax-exempt status",(await call("POST","/api/customers",{customerType:"retail",firstName:"Tax",lastName:"Probe",taxExempt:1,status:"active"})).status===403);
 const vin="1HGCV1F30LA000001";
 const vinOnly=await ok("POST","/api/vehicles",{customerId:cust.id,vehicleType:"auto",vin});
 check("A vehicle can be saved with only its VIN",vinOnly.id>0&&vinOnly.vin===vin&&!vinOnly.make&&!vinOnly.model&&vinOnly.customerId===cust.id);
 check("The same VIN twice on one customer is still refused",(await call("POST","/api/vehicles",{customerId:cust.id,vehicleType:"auto",vin:vin.toLowerCase()})).status===409);
 const otherOwner=await ok("POST","/api/vehicles",{customerId:dup2.id,vehicleType:"auto",vin});
 check("The same VIN on a different customer is allowed (prior owner); records are not merged",otherOwner.customerId===dup2.id&&otherOwner.id!==vinOnly.id&&(await ok("GET",`/api/vehicles/${vinOnly.id}`)).customerId===cust.id);
 const est=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"pdr",vehicleId:vinOnly.id,taxRate:6});
 check("New estimate is linked to the VIN-only vehicle and customer",(await ok("GET",`/api/estimates/${est.id}`)).vehicleId===vinOnly.id);
 const v2=await ok("POST","/api/vehicles",{customerId:cust.id,vehicleType:"auto",year:"2019",make:"Honda",model:"Accord"});
 await ok("PATCH",`/api/estimates/${est.id}`,{vehicleId:v2.id});
 check("A vehicle added from the estimate stays linked when the estimate is reopened",(await ok("GET",`/api/estimates/${est.id}`)).vehicleId===v2.id);
 check("A vehicle belonging to another customer cannot be linked",(await call("PATCH",`/api/estimates/${est.id}`,{vehicleId:otherOwner.id})).status===400);

 // ---- dent records: validation ----
 const ep=`/api/estimates/${est.id}`;
 const hood={panelId:"hood",panelName:"Hood",bodyStyle:"sedan"};
 const bad=async(body,status=400)=>(await call("POST",ep+"/dents",body)).status===status;
 check("Unknown sizes, severities, difficulties and paint answers are rejected",
  await bad({...hood,size:"golfball"})&&await bad({...hood,size:"dime",severity:"severe"})&&await bad({...hood,size:"dime",locationDifficulty:"hard"})&&await bad({...hood,size:"dime",paintCorrectable:"maybe"}));
 check("Length must be a whole number from 1 to 36 inches",await bad({...hood,size:"dime",lengthIn:0})&&await bad({...hood,size:"dime",lengthIn:37})&&await bad({...hood,size:"dime",lengthIn:2.5}));
 check("A crease requires its length",await bad({...hood,size:"crease"}));
 check("Unsupported fields (such as a price) are rejected",await bad({...hood,size:"dime",matrixUnitPrice:1})&&await bad({...hood,size:"dime",lineItemId:1}));
 check("Notes are limited to 2,000 characters",await bad({...hood,size:"dime",notes:"x".repeat(2001)}));
 const d1=await ok("POST",ep+"/dents",{...hood,size:"dime",lengthIn:1,severity:"shallow",locationDifficulty:"easy",paintCorrectable:"yes",notes:"Near the cowl; internal note"});
 const d2=await ok("POST",ep+"/dents",{...hood,size:"dime"});
 const d3=await ok("POST",ep+"/dents",{...hood,size:"crease",lengthIn:12,severity:"deep",locationDifficulty:"extreme",paintCorrectable:"no"});
 const d4=await ok("POST",ep+"/dents",{panelId:"rf-door",panelName:"RF Door",bodyStyle:"sedan",size:"nickel",severity:"medium"});
 const saved=await ok("GET",ep+"/dents");
 check("Each dent is saved separately with all of its details",saved.length===4&&saved[0].id===d1.id&&saved[0].lengthIn===1&&saved[0].severity==="shallow"&&saved[0].locationDifficulty==="easy"&&saved[0].paintCorrectable==="yes"&&saved[0].notes==="Near the cowl; internal note"&&saved[2].size==="crease"&&saved[2].lengthIn===12);
 check("Saving dents does not change estimate money",(await ok("GET",ep)).subtotal===0);
 await ok("PATCH",`/api/estimates/dents/${d2.id}`,{severity:"medium",notes:"  trimmed  "});
 check("Dent details can be edited and are stored trimmed",(await ok("GET",ep+"/dents")).find(d=>d.id===d2.id).notes==="trimmed");
 check("Turning a dent into a crease requires a length",(await call("PATCH",`/api/estimates/dents/${d2.id}`,{size:"crease"})).status===400);
 const tint=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"window_tint",vehicleId:v2.id,taxRate:6});
 check("Dent records are refused on non-PDR estimates",(await call("POST",`/api/estimates/${tint.id}/dents`,{...hood,size:"dime"})).status===400);
 const hail=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"hail",vehicleId:v2.id,taxRate:6});
 check("Hail estimates keep their existing per-panel entry (no dent records)",(await call("POST",`/api/estimates/${hail.id}/dents`,{...hood,size:"dime"})).status===400);

 // ---- permissions ----
 check("Technician cannot create or edit dent records",(await call("POST",ep+"/dents",{...hood,size:"dime"},staff.technician)).status===403&&(await call("PATCH",`/api/estimates/dents/${d1.id}`,{notes:"x"},staff.technician)).status===403);
 check("Auditor can read but not change dent records",(await call("GET",ep+"/dents",undefined,staff.auditor)).status===200&&(await call("DELETE",`/api/estimates/dents/${d1.id}`,undefined,staff.auditor)).status===403);
 check("Signed-out requests cannot read dent records",(await call("GET",ep+"/dents",undefined,null)).status===401);

 // ---- billing: one line per panel and size, standard matrix price ----
 const matrices=await ok("GET","/api/pricing-matrices");
 const price=size=>matrices.find(m=>m.matrixType==="pdr_dent"&&m.sizeCategory===size&&m.vehicleCategory==="sedan").price;
 check("Mixed panel or size groups are refused",(await call("POST",ep+"/dents/bill",{groups:[{dentIds:[d1.id,d4.id],unitPrice:10}]})).status===400);
 check("A crease cannot be added without an entered price",(await call("POST",ep+"/dents/bill",{groups:[{dentIds:[d3.id],unitPrice:0}]})).status===400);
 check("A dent cannot be counted twice in one request",(await call("POST",ep+"/dents/bill",{groups:[{dentIds:[d1.id,d1.id],unitPrice:price("dime")}]})).status===400);
 const billed=await ok("POST",ep+"/dents/bill",{groups:[
  {dentIds:[d1.id,d2.id],unitPrice:price("dime")},
  {dentIds:[d3.id],unitPrice:150,priceConfirmed:true},
  {dentIds:[d4.id],unitPrice:55},
 ]});
 const after=await ok("GET",ep),lines=after.lineItems;
 const hoodLine=lines.find(l=>l.description==="Hood: Dime dent"),creaseLine=lines.find(l=>l.description==="Hood: crease"),doorLine=lines.find(l=>l.description==="RF Door: Nickel dent");
 check("Dents become one line per panel and size (quantity = dent count)",billed.created===3&&hoodLine?.quantity===2&&creaseLine?.quantity===1&&doorLine?.quantity===1);
 check("Standard dents bill at the existing matrix price",hoodLine.unitPrice===price("dime")&&hoodLine.total===Math.round(price("dime")*2*100)/100&&hoodLine.serviceCategory==="pdr_dent"&&hoodLine.lineType==="labor");
 check("Crease bills at the entered price only",creaseLine.unitPrice===150&&creaseLine.damageSize==="crease");
 const expectSub=Math.round((price("dime")*2+150+55)*100)/100;
 check("Estimate subtotal, tax and total follow the existing calculation",after.subtotal===expectSub&&after.taxAmount===0&&after.total===expectSub);
 const dents=await ok("GET",ep+"/dents");
 const byId=Object.fromEntries(dents.map(d=>[d.id,d]));
 check("Each dent links to its line and keeps its matrix-calculated price",byId[d1.id].lineItemId===hoodLine.id&&byId[d2.id].lineItemId===hoodLine.id&&byId[d1.id].matrixUnitPrice===price("dime")&&byId[d3.id].lineItemId===creaseLine.id&&byId[d3.id].matrixUnitPrice===null);
 check("An entered price keeps the matrix price for reference",byId[d4.id].matrixUnitPrice===price("nickel")&&/estimator entered 55\.00/.test(byId[d4.id].priceSource));
 check("Dents already on a line cannot be added again",(await call("POST",ep+"/dents/bill",{groups:[{dentIds:[d1.id],unitPrice:price("dime")}]})).status===409);

 // ---- billed dents and their lines stay in step ----
 check("A billed dent's size and panel are locked",(await call("PATCH",`/api/estimates/dents/${d1.id}`,{size:"quarter"})).status===409&&(await call("PATCH",`/api/estimates/dents/${d1.id}`,{panelId:"roof",panelName:"Roof"})).status===409);
 check("A billed dent cannot be deleted",(await call("DELETE",`/api/estimates/dents/${d1.id}`)).status===409);
 check("A dent-backed line's quantity cannot drift from its dents",(await call("PATCH",`/api/estimates/line-items/${hoodLine.id}`,{expectedVersion:hoodLine.allocationVersion,quantity:5})).status===409);
 const repriced=await ok("PATCH",`/api/estimates/line-items/${doorLine.id}`,{expectedVersion:doorLine.allocationVersion,unitPrice:60});
 check("A dent-backed line's price can still be edited",repriced.unitPrice===60&&(await ok("GET",ep)).subtotal===Math.round((price("dime")*2+150+60)*100)/100);

 // ---- approval behaviour ----
 const techs=(await ok("GET","/api/technicians")).filter(t=>t.status==="active");
 for(const l of (await ok("GET",ep)).lineItems)
  await ok("PATCH",`/api/estimates/line-items/${l.id}/classification`,{expectedVersion:l.allocationVersion,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:10000}]});
 await ok("PATCH",ep,{status:"approved"});
 await ok("PATCH",`/api/estimates/dents/${d1.id}`,{notes:"Detail-only change",lengthIn:2,paintCorrectable:"no"});
 check("Detail-only dent edits keep an approved estimate approved",(await ok("GET",ep)).status==="approved");
 const d5=await ok("POST",ep+"/dents",{panelId:"roof",panelName:"Roof",bodyStyle:"sedan",size:"quarter"});
 check("Saving a new unbilled dent does not change approval or money",(await ok("GET",ep)).status==="approved");
 await ok("POST",ep+"/dents/bill",{groups:[{dentIds:[d5.id],unitPrice:price("quarter")}]});
 check("Adding dents to the estimate requires approval again (as for any line)",(await ok("GET",ep)).status==="draft");

 // ---- removing a line keeps its dents ----
 const roofLine=(await ok("GET",ep)).lineItems.find(l=>l.description==="Roof: Quarter dent");
 await ok("DELETE",`/api/estimates/line-items/${roofLine.id}`);
 const roof=(await ok("GET",ep+"/dents")).find(d=>d.id===d5.id);
 check("Removing a line keeps its dent records, now not yet added",roof&&roof.lineItemId===null);
 await ok("DELETE",`/api/estimates/dents/${d5.id}`);
 check("An unbilled dent can be deleted",(await ok("GET",ep+"/dents")).every(d=>d.id!==d5.id));

 // ---- audit history ----
 db=new Database(dbPath,{readonly:true});
 const auditRows=db.prepare("SELECT event,actor_label,before_json,after_json FROM security_audit WHERE entity='estimate_dents' AND record_id=?").all(String(d1.id));
 check("Every dent change is in the append-only audit history with the staff member",auditRows.some(r=>r.event==="record.insert")&&auditRows.some(r=>r.event==="record.update"&&/Detail-only change/.test(r.after_json))&&auditRows.every(r=>/advisor/i.test(r.actor_label)));
 check("Adding dents to the estimate is audited with the dents and prices",!!db.prepare("SELECT 1 FROM security_audit WHERE event='estimate.dents_billed' AND record_id=?").get(String(est.id)));
 db.close();

 // ---- invoiced: dents are locked like the estimate ----
 for(const l of (await ok("GET",ep)).lineItems.filter(l=>!l.lineType||l.lineType==="labor"))
  if(!(await ok("GET",`${ep}/labor`)).some(a=>a.line_id===l.id))await ok("PATCH",`/api/estimates/line-items/${l.id}/classification`,{expectedVersion:l.allocationVersion,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:10000}]});
 const me=await ok("GET","/api/auth/me");
 await ok("PUT",ep+"/sales-team",{version:1,splits:[{staffId:me.user?.id||me.id,shareBps:10000}]});
 await ok("PATCH",ep,{status:"approved"});
 const inv=await ok("POST",ep+"/convert-invoice",{});
 const invLines=await ok("GET",`/api/invoices/${inv.id}`);
 check("Invoice total equals the dent-backed estimate total",inv.total===(await ok("GET",ep)).total);
 check("Invoiced estimates refuse dent changes",(await call("POST",ep+"/dents",{...hood,size:"dime"})).status===409&&(await call("PATCH",`/api/estimates/dents/${d1.id}`,{notes:"late"})).status===409);
 check("Invoiced dent records remain readable",(await ok("GET",ep+"/dents")).length===4&&!!invLines);
 const html=await ok("GET",`/print/estimate/${est.id}`);
 check("Printed estimate does not show internal dent notes",!html.includes("Near the cowl")&&!html.includes("Detail-only change"));

 // ---- database triggers back up the API (invoiced and production-started estimates) ----
 await stopServer();
 db=new Database(dbPath);
 // A direct connection needs the audit helper functions the server normally registers.
 db.function("staff_actor_id",()=>null);db.function("staff_actor_label",()=>"direct test");db.function("staff_request_id",()=>"direct-test");
 let blocked=false;try{db.prepare("UPDATE estimate_dents SET notes='direct' WHERE id=?").run(d1.id);}catch(e){blocked=/locked/.test(e.message);}
 check("Database refuses dent edits on an invoiced estimate",blocked);
 // The test's own window-tint estimate: never invoiced and never started.
 const est2={id:tint.id},job={id:999999999};
 db.prepare("INSERT INTO estimate_dents(estimate_id,panel_id,panel_name,body_style,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(est2.id,"hood","Hood","sedan","dime","x","x");
 blocked=false;
 db.exec("SAVEPOINT prod");
 try{
  db.pragma("defer_foreign_keys = ON");
  db.prepare("INSERT INTO ops_cases(estimate_id,job_id,department,created_at) VALUES(?,?,?,?)").run(est2.id,job.id,"pdr","x");
  try{db.prepare("UPDATE estimate_dents SET notes='direct' WHERE estimate_id=?").run(est2.id);}catch(e){blocked=/locked/.test(e.message);}
 }finally{db.exec("ROLLBACK TO prod;RELEASE prod");}
 check("Database refuses dent edits once production has started",blocked);
 db.close();
 console.log(JSON.stringify({passed:true,checks,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,checks,error:e.message,results,serverLog:log.slice(-3000)},null,2));
 process.exitCode=1;
}finally{
 await stopServer();
 rmSync(work,{recursive:true,force:true});
}
