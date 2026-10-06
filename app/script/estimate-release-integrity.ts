import Database from "better-sqlite3";
import {writeFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {categoryAllowed,nonLaborCategory} from "../shared/estimate-rules";
const dir="/home/user/workspace/estimate-service-qa";
const live=new Database("/home/user/workspace/repair-crm/data.db",{readonly:true});
const backup=`${dir}/pre-release-backup.db`;
if(process.argv.includes("--backup")){
 if(existsSync(backup))throw Error("Backup already exists; refusing overwrite");
 await live.backup(backup);console.log("Pre-release backup saved.");
}else{
 const before=new Database(backup,{readonly:true});
 const tables=(before.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]).map(x=>x.name);
 const differences:string[]=[];
 for(const name of tables){
  const columns=(before.prepare(`PRAGMA table_info("${name}")`).all() as any[]).map(x=>`"${x.name}"`).join(",");
  const sql=`SELECT ${columns} FROM "${name}" ORDER BY rowid`;
  const hash=(db:any)=>createHash("sha256").update(JSON.stringify(db.prepare(sql).all())).digest("hex");
  if(hash(live)!==hash(before))differences.push(name);
 }
 const mixed=(live.prepare("SELECT e.estimate_number,e.status,e.service_type,l.id,l.service_category,l.line_type FROM estimates e JOIN estimate_line_items l ON e.id=l.estimate_id WHERE e.status!='invoiced'").all() as any[]).filter(l=>!categoryAllowed(l.service_type,l.service_category)||nonLaborCategory(l.service_category)&&l.line_type!=="parts");
 const result={tablesCompared:tables.length,changedExistingTables:differences,integrity:live.pragma("integrity_check"),foreignKeys:live.pragma("foreign_key_check"),legacyLinesNeedingReview:mixed};
 writeFileSync(`${dir}/release-integrity.json`,JSON.stringify(result,null,2));
 console.log(result); before.close();
 if(differences.some(n=>!["staff_sessions","security_audit"].includes(n))||result.foreignKeys.length||(result.integrity[0] as any).integrity_check!=="ok")process.exitCode=1;
}
live.close();
