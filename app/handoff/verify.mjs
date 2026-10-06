// Local-only clean-room smoke test. Does not use or copy an operating database.
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {randomBytes,randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Database=require("better-sqlite3");
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5187);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local test port");
const base=`http://127.0.0.1:${port}`;
try{await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});throw Error("Test port is already occupied; choose HANDOFF_TEST_PORT");}catch(e){if(e.message.includes("already occupied"))throw e;}
const work=mkdtempSync(join(tmpdir(),"repairpro-handoff-"));
const env={...process.env,DB_PATH:join(work,"test.db"),EMAIL_OUTPUT_DIR:join(work,"emails"),PORT:String(port),NODE_ENV:"production",SMTP_USER:"",SMTP_PASS:"",SMTP_HOST:"",SMTP_PORT:"587",SMTP_SECURE:"false"};
let log="",token="",checks=0,child;
const results=[];
function check(name,value){assert.ok(value,name);checks++;results.push({name,passed:true});}
async function call(method,path,body){
 const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=r.headers.get("content-type")?.includes("json")?await r.json():await r.text();
 return {status:r.status,data};
}
async function ok(method,path,body){const r=await call(method,path,body);assert.ok(r.status===200||r.status===201,`${path}: ${r.status} ${JSON.stringify(r.data).slice(0,250)}`);return r.data;}
try{
 child=spawn(process.execPath,["dist/index.cjs"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{log+=b;});child.stderr.on("data",b=>{log+=b;});
 let ready=false;
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw Error("Fresh server failed:\n"+log);
  try{const r=await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 check("Clean database server starts",ready);
 check("Anonymous financial access denied",(await call("GET","/api/invoices")).status===401);
 const inviteFile=join(work,"owner.json"),email="developer@example.invalid";
 execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","script/bootstrap-owner.ts",email,inviteFile],{cwd:root,env,stdio:"pipe"});
 const invite=JSON.parse(readFileSync(inviteFile,"utf8"));
 const auth=await ok("POST","/api/auth/activate",{email,activationCode:invite.activationCode,password:randomBytes(24).toString("base64url")});
 token=auth.token;check("Fresh owner can activate without existing credentials",typeof token==="string");
 const me=await ok("GET","/api/auth/me"),staffId=me.user?.id||me.id;
 const techs=(await ok("GET","/api/technicians")).filter(t=>t.status==="active").slice(0,2);
 assert.equal(techs.length,2);
 for(const [service,domain] of [["pdr","auto"],["hail","auto"],["window_tint","auto"],["interior_repair","auto"],["rv_interior","rv"],["rv_upholstery","rv"],["marine_interior","marine"],["marine_upholstery","marine"],["upholstery","asset"]]){
  const c=await ok("POST","/api/customers",{companyName:`Synthetic handoff ${service}`,customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
  const target=domain==="asset"?await ok("POST","/api/assets",{customerId:c.id,assetType:"sofa",name:"Synthetic sofa"}):await ok("POST","/api/vehicles",{customerId:c.id,vehicleType:domain,make:"Synthetic",model:"Test"});
  const e=await ok("POST","/api/estimates",{customerId:c.id,serviceType:service,...(domain==="asset"?{assetId:target.id}:{vehicleId:target.id}),taxRate:6});
  const ep=`/api/estimates/${e.id}`;
  const labor=await ok("POST",ep+"/line-items",{serviceCategory:"labor",description:"Separate repair labor",unitPrice:200});
  await ok("POST",ep+"/line-items",{serviceCategory:"material",description:"Material",quantity:3,unit:"yard",unitPrice:50,unitCost:20});
  await ok("POST",ep+"/line-items",{serviceCategory:"freight_in",description:"Inbound freight",unitPrice:10,unitCost:8});
  await ok("POST",ep+"/line-items",{serviceCategory:"freight_out",description:"Customer delivery",unitPrice:20,unitCost:15});
  await ok("POST",ep+"/line-items",{serviceCategory:"supplies",description:"Consumed supplies",unitPrice:0,unitCost:10,useTaxRate:6,taxNote:"Synthetic: vendor collected no tax"});
  const draft=await ok("GET",ep);
  check(`${service}: subtotal, tax and customer total`,draft.subtotal===380&&draft.taxAmount===9.6&&draft.total===389.6);
  await ok("PATCH",`/api/estimates/line-items/${labor.id}/classification`,{expectedVersion:1,lineType:"labor",splits:[{technicianId:techs[0].id,shareBps:6000},{technicianId:techs[1].id,shareBps:4000}]});
  await ok("PUT",ep+"/sales-team",{version:1,splits:[{staffId,shareBps:10000}]});
  const wrong=service==="pdr"?"upholstery":"pdr_dent";
  check(`${service}: foreign service category rejected`,(await call("POST",ep+"/line-items",{serviceCategory:wrong,description:"Wrong service",unitPrice:100})).status===400);
  await ok("PATCH",ep,{status:"approved"});
  const inv=await ok("POST",ep+"/convert-invoice",{});
  check(`${service}: invoice exact and conversion retry safe`,inv.total===389.6&&(await ok("POST",ep+"/convert-invoice",{})).id===inv.id);
  const credits=await ok("GET",`/api/invoices/${inv.id}/labor`);
  check(`${service}: two techs receive labor only`,credits.length===2&&credits.reduce((s,x)=>s+x.net_labor_cents,0)===20000);
  const commercial=await ok("GET",`/api/invoices/${inv.id}/commercial`);
  check(`${service}: sales credit and internal use tax retained`,commercial.sales[0].net_sales_cents===38000&&commercial.costs.some(x=>x.useTax===.6));
  const html=await ok("GET",`/print/invoice/${inv.id}`);
  check(`${service}: customer print excludes private cost note`,!html.includes("vendor collected no tax")&&html.includes("389.60"));
  await ok("POST","/api/payments",{invoiceId:inv.id,customerId:c.id,amount:389.6,paymentMethod:"cash",paymentDate:"2026-09-28",idempotencyKey:randomUUID()});
  const paid=await ok("GET",`/api/invoices/${inv.id}`);
  check(`${service}: payment closes balance`,paid.balanceDue===0&&paid.status==="paid");
 }
 const db=new Database(env.DB_PATH,{readonly:true});
 check("SQLite physical integrity",db.pragma("integrity_check")[0].integrity_check==="ok");
 check("SQLite foreign keys",db.pragma("foreign_key_check").length===0);
 db.close();
 const report={status:"PASS",checks,scope:"Fresh database, nine service flows; not a production certification",node:process.version,results};
 if(process.argv.includes("--report"))writeFileSync(join(root,"..","verification","fresh-run.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e.stack);process.exitCode=1;}
finally{
 if(child&&child.exitCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}
 rmSync(work,{recursive:true,force:true});
}
