// Explicit read-only source access. No raw business rows are exported by "schema".
import Database from "better-sqlite3";
import {resolve,dirname,join} from "node:path";
import {existsSync,mkdirSync,writeFileSync,chmodSync} from "node:fs";
const [command,sourceArg,destinationArg]=process.argv.slice(2);
if(!["schema","backup","check"].includes(command)||!sourceArg||(command!=="check"&&!destinationArg))
 throw Error("Usage: node handoff/database.mjs <schema|backup|check> <existing-database> [destination]");
const source=resolve(sourceArg);
if(!existsSync(source))throw Error("Database does not exist; refusing to create it.");
const db=new Database(source,{readonly:true,fileMustExist:true});
try{
 const integrity=db.pragma("integrity_check"),foreignKeys=db.pragma("foreign_key_check");
 if(integrity.some(x=>x.integrity_check!=="ok")||foreignKeys.length)throw Error("Database integrity failed; review locally before proceeding.");
 if(command==="check"){console.log("Physical integrity and foreign-key checks passed. Financial correctness requires separate reconciliation.");}
 if(command==="backup"){
  const output=resolve(destinationArg);
  if(output===source||existsSync(output))throw Error("Refusing to overwrite an existing file.");
  mkdirSync(dirname(output),{recursive:true,mode:0o700});
  await db.backup(output);
  chmodSync(output,0o600);
  console.log("Private consistent SQLite backup created. Contains personal data and password/session hashes. Encrypt and transfer separately; do not attach to public issues.");
 }
 if(command==="schema"){
  const out=resolve(destinationArg);mkdirSync(out,{recursive:true});
  const objects=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all();
  const tables=objects.filter(x=>x.type==="table").map(t=>({name:t.name,columns:db.pragma(`table_info("${t.name}")`),foreignKeys:db.pragma(`foreign_key_list("${t.name}")`)}));
  writeFileSync(join(out,"schema.sql"),"-- Metadata snapshot only. Do not use as a substitute for application startup migrations.\n-- Audit triggers require application-registered SQLite functions.\n\n"+objects.map(x=>x.sql+";").join("\n\n")+"\n");
  writeFileSync(join(out,"schema.json"),JSON.stringify({tables,objectCounts:objects.reduce((n,x)=>(n[x.type]=(n[x.type]||0)+1,n),{})},null,2));
  console.log(`Schema metadata exported for ${tables.length} tables. No row data exported.`);
 }
}finally{db.close();}
