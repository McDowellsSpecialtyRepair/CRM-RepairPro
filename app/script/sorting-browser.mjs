const {writeFile}=await import("node:fs/promises");
export const results=[];
export const check=(name,passed)=>{results.push({name,passed});if(!passed)throw Error(name);};
export async function login(p,fixture) {
  await p.goto("http://127.0.0.1:5008/");
  await p.getByLabel("Work email").fill(fixture.email);
  await p.getByLabel("Password",{exact:true}).fill(fixture.password);
  await p.getByRole("button",{name:"Sign in",exact:true}).click();
  await p.getByRole("button",{name:"Sign out",exact:true}).waitFor({state:"attached"});
}
export async function navigate(p,name) {
  if(await p.getByTestId("button-mobile-menu").isVisible()) await p.getByTestId("button-mobile-menu").click();
  await p.getByRole("link",{name,exact:true}).first().click();
}
function expected(rows,field,dir,status) {
  const rank={low:1,normal:2,high:3,urgent:4};
  const value=r=>field==="priority"?rank[r.priority]:field==="number"?(r.jobNumber||r.estimateNumber):r[field]?.trim()||null;
  const cmp=(a,b)=>String(a).localeCompare(String(b),"en-US",{numeric:true,sensitivity:"base"});
  return rows.filter(r=>status==="all"||r.status===status).slice().sort((a,b)=>{
    const x=value(a),y=value(b);
    if(x==null&&y!=null)return 1;if(y==null&&x!=null)return -1;
    const diff=x==null||y==null?0:field==="priority"?x-y:cmp(x,y);
    return diff*(dir==="asc"?1:-1)||cmp(a.jobNumber||a.estimateNumber,b.jobNumber||b.estimateNumber)||a.id-b.id;
  }).map(r=>r.id);
}
export async function testSortPage(p,layout,kind,baseline) {
  await navigate(p,kind==="jobs"?"Jobs":"Estimates");
  await p.getByLabel("Sort by",{exact:true}).waitFor();
  for(const field of ["number","priority","assignedTech","scheduledDate"]) {
    await p.getByLabel("Sort by",{exact:true}).selectOption(field);
    if(field==="priority")check(`${layout} ${kind} urgency defaults urgent first`,await p.getByLabel("Sort order",{exact:true}).inputValue()==="desc");
    for(const dir of ["asc","desc"]) {
      await p.getByLabel("Sort order",{exact:true}).selectOption(dir);
      for(const status of kind==="jobs"?["all","pending","scheduled","in_progress","completed","cancelled"]:["all","draft","sent","approved","invoiced","rejected","expired"]) {
        await p.getByTestId(`button-filter-${status}`).click();
        const actual=await p.locator(`[data-testid^="${kind==="jobs"?"card-job-":"link-estimate-"}"]`).evaluateAll(es=>es.map(e=>Number(e.getAttribute("data-testid").split("-").pop())));
        check(`${layout} ${kind} ${field} ${dir} ${status}`,JSON.stringify(actual)===JSON.stringify(expected(baseline,field,dir,status)));
      }
    }
  }
  await p.getByTestId("button-filter-all").click();
  await p.getByLabel("Sort by",{exact:true}).selectOption("priority");
  await p.locator("main").evaluate(e=>e.scrollTop=0);
  check(`${layout} ${kind} no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:`/home/user/workspace/sorting-qa/${layout}-${kind}.png`});
  await save();
  console.log(layout,kind,"passed");
}
export async function save(){await writeFile("/home/user/workspace/sorting-qa/browser-results.json",JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,results},null,2));}
