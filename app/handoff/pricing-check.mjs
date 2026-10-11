// Phase 2.2 PDR pricing regression suite: management price master (standard grid, crease ranges and
// prices, adjustments, vehicle categories, approval threshold), per-dent price snapshots, overrides,
// explicit repricing, individual and package billing, package approval gates, customer documents,
// and the upgrade of Phase 2.1 dent records. Temporary demo database only. Requires a build (dist/).
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Database=require("better-sqlite3");
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5194);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local test port");
const base=`http://127.0.0.1:${port}`;
try{await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});throw Error("Test port is already occupied; choose HANDOFF_TEST_PORT");}catch(e){if(e.message.includes("already occupied"))throw e;}
const work=mkdtempSync(join(tmpdir(),"repairpro-pricing-"));
const dbPath=join(work,"pricing.db");
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
const money=n=>Math.round(n*100)/100;
const directDb=()=>{const db=new Database(dbPath);db.function("staff_actor_id",()=>null);db.function("staff_actor_label",()=>"direct test");db.function("staff_request_id",()=>"direct-test");return db;};
try{
 tsx(["script/seed-demo.ts"]);
 const seededStandard=new Database(dbPath,{readonly:true}).prepare("SELECT size_category size,vehicle_category category,price FROM pricing_matrices WHERE matrix_type='pdr_dent' ORDER BY id").all();
 await startServer();
 const ownerEmail="owner@example.invalid";
 tsx(["script/bootstrap-owner.ts",ownerEmail,join(work,"owner.json")]);
 const invite=JSON.parse(readFileSync(join(work,"owner.json"),"utf8"));
 const owner=(await ok("POST","/api/auth/activate",{email:ownerEmail,activationCode:invite.activationCode,password:password()})).token;
 const staff={};
 for(const role of ["manager","advisor","accountant","auditor"]){
  const email=`${role}@example.invalid`,r=await ok("POST","/api/staff",{email,fullName:`Test ${role}`,role},owner);
  staff[role]=(await ok("POST","/api/auth/activate",{email,activationCode:r.activationCode,password:password()})).token;
 }
 const mgr=staff.manager,adv=staff.advisor;

 // ---------- price master ----------
 let m=await ok("GET","/api/pdr-pricing",undefined,adv);
 check("Existing categories are Sedan and SUV/Truck (SUV and Pickup body styles)",m.categories.length===2&&m.categories[0].key==="sedan"&&m.categories[0].bodyStyles.join()==="sedan"&&m.categories[1].label==="SUV/Truck"&&m.categories[1].bodyStyles.join()==="suv,pickup");
 check("Standard dent prices are the existing matrix, unchanged",JSON.stringify(m.standard.map(({size,category,price})=>({size,category,price})))===JSON.stringify(seededStandard));
 check("No crease ranges, crease prices or adjustments are invented",m.ranges.length===0&&m.creasePrices.length===0&&m.adjustments.length===0&&m.settings.packageApprovalThresholdPercent===null);
 const std=(size,cat="sedan")=>m.standard.find(r=>r.size===size&&r.category===cat).price;
 const P={dime:std("dime"),quarter:std("quarter"),nickel:std("nickel")};
 check("Advisors and accountants cannot change pricing",(await call("PUT","/api/pdr-pricing/standard",{size:"dime",category:"sedan",price:1},adv)).status===403&&(await call("PUT","/api/pdr-pricing/standard",{size:"dime",category:"sedan",price:1},staff.accountant)).status===403);
 check("Auditors can read pricing but not change it",(await call("GET","/api/pdr-pricing",undefined,staff.auditor)).status===200&&(await call("POST","/api/pdr-pricing/ranges",{minIn:1,maxIn:2},staff.auditor)).status===403);
 check("Signed-out requests cannot read or change pricing",(await call("GET","/api/pdr-pricing",undefined,null)).status===401&&(await call("PUT","/api/pdr-pricing/settings",{packageApprovalThresholdPercent:5},null)).status===401);
 const bad=async(method,path,body)=>(await call(method,path,body,mgr)).status===400;
 check("Ranges must be whole inches 1-36 and cannot overlap",
  await bad("POST","/api/pdr-pricing/ranges",{minIn:0,maxIn:3})&&await bad("POST","/api/pdr-pricing/ranges",{minIn:5,maxIn:37})&&await bad("POST","/api/pdr-pricing/ranges",{minIn:6,maxIn:2})&&await bad("POST","/api/pdr-pricing/ranges",{minIn:1.5,maxIn:3}));
 m=await ok("POST","/api/pdr-pricing/ranges",{minIn:1,maxIn:6},mgr);
 m=await ok("POST","/api/pdr-pricing/ranges",{minIn:7,maxIn:12},mgr);
 check("Overlapping range refused",await bad("POST","/api/pdr-pricing/ranges",{minIn:5,maxIn:8}));
 const r1=m.ranges.find(r=>r.minIn===1).id,r2=m.ranges.find(r=>r.minIn===7).id;
 check("Crease prices must be valid amounts",await bad("PUT","/api/pdr-pricing/crease",{rangeId:r1,severity:"deep",category:"sedan",price:-5})&&await bad("PUT","/api/pdr-pricing/crease",{rangeId:r1,severity:"severe",category:"sedan",price:5})&&await bad("PUT","/api/pdr-pricing/crease",{rangeId:r1,severity:"deep",category:"nope",price:5}));
 m=await ok("PUT","/api/pdr-pricing/crease",{rangeId:r1,severity:"deep",category:"sedan",price:200},mgr);
 m=await ok("PUT","/api/pdr-pricing/crease",{rangeId:r2,severity:"medium",category:"sedan",price:260},mgr);
 check("Adjustments are validated per matrix",await bad("PUT","/api/pdr-pricing/adjustments",{appliesTo:"crease",dimension:"severity",value:"deep",kind:"percent",amount:5})
  &&await bad("PUT","/api/pdr-pricing/adjustments",{appliesTo:"crease",dimension:"panel",value:"windshield",kind:"amount",amount:5})
  &&await bad("PUT","/api/pdr-pricing/adjustments",{appliesTo:"standard",dimension:"severity",value:"deep",kind:"percent",amount:2000}));
 m=await ok("PUT","/api/pdr-pricing/adjustments",{appliesTo:"crease",dimension:"location_difficulty",value:"difficult",kind:"percent",amount:10},mgr);
 m=await ok("PUT","/api/pdr-pricing/adjustments",{appliesTo:"crease",dimension:"panel",value:"hood",kind:"amount",amount:25},mgr);
 m=await ok("PUT","/api/pdr-pricing/adjustments",{appliesTo:"standard",dimension:"severity",value:"deep",kind:"percent",amount:20},mgr);
 check("Adjustments save as dollar amounts or percentages",m.adjustments.length===3&&m.adjustments.some(a=>a.dimension==="panel"&&a.kind==="amount"&&a.amount===25));
 let db=new Database(dbPath,{readonly:true});
 check("Price master changes are in the audit history with the manager",db.prepare("SELECT COUNT(*) n FROM security_audit WHERE entity IN ('pdr_crease_prices','pdr_price_adjustments','pdr_length_ranges') AND actor_label LIKE '%manager%'").get().n>=7);
 db.close();

 // ---------- dents priced from the master ----------
 token=adv;
 const cust=await ok("POST","/api/customers",{customerType:"retail",firstName:"Price",lastName:"Tester",phone:"555-010-2202",status:"active"});
 const car=await ok("POST","/api/vehicles",{customerId:cust.id,vehicleType:"auto",year:"2020",make:"Honda",model:"Accord"});
 const est=await ok("POST","/api/estimates",{customerId:cust.id,serviceType:"pdr",vehicleId:car.id,taxRate:6});
 const ep=`/api/estimates/${est.id}`;
 const add=b=>ok("POST",ep+"/dents",{bodyStyle:"sedan",...b});
 const A=await add({panelId:"hood",panelName:"Hood",size:"crease",lengthIn:4,severity:"deep",locationDifficulty:"difficult"});
 check("Crease price = range/severity/category base + difficulty % + panel $",A.suggestedPrice===money(200+20+25)&&/Crease 1"–6" · Deep · Sedan \$200\.00/.test(A.suggestedSource)&&/Difficult location \+10%/.test(A.suggestedSource)&&/Hood \+\$25\.00/.test(A.suggestedSource));
 const B=await add({panelId:"hood",panelName:"Hood",size:"quarter",severity:"deep"});
 check("Standard dent price = existing matrix base + optional adjustment",B.suggestedPrice===money(P.quarter*1.2));
 const C=await add({panelId:"roof",panelName:"Roof",size:"dime"});
 check("With no adjustments, a standard dent is the existing matrix price",C.suggestedPrice===P.dime);
 const D=await add({panelId:"roof",panelName:"Roof",size:"crease",lengthIn:20,severity:"deep"});
 check("An unpriced crease shows pricing incomplete, never $0",D.suggestedPrice===null&&D.referencePrice===null&&/No crease length range covers 20"/.test(D.suggestedSource));
 const E=await add({panelId:"windshield",panelName:"Windshield",size:"dime"});
 check("Glass and plastic panels need an entered price",E.referencePrice===null);
 await ok("DELETE",`/api/estimates/dents/${E.id}`);

 // ---------- master changes do not reprice estimates until asked ----------
 await ok("PUT","/api/pdr-pricing/crease",{rangeId:r1,severity:"deep",category:"sedan",price:300},mgr);
 let dents=await ok("GET",ep+"/dents"),byId=Object.fromEntries(dents.map(d=>[d.id,d]));
 check("A master price change keeps the estimate's saved price",byId[A.id].suggestedPrice===245&&byId[A.id].matrixChanged===true&&byId[A.id].currentSuggestedPrice===money(300+30+25));
 const rp=await ok("POST",ep+"/dents/reprice");
 byId=Object.fromEntries(rp.dents.map(d=>[d.id,d]));
 check("Explicit repricing applies current master values",rp.changed===1&&byId[A.id].suggestedPrice===355&&byId[A.id].matrixChanged===false);
 db=new Database(dbPath,{readonly:true});
 check("Repricing is recorded in the audit history",!!db.prepare("SELECT 1 FROM security_audit WHERE event='estimate.dents_repriced' AND record_id=? AND after_json LIKE '%355%'").get(String(est.id)));
 db.close();

 // ---------- overrides ----------
 check("Override of a calculated price needs a reason",(await call("PUT",`/api/estimates/dents/${B.id}/price`,{price:100})).status===400);
 const Bo=await ok("PUT",`/api/estimates/dents/${B.id}/price`,{price:180,reason:"Shared access with crease"});
 check("Override records suggested price, final price, employee and reason",Bo.overrideSuggestedPrice===money(P.quarter*1.2)&&Bo.overridePrice===180&&Bo.referencePrice===180&&/advisor/i.test(Bo.overrideBy)&&Bo.overrideReason==="Shared access with crease"&&!!Bo.overrideAt);
 const Do=await ok("PUT",`/api/estimates/dents/${D.id}/price`,{price:400});
 check("An unpriced dent can be priced without a reason (recorded as no matrix price)",Do.referencePrice===400&&Do.overrideReason==="No matrix price available"&&Do.overrideSuggestedPrice===null);

 // ---------- individual billing; existing lines keep their price ----------
 await ok("POST",ep+"/dents/bill",{dentIds:[C.id]});
 const cLine=(await ok("GET",ep)).lineItems.find(l=>l.description.startsWith("Roof: Dime dent"));
 check("Individual billing: one line for the dent at its own price",cLine.quantity===1&&cLine.unitPrice===P.dime);
 await ok("PUT","/api/pdr-pricing/standard",{size:"dime",category:"sedan",price:P.dime+50},mgr);
 check("Changing the master never changes a billed line",(await ok("GET",ep)).lineItems.find(l=>l.id===cLine.id).unitPrice===P.dime&&(await ok("GET",ep+"/dents")).find(d=>d.id===C.id).suggestedPrice===P.dime);
 await ok("PUT","/api/pdr-pricing/standard",{size:"dime",category:"sedan",price:P.dime},mgr);

 // ---------- packages ----------
 check("A panel package only includes one panel",(await call("POST",ep+"/dent-groups",{scope:"panel",dentIds:[A.id,D.id],manualPrice:100})).status===400);
 const calcHood=money(355+180);
 let pkg=await ok("POST",ep+"/dent-groups",{scope:"panel",dentIds:[A.id,B.id],manualPrice:450});
 check("Panel package keeps calculated total, manual price, difference and %",pkg.calculatedTotal===calcHood&&pkg.manualPrice===450&&pkg.difference===money(450-calcHood)&&pkg.differencePercent===Math.round((450-calcHood)/calcHood*1000)/10&&pkg.pricingComplete);
 let e1=await ok("GET",ep);
 const pkgLine=e1.lineItems.find(l=>l.id===pkg.lineItemId);
 check("A package bills as one line at the entered price (no automatic discount)",pkgLine.quantity===1&&pkgLine.unitPrice===450&&pkgLine.description==="Hood: dent repair package (2 dents)");
 dents=await ok("GET",ep+"/dents");byId=Object.fromEntries(dents.map(d=>[d.id,d]));
 check("Packaged dents keep their own prices and point to the package",byId[A.id].groupId===pkg.id&&byId[A.id].referencePrice===355&&byId[B.id].referencePrice===180&&byId[A.id].lineItemId===pkg.lineItemId);
 check("A packaged dent cannot also be billed individually or in another package",(await call("POST",ep+"/dents/bill",{dentIds:[A.id]})).status===409&&(await call("POST",ep+"/dent-groups",{scope:"vehicle",dentIds:[A.id],manualPrice:1})).status===409);
 check("Below the calculated total needs approval",pkg.approvalRequired&&!pkg.approved);
 check("An unapproved package blocks sending",(await call("POST",ep+"/send",{message:"x"})).status===409);
 check("An unapproved package blocks marking the estimate approved",(await call("PATCH",ep,{status:"approved"})).status===409);
 check("An unapproved package blocks production start",(await call("POST","/api/operations/start",{estimateId:est.id},owner)).status===409);
 check("Advisors cannot approve a package price",(await call("POST",`/api/estimates/dent-groups/${pkg.id}/approve`,{manualPrice:450})).status===403);
 check("Approval must be for the exact price shown",(await call("POST",`/api/estimates/dent-groups/${pkg.id}/approve`,{manualPrice:449},mgr)).status===409);
 pkg=await ok("POST",`/api/estimates/dent-groups/${pkg.id}/approve`,{manualPrice:450},mgr);
 check("Manager approval records who and when",pkg.approved&&/manager/i.test(pkg.approvedBy)&&!!pkg.approvedAt&&pkg.approvedPrice===450);
 db=new Database(dbPath,{readonly:true});
 check("Package approval is in the audit history",!!db.prepare("SELECT 1 FROM security_audit WHERE event='estimate.dent_package_approved' AND record_id=?").get(String(pkg.id)));
 db.close();
 await ok("PATCH",ep,{status:"approved"});
 check("After approval the estimate can be marked approved",(await ok("GET",ep)).status==="approved");
 pkg=await ok("PATCH",`/api/estimates/dent-groups/${pkg.id}`,{manualPrice:430});
 e1=await ok("GET",ep);
 check("Changing the package price clears approval and returns the estimate to draft",!pkg.approved&&pkg.approvedBy===null&&e1.status==="draft"&&e1.lineItems.find(l=>l.id===pkg.lineItemId).unitPrice===430);
 check("Subtotal is package + individual lines only",e1.subtotal===money(430+P.dime));
 pkg=await ok("POST",`/api/estimates/dent-groups/${pkg.id}/approve`,{manualPrice:430},owner);
 check("Owners can approve package prices",pkg.approved&&/owner/i.test(pkg.approvedBy));

 // threshold
 await ok("PUT","/api/pdr-pricing/settings",{packageApprovalThresholdPercent:25},mgr);
 const st=await ok("GET",ep+"/dent-groups"),hp=st.find(g=>g.id===pkg.id);
 check("Threshold: a reduction within the threshold needs no approval",hp.approvalRequired===false);
 pkg=await ok("PATCH",`/api/estimates/dent-groups/${pkg.id}`,{manualPrice:400});
 check("Threshold: a reduction beyond it still needs approval",pkg.approvalRequired===true&&!pkg.approved);
 await ok("PUT","/api/pdr-pricing/settings",{packageApprovalThresholdPercent:null},mgr);
 pkg=await ok("PATCH",`/api/estimates/dent-groups/${pkg.id}`,{manualPrice:600});
 check("A package at or above its calculated total needs no approval",pkg.approvalRequired===false&&pkg.difference===money(600-calcHood));

 // switch individual -> package (no double charge), package with incomplete pricing
 const veh=await ok("POST",ep+"/dent-groups",{scope:"vehicle",dentIds:[C.id,D.id],manualPrice:350});
 e1=await ok("GET",ep);
 check("Moving an individually billed dent into a package removes its own line",!e1.lineItems.some(l=>l.id===cLine.id)&&e1.lineItems.length===2&&e1.subtotal===money(600+350));
 check("Package compares against entered prices for unpriced dents",veh.calculatedTotal===money(P.dime+400)&&veh.pricingComplete);
 await ok("PUT",`/api/estimates/dents/${D.id}/price`,{price:null}).catch(()=>null);
 // switch package -> individual: remove the package, dents keep prices
 const before=Object.fromEntries((await ok("GET",ep+"/dents")).map(d=>[d.id,d]));
 await ok("DELETE",`/api/estimates/dent-groups/${veh.id}`);
 dents=await ok("GET",ep+"/dents");byId=Object.fromEntries(dents.map(d=>[d.id,d]));
 check("Removing a package returns its dents unbilled with their prices kept",[C.id,D.id].every(i=>byId[i].lineItemId===null&&byId[i].groupId===null&&byId[i].referencePrice===before[i].referencePrice));
 db=new Database(dbPath,{readonly:true});
 check("Removed packages stay in history",db.prepare("SELECT status FROM estimate_dent_groups WHERE id=?").get(veh.id).status==="removed");
 db.close();
 await ok("PUT",`/api/estimates/dents/${D.id}/price`,{price:null});
 const inc=await ok("POST",ep+"/dent-groups",{scope:"vehicle",dentIds:[C.id,D.id],manualPrice:500});
 check("Incomplete pricing shows 'pricing incomplete' and always needs approval",inc.calculatedTotal===null&&!inc.pricingComplete&&inc.difference===null&&inc.approvalRequired);
 await ok("DELETE",`/api/estimates/line-items/${inc.lineItemId}`);
 check("Deleting a package's line removes the package and frees its dents",(await ok("GET",ep+"/dent-groups")).every(g=>g.id!==inc.id)&&(await ok("GET",ep+"/dents")).filter(d=>[C.id,D.id].includes(d.id)).every(d=>!d.lineItemId&&!d.groupId));
 await ok("PUT",`/api/estimates/dents/${D.id}/price`,{price:400});
 await ok("POST",ep+"/dents/bill",{dentIds:[C.id,D.id]});
 e1=await ok("GET",ep);
 db=new Database(dbPath,{readonly:true});
 const perDent=db.prepare("SELECT id,line_item_id FROM estimate_dents WHERE estimate_id=?").all(est.id);
 check("Every dent is billed exactly once and lines add up",perDent.every(d=>d.line_item_id)&&e1.subtotal===money(600+P.dime+400)&&e1.lineItems.length===3);
 db.close();
 check("Tax treatment unchanged: PDR labor lines carry no sales tax",e1.taxAmount===0&&e1.total===e1.subtotal);

 // ---------- customer documents ----------
 await ok("PATCH",`/api/estimates/dents/${A.id}`,{notes:"Secret internal note",paintCorrectable:"no"});
 let html=(await call("GET",`/print/estimate/${est.id}`)).text;
 check("Dent details are off by default",!html.includes('Deep severity'));
 await ok("PUT",ep+"/pricing-options",{showDentDetails:true});
 html=(await call("GET",`/print/estimate/${est.id}`)).text;
 check("With details on, each dent shows panel, size, length and severity",html.includes('Hood · Crease · 4&quot; long · Deep severity')&&html.includes("Hood · Quarter · Deep severity")&&html.includes("Roof · Dime"));
 check("Customer documents never show the paint answer, notes or internal pricing",!html.includes("Secret internal note")&&!/Paint damage/i.test(html)&&!html.includes("Calculated")&&!html.includes("Shared access with crease"));
 check("Showing details does not change the amount",(await ok("GET",ep)).total===e1.total);
 // invoice
 const techs=(await ok("GET","/api/technicians")).filter(t=>t.status==="active");
 for(const l of (await ok("GET",ep)).lineItems)await ok("PATCH",`/api/estimates/line-items/${l.id}/classification`,{expectedVersion:l.allocationVersion,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:10000}]});
 const me=await ok("GET","/api/auth/me");
 await ok("PUT",ep+"/sales-team",{version:1,splits:[{staffId:me.user?.id||me.id,shareBps:10000}]});
 await ok("PATCH",ep,{status:"approved"});
 const inv=await ok("POST",ep+"/convert-invoice",{});
 const ihtml=(await call("GET",`/print/invoice/${inv.id}`)).text;
 check("Invoice follows the billing method and shows the copied dent details",inv.total===e1.total&&ihtml.includes("Hood: dent repair package (2 dents)")&&ihtml.includes('Hood · Crease · 4&quot; long · Deep severity')&&!ihtml.includes("Secret internal note"));
 check("After invoicing, document options and packages are locked",(await call("PUT",ep+"/pricing-options",{showDentDetails:false})).status===409&&(await call("PATCH",`/api/estimates/dent-groups/${pkg.id}`,{manualPrice:1})).status===409);
 await stopServer();
 db=directDb();
 let blocked=false;try{db.prepare("UPDATE invoice_line_dent_details SET detail='x'").run();}catch(e){blocked=/immutable/.test(e.message);}
 check("Issued invoice dent details are immutable",blocked);
 blocked=false;try{db.prepare("DELETE FROM estimate_dent_groups WHERE id=?").run(pkg.id);}catch(e){blocked=/history/.test(e.message);}
 check("Package records cannot be deleted",blocked);

 // ---------- upgrade of Phase 2.1 dent records ----------
 // Recreate the state a Phase 2.1 database had: dents billed on combined lines with only matrix_unit_price.
 const e2=db.prepare("SELECT id FROM estimates WHERE service_type='pdr' AND id NOT IN (SELECT estimate_id FROM invoices) AND id NOT IN (SELECT estimate_id FROM ops_cases) LIMIT 1").get()
  || null;
 let e2id=e2?.id;
 if(!e2id){const r=db.prepare("INSERT INTO estimates(estimate_number,customer_id,service_type,status,subtotal,tax_rate,tax_amount,discount,total,created_at) VALUES('EST-UPGRADE',?,'pdr','draft',0,0,0,0,0,?)").run(cust.id,new Date().toISOString());e2id=Number(r.lastInsertRowid);}
 const lineIns=db.prepare("INSERT INTO estimate_line_items(estimate_id,service_category,description,quantity,unit,unit_price,total,line_type,repair_action,allocation_version) VALUES(?,?,?,?,?,?,?,?,?,1)");
 const l1=Number(lineIns.run(e2id,"pdr_dent","Hood: Dime dent",2,"each",P.dime,P.dime*2,"labor","repair").lastInsertRowid);
 const l2=Number(lineIns.run(e2id,"pdr_dent","Roof: Nickel dent",1,"each",99,99,"labor","repair").lastInsertRowid);
 const dIns=db.prepare("INSERT INTO estimate_dents(estimate_id,panel_id,panel_name,body_style,size,line_item_id,matrix_unit_price,price_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)");
 const u1=Number(dIns.run(e2id,"hood","Hood","sedan","dime",l1,P.dime,"Standard PDR matrix · Dime · sedan","x","x").lastInsertRowid);
 dIns.run(e2id,"hood","Hood","sedan","dime",l1,P.dime,"Standard PDR matrix · Dime · sedan","x","x");
 const u3=Number(dIns.run(e2id,"roof","Roof","sedan","nickel",l2,P.nickel,"Standard PDR matrix · Nickel · sedan (estimator entered 99.00)","x","x").lastInsertRowid);
 const u4=Number(dIns.run(e2id,"lf-door","LF Door","sedan","quarter",null,null,null,"x","x").lastInsertRowid);
 db.prepare("DELETE FROM app_migrations WHERE version='estimate-dent-pricing-v1'").run();
 const linesBefore=JSON.stringify(db.prepare("SELECT id,quantity,unit_price,total FROM estimate_line_items WHERE estimate_id=? ORDER BY id").all(e2id));
 db.close();
 await startServer();
 token=owner;
 const up=Object.fromEntries((await ok("GET",`/api/estimates/${e2id}/dents`)).map(d=>[d.id,d]));
 check("Upgrade: a Phase 2.1 billed dent keeps its matrix price as its calculated price",up[u1].suggestedPrice===P.dime&&up[u1].overridePrice===null);
 check("Upgrade: a Phase 2.1 entered price becomes a recorded override",up[u3].suggestedPrice===P.nickel&&up[u3].overridePrice===99&&/before Phase 2.2/.test(up[u3].overrideReason)&&up[u3].suggestedSource==="Standard PDR matrix · Nickel · sedan");
 check("Upgrade: an unbilled Phase 2.1 dent is priced from the current master",up[u4].suggestedPrice===P.quarter);
 db=new Database(dbPath,{readonly:true});
 check("Upgrade: Phase 2.1 lines are unchanged",JSON.stringify(db.prepare("SELECT id,quantity,unit_price,total FROM estimate_line_items WHERE estimate_id=? ORDER BY id").all(e2id))===linesBefore);
 db.close();
 console.log(JSON.stringify({passed:true,checks,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,checks,error:e.message,results,serverLog:log.slice(-3000)},null,2));
 process.exitCode=1;
}finally{
 await stopServer();
 rmSync(work,{recursive:true,force:true});
}
