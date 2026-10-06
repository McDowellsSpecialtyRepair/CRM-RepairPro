import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {HAIL_SOURCE,HAIL_REFERENCE_ROWS,HAIL_SIZES,HAIL_RANGES,HAIL_CARRIERS,HAIL_EXTRAS,findHailRate,priceHailPanel,savedHailCarriers,type HailDraft} from "../shared/hail-reference";
const tests:{name:string,passed:boolean,error?:string}[]=[];
function test(name:string,fn:()=>void){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:String(e)});}}
const pages=readFileSync("/home/user/workspace/hail-research/pages.jsonl","utf8").trim().split("\n").map(x=>JSON.parse(x));
const raw=pages.find(p=>p.url===HAIL_SOURCE.url).content as string;
const [lower,upper]=raw.slice(raw.indexOf("Average size")).split("Severity Class");
const panels=["Hood","Roof","Deck Lid","Roof Rail","Fender","Door","Quarter","Cab Corner","Cowl, Other"];
for(const [part,names,start,count] of [[lower,panels,0,16],[upper,panels.slice(0,3),4,20]] as const){
  for(let p=0;p<names.length;p++){
    const name=names[p],begin=part.indexOf(name)+name.length,end=p+1<names.length?part.indexOf(names[p+1]):part.length;
    const values=(part.slice(begin,end).match(/\b(?:\d+|MCE)\b/g)||[]).map(v=>v==="MCE"?"MCE":Number(v));
    test(`PDF ${name} ${start} cell count`,()=>assert.equal(values.length,count));
    values.forEach((value,i)=>test(`PDF ${name} range ${Math.floor(i/4)+start} size ${HAIL_SIZES[i%4]}`,()=>{
      const row=HAIL_REFERENCE_ROWS.find(r=>r.panel===name&&r.min===HAIL_RANGES[Math.floor(i/4)+start][0]&&r.sizeCategory===HAIL_SIZES[i%4]);
      assert.equal(row?.price,value);
    }));
  }
}
const draft=(patch:Partial<HailDraft>={}):HailDraft=>({panelId:"hood",panelName:"Hood",matrixPanel:"Hood",count:20,size:"quarter",upcharge:"none",baseOverride:null,note:"QA documented condition and proposal",extras:{},...patch});
test("204 published cells",()=>assert.equal(HAIL_REFERENCE_ROWS.length,204));
for(const row of HAIL_REFERENCE_ROWS)for(const n of [row.min,row.max])test(`Boundary ${row.panel} ${n} ${row.sizeCategory}`,()=>assert.equal(findHailRate("State Farm",row.panel,n,row.sizeCategory),row.price));
for(const c of HAIL_CARRIERS.filter(c=>c!=="State Farm"))test(`${c} does not inherit State Farm prices`,()=>assert.equal(findHailRate(c,"Hood",20,"quarter"),null));
test("Roof 250 half dollar correct",()=>assert.equal(findHailRate("State Farm","Roof",250,"half_dollar"),1550));
for(const [panel,n,size] of [["Hood",251,"dime"],["Door",51,"quarter"],["Roof",0,"dime"],["unrecognized",1,"dime"]] as const)test(`Absent ${panel}/${n} no fallback`,()=>assert.equal(findHailRate("State Farm",panel,n,size),null));
test("MCE preserved",()=>assert.equal(findHailRate("State Farm","Door",40,"half_dollar"),"MCE"));
test("MCE blocks automated line",()=>assert.ok(priceHailPanel("State Farm",draft({matrixPanel:"Door",count:40,size:"half_dollar"})).errors.length));
test("Base plus one upcharge plus OS does not mark up OS",()=>{const p=priceHailPanel("State Farm",draft({upcharge:"aluminum",extras:{oversized:{count:2,unit:null}}}));assert.equal(p.total,443.75);assert.equal(p.lines.length,3);assert.deepEqual(p.errors,[]);});
test("No multiple upcharge encoding",()=>assert.ok(priceHailPanel("State Farm",draft({upcharge:"aluminum,hss"})).errors.length));
test("Large roof does not apply to hood",()=>assert.ok(priceHailPanel("State Farm",draft({upcharge:"large_roof"})).errors.length));
test("No automatic upcharge on manually negotiated base",()=>assert.ok(priceHailPanel("State Farm",draft({baseOverride:500,upcharge:"aluminum"})).errors.length));
test("OS only supported",()=>{const p=priceHailPanel("State Farm",draft({count:0,extras:{oversized:{count:3,unit:null}}}));assert.equal(p.total,150);assert.deepEqual(p.errors,[]);});
for(const k of ["double_oversized","stretched","glue","ri","other"] as const){
  test(`${k} no invented fixed carrier rate`,()=>assert.ok(priceHailPanel("State Farm",draft({extras:{[k]:{count:1,unit:null}}})).errors.length));
  test(`${k} explicit zero allowed`,()=>assert.equal(priceHailPanel("State Farm",draft({extras:{[k]:{count:1,unit:0}}})).errors.length,0));
}
for(const c of HAIL_CARRIERS)test(`${c} manual amount works with note`,()=>assert.equal(priceHailPanel(c,draft({baseOverride:400})).errors.length,0));
for(const n of [-1,1.5,NaN,Infinity,10000])test(`Invalid count ${n}`,()=>assert.ok(priceHailPanel("State Farm",draft({count:n})).errors.length));
for(const n of [-1,NaN,Infinity])test(`Invalid money ${n}`,()=>assert.ok(priceHailPanel("State Farm",draft({baseOverride:n})).errors.length));
test("Adjustments require remark",()=>assert.ok(priceHailPanel("State Farm",draft({note:"",extras:{oversized:{count:1,unit:null}}})).errors.length));
test("Other insurers OS requires manual rate",()=>assert.ok(priceHailPanel("GEICO",draft({baseOverride:100,extras:{oversized:{count:1,unit:null}}})).errors.length));
test("Provenance and line type saved",()=>{const p=priceHailPanel("State Farm",draft());assert.ok(p.lines.every(l=>l.lineType==="labor"&&l.description.includes(HAIL_SOURCE.url)&&l.description.includes(HAIL_SOURCE.revision)));});
test("Saved carrier detected and deduplicated",()=>assert.deepEqual(savedHailCarriers(priceHailPanel("State Farm",draft({upcharge:"aluminum"})).lines),["State Farm"]));
test("Mixed carriers detected",()=>assert.equal(savedHailCarriers([...priceHailPanel("State Farm",draft()).lines,...priceHailPanel("GEICO",draft({baseOverride:50})).lines]).length,2));
test("Unknown carrier rejected",()=>assert.ok(priceHailPanel("Unknown",draft({baseOverride:50})).errors.length));
writeFileSync("/home/user/workspace/hail-qa/unit-results.json",JSON.stringify(tests,null,2));
console.log({total:tests.length,passed:tests.filter(t=>t.passed).length,failures:tests.filter(t=>!t.passed)});
if(tests.some(t=>!t.passed))process.exitCode=1;
