import {readFileSync,writeFileSync} from "node:fs";
const dir="/home/user/workspace/sorting-qa", f=JSON.parse(readFileSync(`${dir}/fixture.json`,"utf8"));
let token="";
async function req(method:string,path:string,body?:any){
 const r=await fetch("http://127.0.0.1:5008"+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${JSON.stringify(d)}`);return d;
}
token=(await req("POST","/api/auth/login",f)).token;
const c=await req("POST","/api/customers",{companyName:"QA Sorting",customerType:"retail",email:"service@mcdowellsrepair.com",confirmDuplicate:true});
const techs=[];
for(const name of ["QA zeta","QA Alpha 10","QA alpha 2"])techs.push(await req("POST","/api/technicians",{name,email:"service@mcdowellsrepair.com",skillAreas:"pdr",technicianType:"in_shop",status:"active"}));
const configs=[
 {priority:"low",scheduledDate:"2027-01-12",assignedTechId:techs[0].id},
 {priority:"urgent",scheduledDate:"2028-02-29",assignedTechId:techs[1].id},
 {priority:"high",scheduledDate:"2027-01-01",assignedTechId:techs[2].id},
 {priority:"normal",scheduledDate:null,assignedTechId:null},
 {priority:"urgent",scheduledDate:"2027-01-01",assignedTechId:techs[2].id},
 {priority:"normal",scheduledDate:null,assignedTechId:null},
];
const jobs=[], estimates=[], tests=[];
for(const [i,conf] of configs.entries()){
 const j=await req("POST","/api/jobs",{customerId:c.id,serviceType:"pdr",title:`QA Sorting ${i+1}`,status:i%2?"scheduled":"pending"});
 const p=await req("GET",`/api/jobs/${j.id}/planning`);await req("PATCH",`/api/jobs/${j.id}/planning`,{revision:p.revision,...conf});
 const e=await req("POST","/api/estimates",{customerId:c.id,serviceType:"pdr",...(i<4?{jobId:j.id}:{})});
 if(i>=4){const ep=await req("GET",`/api/estimates/${e.id}/planning`);await req("PATCH",`/api/estimates/${e.id}/planning`,{revision:ep.revision,...conf});}
 jobs.push(j);estimates.push(e);
}
const list=await req("GET","/api/estimates");
for(const [i,e] of estimates.entries()){
 const row=list.find((r:any)=>r.id===e.id), p=await req("GET",`/api/estimates/${e.id}/planning`);
 tests.push({name:`Estimate ${i+1} list matches planning editor`,passed:row.priority===p.priority&&row.assignedTechId===p.assignedTechId&&row.assignedTech===p.assignedTech&&row.scheduledDate===p.scheduledDate});
 tests.push({name:`Estimate ${i+1} financial values unchanged`,passed:row.total===0&&row.subtotal===0&&row.taxAmount===0});
}
writeFileSync(`${dir}/api-results.json`,JSON.stringify(tests,null,2));
writeFileSync(`${dir}/ui-fixture.json`,JSON.stringify({...f,jobs,estimates}),{mode:0o600});
console.log({checks:tests.length,passed:tests.filter(t=>t.passed).length});
if(tests.some(t=>!t.passed))process.exitCode=1;
