// Explicit read-only source access. No raw business rows are exported by "schema".
// Backups are encrypted with BACKUP_ENCRYPTION_KEY (see script/backup-crypto.mjs).
import Database from "better-sqlite3";
import {resolve,dirname,join} from "node:path";
import {existsSync,mkdirSync,writeFileSync,chmodSync,rmSync} from "node:fs";
import {backupKey,newBackupKey,encryptFile,decryptFile} from "../script/backup-crypto.mjs";
const args=process.argv.slice(2),allowUnencrypted=args.includes("--allow-unencrypted");
const [command,sourceArg,destinationArg]=args.filter(a=>a!=="--allow-unencrypted");
const usage="Usage: node handoff/database.mjs <check|schema|backup|decrypt> <source> [destination] [--allow-unencrypted]\n       node handoff/database.mjs keygen";
if(command==="keygen"){
 console.log(newBackupKey());
 console.error("New BACKUP_ENCRYPTION_KEY printed above. Store it in a password manager or secret store, separately from the backups. Without it, encrypted backups cannot be restored.");
 process.exit(0);
}
if(!["schema","backup","check","decrypt"].includes(command)||!sourceArg||(command!=="check"&&!destinationArg))throw Error(usage);
const source=resolve(sourceArg);
if(!existsSync(source))throw Error("Source does not exist; refusing to create it.");
if(command==="decrypt"){
 const key=backupKey();
 if(!key)throw Error("Set BACKUP_ENCRYPTION_KEY to the key used when the backup was made.");
 const output=resolve(destinationArg);
 if(output===source||existsSync(output))throw Error("Refusing to overwrite an existing file.");
 mkdirSync(dirname(output),{recursive:true,mode:0o700});
 await decryptFile(source,output,key);
 const restored=new Database(output,{readonly:true,fileMustExist:true});
 try{
  if(restored.pragma("integrity_check").some(x=>x.integrity_check!=="ok")||restored.pragma("foreign_key_check").length)throw Error("Decrypted database failed integrity checks; do not use it.");
 }finally{restored.close();}
 console.log("Backup decrypted and verified (integrity and foreign keys). Restore it into an isolated location first; it contains personal data.");
 process.exit(0);
}
const db=new Database(source,{readonly:true,fileMustExist:true});
try{
 const integrity=db.pragma("integrity_check"),foreignKeys=db.pragma("foreign_key_check");
 if(integrity.some(x=>x.integrity_check!=="ok")||foreignKeys.length)throw Error("Database integrity failed; review locally before proceeding.");
 if(command==="check"){console.log("Physical integrity and foreign-key checks passed. Financial correctness requires separate reconciliation.");}
 if(command==="backup"){
  const output=resolve(destinationArg),key=backupKey();
  if(!key&&!allowUnencrypted)throw Error("Set BACKUP_ENCRYPTION_KEY (generate one with: node handoff/database.mjs keygen), or pass --allow-unencrypted to write a plain backup deliberately.");
  if(output===source||existsSync(output))throw Error("Refusing to overwrite an existing file.");
  mkdirSync(dirname(output),{recursive:true,mode:0o700});
  if(key){
   // SQLite's consistent backup API needs a file; it exists only until it is encrypted.
   const plain=`${output}.plain-${process.pid}`;
   try{await db.backup(plain);chmodSync(plain,0o600);await encryptFile(plain,output,key);}finally{rmSync(plain,{force:true});}
   console.log("Encrypted consistent SQLite backup created (AES-256-GCM). Restore with: node handoff/database.mjs decrypt <backup> <new-database>");
  }else{
   await db.backup(output);
   chmodSync(output,0o600);
   console.log("UNENCRYPTED consistent SQLite backup created. Contains personal data and password/session hashes. Encrypt and transfer separately; do not attach to public issues.");
  }
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
