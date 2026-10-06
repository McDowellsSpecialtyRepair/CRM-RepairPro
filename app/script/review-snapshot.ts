import {readFileSync,writeFileSync} from "node:fs";
import {defaultReport,REPORT_SOURCES,type ReportSource,GROUP_LABELS} from "../shared/reporting";
const dir="/home/user/workspace/review-qa",f=JSON.parse(readFileSync(`${dir}/browser-fixture.json`,"utf8"));
let token="";
async function api(method:string,path:string,body?:any){const r=await fetch("http://127.0.0.1:5001"+path,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(JSON.stringify(x));return x;}
token=(await api("POST","/api/auth/login",{email:f.email,password:f.password})).token;
const demo=JSON.parse(readFileSync(`${dir}/demo-data.json`,"utf8"));
demo.reports=[];demo.reportGroups=[];
for(const [source,definition] of Object.entries(REPORT_SOURCES)){
 for(const group of ["none",...definition.groups]){
  const config={...defaultReport(source as ReportSource),group,metrics:Object.keys(definition.metrics)};
  const entry={source,definition,config,groupLabel:GROUP_LABELS[group],report:await api("POST","/api/reports/run",config)};
  demo.reportGroups.push(entry);if(group===definition.groups[0])demo.reports.push(entry);
 }
}
demo.operations=await api("GET","/api/operations");
demo.campaigns=await api("GET","/api/campaigns");
demo.labor=await api("GET","/api/reports/technician-labor");
demo.generatedAt=new Date().toISOString();
writeFileSync(`${dir}/demo-data.json`,JSON.stringify(demo,null,2));
console.log(JSON.stringify({reportVariants:demo.reportGroups.length,metrics:demo.operations.metrics}));
