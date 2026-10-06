import assert from "node:assert/strict";
import {documentBreakdown} from "../shared/estimate-rules";
import {breakdownHtml} from "../server/print-safety";
const cases=[
 {name:"reported legacy total",lines:[{lineType:"legacy",total:150},{lineType:"legacy",total:80}],subtotal:230,review:true,unknown:23000},
 {name:"mixed",lines:[{lineType:"parts",total:20},{lineType:"labor",total:100},{lineType:"legacy",total:30}],subtotal:150,review:true,unknown:3000},
 {name:"classified",lines:[{lineType:"parts",total:20},{lineType:"labor",total:100}],subtotal:120,review:false,unknown:0},
 {name:"missing lines",lines:[],subtotal:230,review:true,unknown:0},
 {name:"positive difference",lines:[{lineType:"labor",total:200}],subtotal:230,review:true,unknown:0},
 {name:"negative difference",lines:[{lineType:"labor",total:200}],subtotal:100,review:true,unknown:0},
 {name:"unknown type",lines:[{lineType:"",total:230}],subtotal:230,review:true,unknown:23000},
 {name:"decimal cents",lines:[{lineType:"parts",total:.1},{lineType:"labor",total:.2}],subtotal:.3,review:false,unknown:0},
 {name:"empty draft",lines:[],subtotal:0,review:false,unknown:0},
];
let checks=0;
for(const c of cases){
 const before=JSON.stringify(c),b=documentBreakdown(c.lines,c.subtotal);
 assert.equal(b.needsReview,c.review,c.name);
 assert.equal(b.rows.reduce((s,r)=>s+r.cents,0),Math.round(c.subtotal*100),c.name);
 assert.equal(b.rows.find(r=>r.key==="unclassified")?.cents||0,c.unknown,c.name);
 assert.equal(b.taxLabel.includes("not revalidated"),c.review,c.name);
 assert.equal(breakdownHtml(c.lines,c.subtotal).includes("Original amounts are preserved"),c.review,c.name);
 assert.equal(JSON.stringify(c),before,"Presentation never modifies input");
 checks+=6;
}
console.log(JSON.stringify({status:"PASS",checks,cases:cases.map(c=>c.name)},null,2));
