import Database from "better-sqlite3";
import { existsSync, writeFileSync } from "node:fs";
const dir = "/home/user/workspace/workorders-qa";
const before = new Database(`${dir}/main-before.db`, {readonly:true});
const live = new Database("/home/user/workspace/repair-crm/data.db", {readonly:true});
const tables = before.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[];
const changed: string[] = [];
for(const {name} of tables) {
  const sql=`SELECT * FROM "${name}" ORDER BY rowid`;
  if(JSON.stringify(before.prepare(sql).all())!==JSON.stringify(live.prepare(sql).all()))changed.push(name);
}
const qa = new Database(`${dir}/test.db`, {readonly:true});
const result = {
  existingMainTablesCompared: tables.length, changedMainTables: changed,
  mainIntegrity: live.pragma("integrity_check"), mainForeignKeys: live.pragma("foreign_key_check"),
  qaIntegrity: qa.pragma("integrity_check"), qaForeignKeys: qa.pragma("foreign_key_check"),
  addedMainTables: (live.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('job_planning','estimate_planning')").all() as any[]).map(r=>r.name),
};
if (!existsSync(`${dir}/pre-release-backup.db`)) await live.backup(`${dir}/pre-release-backup.db`);
before.close();live.close();qa.close();
writeFileSync(`${dir}/integrity-results.json`,JSON.stringify(result,null,2));
console.log(result);
if(changed.length)process.exitCode=1;
