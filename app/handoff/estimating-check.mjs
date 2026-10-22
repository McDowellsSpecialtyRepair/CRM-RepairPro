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
 for(const [role,extra] of [["advisor",{}],["manager",{}],["technician",{technicianId:1}],["auditor",{}]]){
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

 // ---- billing (Phase 2.2): one separately priced line per dent at its own price ----
 const matrices=await ok("GET","/api/pricing-matrices");
 const price=size=>matrices.find(m=>m.matrixType==="pdr_dent"&&m.sizeCategory===size&&m.vehicleCategory==="sedan").price;
 const saved1=await ok("GET",ep+"/dents"),s1=Object.fromEntries(saved1.map(d=>[d.id,d]));
 check("Each standard dent is priced from the existing matrix when saved",s1[d1.id].suggestedPrice===price("dime")&&s1[d4.id].suggestedPrice===price("nickel"));
 check("A crease with no crease matrix price is 'pricing incomplete', not $0",s1[d3.id].referencePrice===null&&s1[d3.id].suggestedPrice===null);
 check("A dent with incomplete pricing cannot be billed",(await call("POST",ep+"/dents/bill",{dentIds:[d3.id]})).status===400);
 check("A dent cannot be chosen twice in one request",(await call("POST",ep+"/dents/bill",{dentIds:[d1.id,d1.id]})).status===400);
 await ok("PUT",`/api/estimates/dents/${d3.id}/price`,{price:150});
 check("Changing a calculated price requires a reason",(await call("PUT",`/api/estimates/dents/${d4.id}/price`,{price:55})).status===400);
 await ok("PUT",`/api/estimates/dents/${d4.id}/price`,{price:55,reason:"Customer return visit"});
 const billed=await ok("POST",ep+"/dents/bill",{dentIds:[d1.id,d2.id,d3.id,d4.id]});
 const after=await ok("GET",ep),lines=after.lineItems;
 const hoodLines=lines.filter(l=>/^Hood: Dime dent #\d$/.test(l.description)),creaseLine=lines.find(l=>/^Hood: crease #\d$/.test(l.description)),doorLine=lines.find(l=>l.description==="RF Door: Nickel dent");
 const hoodLine=hoodLines[0];
 check("Individual billing makes one line per dent (quantity 1 each)",billed.created===4&&hoodLines.length===2&&lines.every(l=>l.quantity===1));
 check("Standard dents bill at the existing matrix price",hoodLines.every(l=>l.unitPrice===price("dime")&&l.serviceCategory==="pdr_dent"&&l.lineType==="labor"));
 check("Crease bills at the entered price only",creaseLine.unitPrice===150&&creaseLine.damageSize==="crease");
 const expectSub=Math.round((price("dime")*2+150+55)*100)/100;
 check("Estimate subtotal, tax and total follow the existing calculation",after.subtotal===expectSub&&after.taxAmount===0&&after.total===expectSub);
 const dents=await ok("GET",ep+"/dents");
 const byId=Object.fromEntries(dents.map(d=>[d.id,d]));
 check("Each dent links to its own line and keeps its calculated price",new Set([d1.id,d2.id,d3.id,d4.id].map(i=>byId[i].lineItemId)).size===4&&byId[d1.id].suggestedPrice===price("dime"));
 check("An override keeps the calculated price, final price, employee and reason",byId[d4.id].overrideSuggestedPrice===price("nickel")&&byId[d4.id].overridePrice===55&&/advisor/i.test(byId[d4.id].overrideBy)&&byId[d4.id].overrideReason==="Customer return visit"&&!!byId[d4.id].overrideAt);
 check("Dents already billed cannot be billed again",(await call("POST",ep+"/dents/bill",{dentIds:[d1.id]})).status===409);

 // ---- billed dents and their lines stay in step ----
 check("A billed dent's size and panel are locked",(await call("PATCH",`/api/estimates/dents/${d1.id}`,{size:"quarter"})).status===409&&(await call("PATCH",`/api/estimates/dents/${d1.id}`,{panelId:"roof",panelName:"Roof"})).status===409);
 check("A billed dent's other price details are locked too",(await call("PATCH",`/api/estimates/dents/${d1.id}`,{severity:"deep"})).status===409&&(await call("PATCH",`/api/estimates/dents/${d1.id}`,{lengthIn:9})).status===409);
 check("A billed dent cannot be deleted or repriced",(await call("DELETE",`/api/estimates/dents/${d1.id}`)).status===409&&(await call("PUT",`/api/estimates/dents/${d1.id}/price`,{price:1,reason:"x"})).status===409);
 check("A dent-backed line's quantity cannot drift from its dents",(await call("PATCH",`/api/estimates/line-items/${hoodLine.id}`,{expectedVersion:hoodLine.allocationVersion,quantity:5})).status===409);
 check("A dent-backed line's price is changed through its dent, not the line editor",(await call("PATCH",`/api/estimates/line-items/${doorLine.id}`,{expectedVersion:doorLine.allocationVersion,unitPrice:60})).status===409);

 // ---- approval behaviour ----
 const techs=(await ok("GET","/api/technicians")).filter(t=>t.status==="active");
 for(const l of (await ok("GET",ep)).lineItems)
  await ok("PATCH",`/api/estimates/line-items/${l.id}/classification`,{expectedVersion:l.allocationVersion,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:10000}]});
 await ok("PATCH",ep,{status:"approved"});
 await ok("PATCH",`/api/estimates/dents/${d1.id}`,{notes:"Detail-only change",paintCorrectable:"no"});
 check("Detail-only dent edits keep an approved estimate approved",(await ok("GET",ep)).status==="approved");
 const d5=await ok("POST",ep+"/dents",{panelId:"roof",panelName:"Roof",bodyStyle:"sedan",size:"quarter"});
 check("Saving a new unbilled dent does not change approval or money",(await ok("GET",ep)).status==="approved");
 await ok("POST",ep+"/dents/bill",{dentIds:[d5.id]});
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
 check("Adding dents to the estimate is audited with the dents and prices",!!db.prepare("SELECT 1 FROM security_audit WHERE event='estimate.dents_billed_individually' AND record_id=?").get(String(est.id)));
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
 // ---- A1: Salesperson, Estimator and Follow-up salesperson on an estimate ----
 const allStaff=await ok("GET","/api/staff",undefined,owner);
 const sid=name=>allStaff.find(u=>u.fullName===name||u.full_name===name)?.id;
 const people=await ok("GET","/api/people/staff");
 check("People choices are active owner/admin/manager/service-advisor staff (no technician or auditor)",
  people.some(p=>p.name==="Test advisor")&&!people.some(p=>p.name==="Test technician"||p.name==="Test auditor"));
 const tp=`/api/estimates/${tint.id}`;
 const tintBefore=await ok("GET",tp);
 let plan=await ok("GET",tp+"/planning");
 const advisorId=sid("Test advisor"),managerId=sid("Test manager"),ownerId=people.find(p=>p.role==="owner")?.id;
 // One People box: up to 3 salespeople whose shares total 100%, plus the estimator and follow-up salesperson.
 plan=await ok("PATCH",tp+"/people",{revision:plan.peopleRevision,salesTeam:[{staffId:advisorId,shareBps:6000},{staffId:managerId,shareBps:2500},{staffId:ownerId,shareBps:1500}],estimatorId:ownerId,followUpId:advisorId});
 const reread=await ok("GET",tp+"/planning");
 check("Three salespeople with shares, the estimator and the follow-up salesperson are saved and read back",
  reread.salesTeam.length===3&&reread.salesTeam.find(r=>r.staff_id===managerId)?.share_bps===2500&&reread.estimatorId===ownerId&&reread.followUpId===advisorId);
 check("The salesperson with the largest share is the lead salesperson",reread.salesPersonId===advisorId&&reread.salesPerson==="Test advisor");
 check("The commission split screen reads the same salespeople (one place to enter them)",await (async()=>{const t=await ok("GET",tp+"/sales-team");const rows=t.splits||t.rows||t;return JSON.stringify(rows).includes(String(managerId))&&JSON.stringify(rows).includes("2500");})());
 {const t=await ok("GET",tp);check("Changing people does not change the estimate's totals, status or lines",t.total===tintBefore.total&&t.status===tintBefore.status&&JSON.stringify(t.lineItems)===JSON.stringify(tintBefore.lineItems));}
 check("Salesperson shares must add up to 100%",await (async()=>{const r=await call("PATCH",tp+"/people",{revision:reread.peopleRevision,salesTeam:[{staffId:advisorId,shareBps:6000},{staffId:managerId,shareBps:3000}]});return r.status===400&&/100%/.test(r.text);})());
 check("No more than 3 salespeople",(await call("PATCH",tp+"/people",{revision:reread.peopleRevision,salesTeam:[1,2,3,4].map(()=>({staffId:advisorId,shareBps:2500}))})).status===400);
 check("The same salesperson cannot be listed twice",(await call("PATCH",tp+"/people",{revision:reread.peopleRevision,salesTeam:[{staffId:advisorId,shareBps:5000},{staffId:advisorId,shareBps:5000}]})).status===400);
 check("A stale people edit is refused (another user changed it)",(await call("PATCH",tp+"/people",{revision:"stale",estimatorId:null})).status===409);
 check("A technician cannot change the people on an estimate",(await call("PATCH",tp+"/people",{revision:reread.peopleRevision,estimatorId:null},staff.technician)).status===403);
 check("A non-sales role (auditor) cannot be chosen as salesperson, with an explanation",await (async()=>{const r=await call("PATCH",tp+"/people",{revision:reread.peopleRevision,salesTeam:[{staffId:sid("Test auditor"),shareBps:10000}]});return r.status===400&&/Service advisor/.test(r.text);})());
 check("Unexpected fields are refused",(await call("PATCH",tp+"/people",{revision:reread.peopleRevision,priority:"high"})).status===400);
 // The owner's "This record changed while you were editing" on every save: adding a line, or saving the
 // other box, must not invalidate the box still open on the same screen.
 {const p0=await ok("GET",tp+"/planning");
  await ok("POST",tp+"/line-items",{serviceCategory:"window_tint",description:"Tint labor",unitPrice:400});
  const p1=await ok("PATCH",tp+"/planning",{revision:p0.revision,priority:"high"});
  check("Planning saves after a line item was added on the same screen (no false 'record changed')",p1.priority==="high");
  const p2=await ok("PATCH",tp+"/people",{revision:p0.peopleRevision,followUpId:managerId});
  check("People save after planning was saved on the same screen (no false 'record changed')",p2.followUpId===managerId);
  check("Planning still saves after people were saved",(await ok("PATCH",tp+"/planning",{revision:p2.revision,priority:"low"})).priority==="low");
  check("A planning edit based on an old planning version is still refused",(await call("PATCH",tp+"/planning",{revision:p0.revision,priority:"urgent"})).status===409);}
 // ---- A1: schedule date before the estimate was created needs a confirmation ----
 {const pl=await ok("GET",tp+"/planning");
  const r=await call("PATCH",tp+"/planning",{revision:pl.revision,scheduledDate:"2020-01-15"});
  check("Scheduling before the estimate was created is stopped with a warning",r.status===409&&/before this estimate was created/.test(r.text));
  check("The refused early date is not saved",(await ok("GET",tp+"/planning")).scheduledDate!=="2020-01-15");
  const c=await ok("PATCH",tp+"/planning",{revision:pl.revision,scheduledDate:"2020-01-15",confirmEarlyDate:true});
  check("The estimator can confirm the early date (work really started first) and it is saved",c.scheduledDate==="2020-01-15");
  const dbr=new Database(dbPath,{readonly:true});
  check("A confirmed early date is recorded in the audit history",!!dbr.prepare("SELECT 1 FROM security_audit WHERE event='schedule.date_before_estimate_confirmed' AND record_id=?").get(String(tint.id)));dbr.close();
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Boise"});
  check("A date on or after the estimate date needs no confirmation",(await ok("PATCH",tp+"/planning",{revision:c.revision,scheduledDate:today})).scheduledDate===today);}
 // ---- A1: discount codes and labor discounts ----
 check("Only pricing managers can add discount codes",(await call("POST","/api/discount-codes",{code:"VET10",description:"Veteran",kind:"percent",amount:10})).status===403);
 const vet=await ok("POST","/api/discount-codes",{code:"vet10",description:"Veteran discount",kind:"percent",amount:10},owner);
 const flat=await ok("POST","/api/discount-codes",{code:"FLAT50",description:"$50 off labor",kind:"amount",amount:50},owner);
 check("A discount code is saved with its code, description and amount",vet.code==="VET10"&&vet.description==="Veteran discount"&&vet.kind==="percent"&&vet.amount===10&&vet.active);
 check("Duplicate discount codes are refused",(await call("POST","/api/discount-codes",{code:"VET10",description:"x",kind:"percent",amount:5},owner)).status===409);
 check("A percentage over 100 is refused",(await call("POST","/api/discount-codes",{code:"BAD",description:"x",kind:"percent",amount:150},owner)).status===400);
 check("Estimators can read the discount list",(await ok("GET","/api/discount-codes")).some(c=>c.code==="VET10"));
 await ok("POST",tp+"/line-items",{serviceCategory:"window_tint",description:"Tint film",unitPrice:100,lineType:"parts"});
 const noDisc=await ok("GET",tp);
 const laborTotal=noDisc.lineItems.filter(l=>l.lineType==="labor").reduce((n,l)=>n+l.total,0);
 const withCode=await ok("PATCH",tp,{discountBasis:"labor",discountCode:"VET10"});
 check("Choosing a discount code applies its description and amount (10% of labor)",withCode.discountCode==="VET10"&&withCode.discountNote==="Veteran discount"&&withCode.discountPercent===10&&Math.abs(withCode.discount-laborTotal*0.1)<0.005);
 check("A labor discount does not change the sales tax on parts",withCode.taxAmount===noDisc.taxAmount);
 check("The total drops by exactly the discount",Math.abs(withCode.total-(noDisc.total-withCode.discount))<0.005);
 await ok("POST",tp+"/line-items",{serviceCategory:"window_tint",description:"More tint labor",unitPrice:200});
 {const t=await ok("GET",tp);check("A percentage labor discount follows the labor when lines are added",Math.abs(t.discount-(laborTotal+200)*0.1)<0.005);}
 check("A hand-entered discount needs a description",(await call("PATCH",tp,{discountBasis:"labor",discountCode:null,discountNote:"",discount:25,discountPercent:null})).status===400);
 const manual=await ok("PATCH",tp,{discountBasis:"labor",discountCode:null,discountNote:"Returning customer",discount:25,discountPercent:null});
 check("A hand-entered dollar discount with a description is saved",manual.discount===25&&manual.discountNote==="Returning customer"&&manual.discountCode===null);
 check("A labor discount larger than the labor is refused",(await call("PATCH",tp,{discountBasis:"labor",discountCode:null,discountNote:"Too much",discount:99999,discountPercent:null})).status===400);
 check("Turned-off discount codes cannot be chosen",await (async()=>{await ok("PATCH",`/api/discount-codes/${flat.id}`,{active:false},owner);return (await call("PATCH",tp,{discountBasis:"labor",discountCode:"FLAT50"})).status===400;})());
 {const printed=await ok("GET",`/print/estimate/${tint.id}`);check("The printed estimate shows the discount description and that it is off labor",/Discount: Returning customer \(off labor\)/.test(printed));}
 const removed=await ok("PATCH",tp,{discountBasis:"labor",discount:0,discountPercent:null,discountCode:null,discountNote:null});
 check("Removing the discount clears the code and description",removed.discount===0&&removed.discountNote===null&&removed.discountCode===null&&Math.abs(removed.total-(removed.subtotal+removed.taxAmount))<0.005);
 {const dbr=new Database(dbPath,{readonly:true});
  check("People changes are recorded in the audit history",!!dbr.prepare("SELECT 1 FROM security_audit WHERE event='people.updated' AND record_id=?").get(String(tint.id)));dbr.close();}
 // ---- A1: one number follows the repair (estimate -> work order -> invoice -> print/email) ----
 {const e=await ok("GET",ep);
  check("The invoice carries the estimate's number",inv.estimateNumber===e.estimateNumber&&/^EST-/.test(e.estimateNumber));
  const printed=await ok("GET",`/print/invoice/${inv.id}`);
  check("The printed invoice shows the estimate number under the invoice number",printed.includes(`Estimate ${e.estimateNumber}`));
  check("The invoice list shows the estimate number",(await ok("GET","/api/invoices")).find(i=>i.id===inv.id)?.estimateNumber===e.estimateNumber);}
 // ---- A1: everything stays editable on a work order in progress, until invoiced ----
 {const job=await ok("POST","/api/jobs",{customerId:cust.id,serviceType:"window_tint",vehicleId:v2.id,title:"Tint in progress",status:"pending",priority:"normal"},owner);
  const je=await ok("POST",`/api/jobs/${job.id}/estimate`,{},owner);
  check("The work order list shows the linked estimate number",(await ok("GET","/api/jobs")).find(j=>j.id===job.id)?.estimateNumbers.includes(je.estimateNumber));
  await ok("POST",`/api/estimates/${je.id}/line-items`,{serviceCategory:"window_tint",description:"Tint labor",unitPrice:300});
  let jp=await ok("GET",`/api/jobs/${job.id}/planning`);
  jp=await ok("PATCH",`/api/jobs/${job.id}/planning`,{revision:jp.revision,status:"in_progress"},owner);
  check("The work order is in progress",jp.status==="in_progress");
  const pp=await ok("GET",`/api/estimates/${je.id}/planning`);
  const pe=await ok("PATCH",`/api/estimates/${je.id}/people`,{revision:pp.peopleRevision,salesTeam:[{staffId:advisorId,shareBps:5000},{staffId:managerId,shareBps:5000}],estimatorId:managerId,followUpId:ownerId});
  check("Salespeople, estimator and follow-up can be changed while the work order is in progress",pe.salesTeam.length===2&&pe.estimatorId===managerId);
  check("The work order shows the same people",(await ok("GET",`/api/jobs/${job.id}/planning`)).estimatorId===managerId);
  const dj=await ok("PATCH",`/api/estimates/${je.id}`,{discountBasis:"labor",discountCode:"VET10"});
  check("A discount can be added while the work order is in progress",dj.discount===30);
  const jd=await ok("GET",`/api/jobs/${job.id}/detail`);
  check("The work order page receives the estimate's discount details",jd.estimates[0].discountCode==="VET10"&&jd.estimates[0].discount===30);
  const early=await ok("PATCH",`/api/jobs/${job.id}/planning`,{revision:jp.revision,scheduledDate:"2020-02-01",confirmEarlyDate:true},owner);
  check("The schedule date can be changed (with the early-date confirmation) while in progress",early.scheduledDate==="2020-02-01");}
 // ---- A1: how the customer heard about us, and the referral thank-you list ----
 {const sources=await ok("GET","/api/marketing-sources");
  const src=n=>sources.find(s=>s.name===n);
  check("The starting choices include Radio, Referral, Repeat customer, Sign and Vans",["Radio","Referral","Repeat customer","Sign","Vans / vehicle lettering"].every(n=>src(n)?.active));
  check("Referral asks who referred them; Radio does not",src("Referral").needsReferrer&&!src("Radio").needsReferrer);
  check("Only marketing managers can change the choices",(await call("POST","/api/marketing-sources",{name:"Billboard"})).status===403);
  const bb=await ok("POST","/api/marketing-sources",{name:"Billboard on Eagle Rd"},owner);
  check("A manager can add a choice",bb.active&&!bb.needsReferrer);
  check("Duplicate choices are refused",(await call("POST","/api/marketing-sources",{name:"billboard on eagle rd"},owner)).status===409);
  const mu=`/api/estimates/${tint.id}/marketing`;
  check("An estimate starts with no source recorded",(await ok("GET",mu)).sourceId===null);
  const radio=await ok("PUT",mu,{sourceId:src("Radio").id});
  check("Radio is saved on the estimate",radio.source==="Radio");
  check("The customer's record gets the source when it had none",(await ok("GET",`/api/customers/${cust.id}`)).referralSource==="Radio");
  check("Referral without a referrer is refused with an explanation",await (async()=>{const r=await call("PUT",mu,{sourceId:src("Referral").id});return r.status===400&&/who referred/.test(r.text);})());
  check("A customer cannot refer themselves",(await call("PUT",mu,{sourceId:src("Referral").id,referrerCustomerId:cust.id})).status===400);
  const friend=await ok("POST","/api/customers",{customerType:"retail",firstName:"Pat",lastName:"Referrer",phone:"555-010-3131",status:"active"});
  const ref=await ok("PUT",mu,{sourceId:src("Referral").id,referrerCustomerId:friend.id,referrerNote:"Coworker"});
  check("A referral by an existing customer is saved with their name and phone",ref.referrer.name==="Pat Referrer"&&ref.referrer.phone==="555-010-3131"&&ref.thankYouStatus==="to_thank");
  check("Service advisors can open the referral thank-you list",(await call("GET","/api/referrals")).status===200);
  check("Technicians cannot open the referral thank-you list",(await call("GET","/api/referrals",undefined,staff.technician)).status===403);
  let list=await ok("GET","/api/referrals",undefined,owner);
  const row=list.find(r=>r.estimateId===tint.id);
  check("The referrer is on the thank-you list with the referred customer and estimate number",row&&row.status==="to_thank"&&row.referrerName==="Pat Referrer"&&row.referredCustomer==="Dana Phase-Two"&&row.estimateNumber===tintBefore.estimateNumber);
  const th=await ok("PATCH",`/api/referrals/${tint.id}`,{thanked:true,note:"Card mailed"},owner);
  check("Marking a referral thanked records who and how",th.status==="thanked"&&th.thankedNote==="Card mailed"&&!!th.thankedBy);
  check("Re-saving the same referrer keeps it thanked",(await ok("PUT",mu,{sourceId:src("Referral").id,referrerCustomerId:friend.id,referrerNote:"Coworker"})).thankYouStatus==="thanked");
  const byName=await ok("PUT",mu,{sourceId:src("Referral").id,referrerName:"Lee Neighbor",referrerPhone:"555-010-4444"});
  check("A referrer who is not a customer can be typed in, and goes back on the list to thank",byName.referrer.name==="Lee Neighbor"&&byName.thankYouStatus==="to_thank");
  check("A turned-off choice cannot be picked for a new answer",await (async()=>{await ok("PATCH",`/api/marketing-sources/${bb.id}`,{active:false},owner);return (await call("PUT",mu,{sourceId:bb.id})).status===400;})());
  check("The marketing answer is locked once the estimate is invoiced",(await call("PUT",`/api/estimates/${est.id}/marketing`,{sourceId:src("Radio").id})).status===409);
  const dbr=new Database(dbPath,{readonly:true});
  check("Marketing answers and thank-yous are in the audit history",!!dbr.prepare("SELECT 1 FROM security_audit WHERE event='marketing.updated' AND record_id=?").get(String(tint.id))&&!!dbr.prepare("SELECT 1 FROM security_audit WHERE event='referral.thanked'").get());dbr.close();}
 // ---- A1: change history shows the login that made each change ----
 {check("Service advisors cannot open the change history (managers, owners and auditors can)",(await call("GET",`/api/history/estimates/${tint.id}`)).status===403);
  check("An auditor can read the change history",(await call("GET",`/api/history/estimates/${tint.id}`,undefined,staff.auditor)).status===200);
  const h=await ok("GET",`/api/history/estimates/${tint.id}`,undefined,owner);
  const people=h.find(e=>/People changed/.test(e.what)&&e.changes.some(c=>c.field==="Follow-up salesperson"));
  check("Changing the follow-up salesperson is in the estimate's history with the person's name and login",people&&people.by==="Test advisor"&&people.login==="advisor@example.invalid");
  check("The history shows the follow-up change from one person to another by name",people.changes.some(c=>c.field==="Follow-up salesperson"&&/Test /.test(c.from)&&/Test /.test(c.to)));
  const mk=h.find(e=>/heard about us/.test(e.what)&&e.changes.some(c=>c.field==="Referred by"&&/Lee Neighbor/.test(c.to)));
  check("Changing who referred the customer is in the history (old and new referrer) with the login",mk&&/Pat Referrer/.test(mk.changes.find(c=>c.field==="Referred by").from)&&mk.login==="advisor@example.invalid");
  check("Marking a referral thanked is in the history with the login",h.some(e=>e.what==="Referral marked thanked"&&e.login==="owner@example.invalid"));
  check("Discount changes are in the history",h.some(e=>e.changes.some(c=>c.field==="Discount description"&&c.to==="Returning customer")));
  check("Early schedule dates confirmed by the estimator are in the history",h.some(e=>/Early schedule date confirmed/.test(e.what)));
  check("Internal costs are not shown in the change history",!JSON.stringify(h).includes("unit cost"));
  await ok("PATCH",`/api/customers/${cust.id}`,{phone:"555-010-9999"});
  const ch=await ok("GET",`/api/history/customers/${cust.id}`,undefined,owner);
  check("Changing a customer's phone is in the customer's history with old and new number and the login",ch.some(e=>e.login==="advisor@example.invalid"&&e.changes.some(c=>c.field==="Phone"&&c.from==="555-010-2101"&&c.to==="555-010-9999")));
  const job=(await ok("GET","/api/jobs")).find(j=>j.title==="Tint in progress");
  const jh=await ok("GET",`/api/history/jobs/${job.id}`,undefined,owner);
  check("A work order's history includes people changes on its linked estimate",jh.some(e=>/People changed/.test(e.what)&&e.changes.some(c=>c.field==="Estimator")));
  check("A work order's history includes its status change",jh.some(e=>e.changes.some(c=>c.field==="Status"&&c.to==="in progress")));
  const dbr=new Database(dbPath,{readonly:true});
  check("Opening the change history is itself recorded",!!dbr.prepare("SELECT 1 FROM security_audit WHERE event='history.viewed' AND entity='customers' AND record_id=?").get(String(cust.id)));dbr.close();}
 // ---- A1: phone and email typing checks, and duplicate customers ----
 {const bad=async(body,re)=>{const r=await call("POST","/api/customers",{customerType:"insurance",companyName:"Check Ins Co",status:"active",...body});return r.status===400&&re.test(r.text);};
  check("A phone number with too many digits is refused with how many digits it has",await bad({phone:"208-555-12111"},/11 digits.*10 digits/));
  check("A phone number with too few digits is refused",await bad({phone:"208-555"},/6 digits/));
  check("An email with spaces is refused and the fix is suggested",await bad({email:"bm47 ford @ gmmail.con"},/can't contain spaces.*bm47ford@gmail\.com/));
  check("A misspelled email domain (gmmail.con) is caught and gmail.com suggested",await bad({email:"bm47ford@gmmail.con"},/Did you mean bm47ford@gmail\.com/));
  check("An email without an @ is refused",await bad({email:"bm47ford.gmail.com"},/needs an @/));
  const ok1=await ok("POST","/api/customers",{customerType:"insurance",companyName:"Check Ins Co",status:"active",phone:"(208) 555 7788",email:"Claims@CheckIns.com"});
  check("A good phone number is saved in one format (208-555-7788) and the email in lower case",ok1.phone==="208-555-7788"&&ok1.email==="claims@checkins.com");
  const kept=await ok("POST","/api/customers",{customerType:"insurance",companyName:"Rare Domain Co",status:"active",email:"ops@gmail.co",confirmEmail:true});
  check("A flagged email can be kept as typed when the person confirms it",kept.email==="ops@gmail.co");
  const dup=await call("POST","/api/customers",{customerType:"insurance",companyName:"Another Name",status:"active",phone:"1-208-555-7788"});
  check("The same phone number written differently (1-208-555-7788) is caught as a possible duplicate customer",dup.status===409&&/duplicate/i.test(dup.text));
  check("Editing a customer to a bad phone number is refused",(await call("PATCH",`/api/customers/${ok1.id}`,{phone:"555-12"})).status===400);
  check("Editing a customer's email to a typo is refused",(await call("PATCH",`/api/customers/${ok1.id}`,{email:"claims@hotmial.com"})).status===400);
  check("A new number on the contact-change screen gets the same check",(await call("POST",`/api/customers/${ok1.id}/contact-update`,{answers:[{key:"phone",current:"208-555-7788",incoming:"208-555-77889",answer:"replaced"}]})).status===400);}
 // ---- A1: marine and RV interiors can reupholster a panel instead of repairing it ----
 {const boat=await ok("POST","/api/vehicles",{customerId:cust.id,vehicleType:"marine",year:"2015",make:"Sea Ray",model:"Sundancer"});
  const me=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"marine_interior",vehicleId:boat.id,taxRate:6});
  const up=await ok("POST",`/api/estimates/${me.id}/line-items`,{serviceCategory:"upholstery",repairAction:"reupholster",description:"V-berth cushion: reupholster",panelLocation:"V-berth cushion",unitPrice:110});
  check("A marine interior estimate accepts a reupholster line",up.serviceCategory==="upholstery"&&up.repairAction==="reupholster");
  const rep=await ok("POST",`/api/estimates/${me.id}/line-items`,{serviceCategory:"interior_vinyl",repairAction:"repair",description:"Helm seat: vinyl tear",unitPrice:85});
  check("The same marine estimate still accepts a repair line",rep.serviceCategory==="interior_vinyl");
  check("Reupholster with new foam is allowed on marine interiors",(await call("POST",`/api/estimates/${me.id}/line-items`,{serviceCategory:"upholstery",repairAction:"foam_replacement",description:"Settee: reupholster + foam",unitPrice:137.5})).status<300);
  check("Auto interiors are unchanged (no reupholster lines)",(await call("POST",`/api/estimates/${tint.id}/line-items`,{serviceCategory:"upholstery",repairAction:"reupholster",description:"x",unitPrice:1})).status===400);}
 // ---- A1: the schedule shows who, where, what item and what work for each booking ----
 {const slots=await ok("GET","/api/schedule-slots",undefined,owner);
  const withJob=slots.find(x=>x.jobId&&x.status!=="cancelled");
  check("Test data has a booked work order on the calendar",!!withJob);
  const cap=await ok("GET",`/api/capacity?from=${withJob.date}`);
  const slot=cap.slots.find(x=>x.id===withJob.id);
  const job=await ok("GET",`/api/jobs/${withJob.jobId}`,undefined,owner),c=await ok("GET",`/api/customers/${job.customerId}`,undefined,owner);
  check("Each calendar booking includes the customer's name, service and work order number",slot.details&&slot.details.customer===(c.companyName||`${c.firstName} ${c.lastName}`.trim())&&slot.details.jobNumber===job.jobNumber&&!!slot.details.service);
  check("Each calendar booking includes the customer's phone and address",slot.details.phone===(c.mobile||c.phone||null)&&(c.address?slot.details.address.includes(c.address):true));
  check("Calendar bookings show no prices or costs",!/"(?:unitPrice|unit_price|total|unitCost|unit_cost|price)"/.test(JSON.stringify(slot.details)));
  const mine=await ok("GET","/api/my-work",undefined,staff.technician);
  check("A technician's own work list includes where to go, the customer phone and their booked times",Array.isArray(mine)&&mine.every(j=>"address" in j&&"phone" in j&&Array.isArray(j.appointments)));}
 // ---- A1: logo on printed estimates and invoices ----
 const logoHtml=await ok("GET",`/print/estimate/${tint.id}`);
 check("Printed estimate shows the McDowells logo image",/<img src="data:image\/png;base64,[A-Za-z0-9+/=]{1000,}" alt="McDowells Specialty Repair"/.test(logoHtml));
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
