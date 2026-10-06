import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {documentBreakdown} from "../shared/estimate-rules";
import {breakdownHtml} from "../server/print-safety";
const cases=[
 {name:"reported legacy invoice",lines:[{lineType:"legacy",total:150},{lineType:"legacy",total:80}],subtotal:230,review:true,unknown:23000},
 {name:"mixed classification",lines:[{lineType:"parts",total:20},{lineType:"labor",total:100},{lineType:"legacy",total:30}],subtotal:150,review:true,unknown:3000},
 {name:"classified invoice",lines:[{lineType:"parts",total:20},{lineType:"labor",total:100}],subtotal:120,review:false,unknown:0},
 {name:"missing lines",lines:[],subtotal:230,review:true,unknown:0},
 {name:"subtotal mismatch",lines:[{lineType:"labor",total:200}],subtotal:230,review:true,unknown:0},
 {name:"negative discrepancy",lines:[{lineType:"labor",total:200}],subtotal:100,review:true,unknown:0},
 {name:"unknown type",lines:[{lineType:"",total:230}],subtotal:230,review:true,unknown:23000},
 {name:"whole cents",lines:[{lineType:"parts",total:.1},{lineType:"labor",total:.2}],subtotal:.3,review:false,unknown:0},
 {name:"empty draft",lines:[],subtotal:0,review:false,unknown:0},
];
let passed=0;
for(const c of cases){
 const b=documentBreakdown(c.lines,c.subtotal);
 assert.equal(b.needsReview,c.review,c.name);
 assert.equal(b.rows.reduce((s,r)=>s+r.cents,0),Math.round(c.subtotal*100),c.name);
 assert.equal(b.rows.find(r=>r.key==="unclassified")?.cents||0,c.unknown,c.name);
 assert.equal(b.taxLabel.includes("not revalidated"),c.review,c.name);
 assert.equal(breakdownHtml(c.lines,c.subtotal).includes("Original amounts are preserved"),c.review,c.name);
 passed+=5;
}
const db=new Database("data.db",{readonly:true});
let records=0;
for(const [table,lines,key] of [["invoices","invoice_line_items","invoice_id"],["estimates","estimate_line_items","estimate_id"]]){
 for(const d of db.prepare(`SELECT id,subtotal FROM ${table}`).all() as any[]){
  const b=documentBreakdown(db.prepare(`SELECT line_type lineType,total FROM ${lines} WHERE ${key}=?`).all(d.id) as any[],d.subtotal);
  assert.equal(b.rows.reduce((s,r)=>s+r.cents,0),Math.round(d.subtotal*100));
  passed++;records++;
 }
}
db.close();
console.log({passed,recordsReconciled:records,cases:cases.map(c=>c.name)});
