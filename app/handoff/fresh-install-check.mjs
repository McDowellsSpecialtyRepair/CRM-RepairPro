// Local-only check that a production start never creates demonstration data or default
// credentials, that repeated starts and db:migrate are idempotent, and that db:seed-demo
// refuses unsafe targets. Uses temporary databases only; never an operating database.
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Database=require("better-sqlite3");
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5188);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid local test port");
const base=`http://127.0.0.1:${port}`;
try{await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});throw Error("Test port is already occupied; choose HANDOFF_TEST_PORT");}catch(e){if(e.message.includes("already occupied"))throw e;}
const work=mkdtempSync(join(tmpdir(),"repairpro-fresh-"));
const dbPath=join(work,"fresh.db");
// Demo-looking variables are set deliberately to prove the server ignores them.
const env={...process.env,DB_PATH:dbPath,EMAIL_OUTPUT_DIR:join(work,"emails"),PORT:String(port),NODE_ENV:"production",SEED_DEMO:"1",SEED_DEMO_DATA:"true",SMTP_USER:"",SMTP_PASS:"",SMTP_HOST:""};
const results=[];let checks=0;
function check(name,value){assert.ok(value,name);checks++;results.push({name,passed:true});}
const tsx=(script,extraEnv)=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",script],{cwd:root,env:extraEnv,stdio:"pipe"});
const refuses=(script,extraEnv)=>{try{tsx(script,extraEnv);return false;}catch{return true;}};
async function startStop(){
 let log="";const child=spawn(process.execPath,["dist/index.cjs"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{log+=b;});child.stderr.on("data",b=>{log+=b;});
 try{
  for(let n=0;n<100;n++){
   if(child.exitCode!==null)throw Error("Server failed:\n"+log);
   try{const r=await fetch(base+"/api/auth/status",{signal:AbortSignal.timeout(500)});if(r.ok)return {status:await r.json(),log};}catch{}
   await new Promise(r=>setTimeout(r,200));
  }
  throw Error("Server did not start:\n"+log);
 }finally{if(child.exitCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}}
}
function snapshot(){
 const db=new Database(dbPath,{readonly:true});
 try{
  const n=t=>db.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n;
  const counts=Object.fromEntries(["customers","users","technicians","staff_accounts","staff_invitations","jobs","estimates","invoices","payments","bookings","campaigns","activities","qb_sync_log","service_templates","pricing_matrices","tax_jurisdictions"].map(t=>[t,n(t)]));
  const ledger=db.prepare("SELECT version FROM app_migrations").all().map(r=>r.version);
  return {counts,ledger,integrity:db.pragma("integrity_check")[0].integrity_check,fk:db.pragma("foreign_key_check").length};
 }finally{db.close();}
}
try{
 const first=await startStop();
 check("Production server starts on an empty database",first.status.authenticationRequired===true);
 check("Fresh install requires owner setup (no accounts or default credentials)",first.status.setupRequired===true);
 const a=snapshot();
 for(const t of ["customers","users","technicians","staff_accounts","staff_invitations","jobs","estimates","invoices","payments","bookings","campaigns","activities","qb_sync_log"])
  check(`No demonstration ${t} created`,a.counts[t]===0);
 check("Reference catalog loaded once",a.counts.service_templates>0&&a.counts.pricing_matrices>0&&a.counts.tax_jurisdictions>0);
 check("Migration ledger records reference catalog and integrity, not demo data",a.ledger.includes("reference-catalog-v1")&&a.ledger.includes("integrity-v1")&&!a.ledger.includes("demo-data-v1"));
 check("Fresh database integrity and foreign keys",a.integrity==="ok"&&a.fk===0);
 await startStop();
 check("Second start is idempotent (no duplicate reference data)",JSON.stringify(snapshot())===JSON.stringify(a));
 const {NODE_ENV:_p,...devEnv}=env;
 tsx("script/migrate.ts",devEnv);
 check("db:migrate succeeds on an existing database without loading demo data",JSON.stringify(snapshot())===JSON.stringify(a));
 check("db:migrate writes a pre-migration backup",readdirSync(work).some(f=>f.startsWith("fresh.db.pre-migrate-")&&f.endsWith(".bak")));
 check("db:seed-demo refuses an existing database",refuses("script/seed-demo.ts",devEnv));
 check("db:seed-demo refuses NODE_ENV=production",refuses("script/seed-demo.ts",{...env,DB_PATH:join(work,"new-prod.db")}));
 const {DB_PATH:_d,...noPath}=devEnv;
 check("db:seed-demo requires an explicit DB_PATH",refuses("script/seed-demo.ts",noPath));
 check("db:migrate requires an explicit DB_PATH",refuses("script/migrate.ts",noPath));
 check("Unchanged after refused commands",JSON.stringify(snapshot())===JSON.stringify(a));
 const report={status:"PASS",checks,scope:"Fresh production install; demo data opt-in only",node:process.version,results};
 console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e.stack);process.exitCode=1;}
finally{rmSync(work,{recursive:true,force:true});}
