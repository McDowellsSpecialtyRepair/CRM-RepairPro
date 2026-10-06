import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { sortWork, type WorkSort } from "../shared/work-sort";
const result: any[] = [];
const rows = [
  { id: 1, jobNumber: "JOB-2", priority: "low", assignedTech: " zeta ", scheduledDate: "2027-01-12" },
  { id: 2, jobNumber: "JOB-10", priority: "urgent", assignedTech: "Alpha 10", scheduledDate: "2028-02-29" },
  { id: 3, jobNumber: "JOB-3", priority: "high", assignedTech: "alpha 2", scheduledDate: "2027-01-01" },
  { id: 4, jobNumber: "JOB-4", priority: "normal", assignedTech: "", scheduledDate: null },
  { id: 5, jobNumber: "JOB-5", priority: "urgent", assignedTech: "ALPHA 2", scheduledDate: "2027-01-01" },
  { id: 6, jobNumber: "JOB-6", priority: "unknown", assignedTech: null, scheduledDate: "2027-02-30" },
];
const expected: Record<WorkSort, number[][]> = {
  number: [[1,3,4,5,6,2], [2,6,5,4,3,1]],
  priority: [[1,4,3,5,2,6], [5,2,3,4,1,6]],
  assignedTech: [[3,5,2,1,4,6], [1,2,3,5,4,6]],
  scheduledDate: [[3,5,1,2,4,6], [2,1,3,5,4,6]],
};
function test(name:string, fn:()=>void) {try{fn();result.push({name,passed:true});}catch(e:any){result.push({name,passed:false,error:e.message});}}
const original = JSON.stringify(rows);
for (const field of Object.keys(expected) as WorkSort[]) for (const [i, dir] of (["asc","desc"] as const).entries()) {
  test(`${field} ${dir} exact expected order`,()=>assert.deepEqual(sortWork(rows,field,dir).map(r=>r.id),expected[field][i]));
  test(`${field} ${dir} input unchanged`,()=>assert.equal(JSON.stringify(rows),original));
  test(`${field} ${dir} empty list`,()=>assert.deepEqual(sortWork([],field,dir),[]));
  test(`${field} ${dir} singleton`,()=>assert.deepEqual(sortWork([rows[0]],field,dir),[rows[0]]));
  test(`${field} ${dir} repeated sort stable`,()=>assert.deepEqual(sortWork(sortWork(rows,field,dir),field,dir),sortWork(rows,field,dir)));
}
test("Estimate numbers sort numerically",()=>assert.deepEqual(sortWork([{id:1,estimateNumber:"EST-10"},{id:2,estimateNumber:"EST-2"}],"number","asc").map(r=>r.id),[2,1]));
test("Equal numbers and values tie by ID",()=>assert.deepEqual(sortWork([{id:3,priority:"high"},{id:1,priority:"high"}],"priority","desc").map(r=>r.id),[1,3]));
writeFileSync("/home/user/workspace/sorting-qa/unit-results.json",JSON.stringify(result,null,2));
console.log({total:result.length,passed:result.filter(t=>t.passed).length,failures:result.filter(t=>!t.passed)});
if(result.some(t=>!t.passed))process.exitCode=1;
