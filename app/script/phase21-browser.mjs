// Phase 2.1 browser check (local only; needs Playwright and Chromium, which CI does not install).
// Uses a temporary demo database. Desktop and phone widths: New Estimate with an inline customer
// and a VIN-only vehicle, the four-section estimate page, saved dent records that survive
// reopening, adding dents to the estimate, and no horizontal scrolling or CSP errors.
//   npm run build && node script/phase21-browser.mjs [screenshot-dir]
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {randomBytes} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require("playwright"));}catch{({chromium}=await import(process.env.PLAYWRIGHT_MODULE||"playwright"));}
const root=resolve(import.meta.dirname,".."),port=Number(process.env.HANDOFF_TEST_PORT||5192),base=`http://127.0.0.1:${port}`;
const shots=process.argv[2]?resolve(process.argv[2]):null;if(shots)mkdirSync(shots,{recursive:true});
const work=mkdtempSync(join(tmpdir(),"repairpro-p21-browser-"));
const env={...process.env,DB_PATH:join(work,"b.db"),EMAIL_OUTPUT_DIR:join(work,"emails"),PORT:String(port),NODE_ENV:"production",SMTP_HOST:"",SMTP_USER:"",SMTP_PASS:""};
delete env.HOST;
const {NODE_ENV:_p,...devEnv}=env;
const tsx=args=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:root,env:devEnv,stdio:"pipe"});
const results=[];const check=(name,passed,detail="")=>{results.push({name,passed,...(detail?{detail}:{})});if(!passed)throw Error(name+(detail?`: ${detail}`:""));};
let server,browser;
try{
 tsx(["script/seed-demo.ts"]);
 tsx(["script/bootstrap-owner.ts","owner@example.invalid",join(work,"invite.json")]);
 server=spawn(process.execPath,["dist/index.cjs"],{cwd:root,env,stdio:"ignore"});
 for(let i=0;i<100;i++){try{if((await fetch(base+"/api/auth/status")).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const password="Pp-"+randomBytes(18).toString("base64url");
 const {activationCode}=JSON.parse(readFileSync(join(work,"invite.json"),"utf8"));
 const act=await fetch(base+"/api/auth/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"owner@example.invalid",activationCode,password})});
 if(!act.ok)throw Error("activation failed");
 const login=await (await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"owner@example.invalid",password})})).json();
 const others=await (await fetch(base+"/api/estimates",{headers:{Authorization:`Bearer ${login.token}`}})).json();
 browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const [label,viewport] of [["desktop",{width:1366,height:900}],["phone",{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,isMobile:label==="phone",hasTouch:label==="phone"});
  const p=await ctx.newPage(),problems=[];
  p.on("console",m=>{if(m.type()==="error"&&/Content Security Policy|Refused to/.test(m.text()))problems.push(m.text());});
  p.on("pageerror",e=>problems.push(e.message));
  const signIn=async()=>{
   await p.getByLabel("Work email").fill("owner@example.invalid");
   await p.getByLabel("Password",{exact:true}).fill(password);
   await p.getByRole("button",{name:"Sign in",exact:true}).click();
   await p.getByRole("button",{name:"Sign out",exact:true}).waitFor({state:"attached"});
  };
  await p.goto(base+"/#/estimates");await signIn();
  await p.goto(base+"/#/estimates");
  await p.getByTestId("button-new-estimate").click();
  // Create the customer inside New Estimate.
  await p.getByTestId("button-create-customer-inline").click();
  const last=`Browser-${label}`;
  await p.getByLabel("First name").fill("Pat");await p.getByLabel("Last name").fill(last);
  await p.getByLabel("Phone").fill(label==="desktop"?"555-019-1001":"555-019-1002");
  await p.getByTestId("button-save-quick-customer").click();
  await p.getByText(`Pat ${last}`).first().waitFor();
  check(`${label}: customer created inside New Estimate and selected`,true);
  await p.getByTestId("button-service-pdr").click();
  // VIN-only vehicle: the sandbox has no NHTSA access, so this is also the "lookup failed" path.
  const vin=label==="desktop"?"1HGCV1F30LA000010":"1HGCV1F30LA000011";
  await p.locator("#estimate-vin").fill(vin);
  const create=p.getByTestId("button-create-estimate");
  await create.waitFor();
  await p.waitForTimeout(800);
  check(`${label}: Create is enabled with only a VIN`,await create.isEnabled());
  await create.click();
  await p.waitForURL(/#\/estimates\/\d+/);
  const estimateUrl=p.url();
  await p.getByTestId("estimate-section-1").waitFor();
  check(`${label}: estimate opens linked to the VIN-only vehicle`,await p.getByTestId("estimate-section-1").getByText(`VIN: ${vin}`).isVisible());
  // Section order.
  const order=await p.evaluate(()=>[1,2,3,4].map(n=>document.querySelector(`[data-testid="estimate-section-${n}"]`)?.getBoundingClientRect().top??-1));
  check(`${label}: four sections appear in order, work planning last`,order.every((t,i)=>t>=0&&(i===0||t>order[i-1])),JSON.stringify(order));
  check(`${label}: approval actions and delivery are in section 3`,await p.getByTestId("estimate-section-3").getByTestId("button-approve-estimate").count()===1);
  // Mark dents.
  const map=p.getByTestId("card-dent-map");
  await map.getByText("Choose panel by name").click();
  await map.getByTestId("vpanel-option-hood").click();
  const first=map.locator('[data-testid^="dent-"]').first();
  await first.waitFor();
  await first.getByLabel("Severity").click();await p.getByRole("option",{name:"Deep",exact:true}).click();
  await first.getByText("Saved").waitFor();
  await first.getByLabel("Location difficulty").click();await p.getByRole("option",{name:"Difficult",exact:true}).click();
  await first.getByLabel("Paint damage correctable?").click();await p.getByRole("option",{name:"No",exact:true}).click();
  await first.getByLabel("Length (in)").click();await p.getByRole("option",{name:'4"',exact:true}).click();
  await first.getByLabel(/Estimator notes/).fill("Browser note: behind the brace");
  await first.getByLabel(/Estimator notes/).blur();
  await first.getByText("Saved").waitFor();
  await map.getByTestId("button-add-dent").click();
  await map.locator('[data-testid^="dent-"]').nth(1).waitFor();
  const second=map.locator('[data-testid^="dent-"]').nth(1);
  await second.getByLabel("Size").click();await p.getByRole("option",{name:"Crease",exact:true}).click();
  check(`${label}: a crease is not saved until its length is chosen (no length filled in)`,await second.getByText("Choose the crease length to save this change").isVisible()&&await second.getByText("Length (in, required)").isVisible());
  await second.getByLabel("Length (in, required)").click();await p.getByRole("option",{name:'12"',exact:true}).click();
  await second.getByText("Saved").waitFor();
  check(`${label}: label reads exactly "Paint damage correctable?"`,await first.getByText("Paint damage correctable?",{exact:true}).isVisible());
  if(shots)await p.screenshot({path:join(shots,`${label}-dents.png`),fullPage:true});
  // Reopen: leave and come back; then sign in again after a reload.
  await p.goto(base+"/#/estimates");await p.goto(estimateUrl);
  await p.getByTestId("card-dent-map").waitFor();
  await p.getByTestId("text-dent-summary").getByText("2 dents saved").waitFor();
  await p.reload();await signIn();await p.goto(estimateUrl);
  await p.getByTestId("text-dent-summary").getByText("2 dents saved").waitFor();
  await p.getByTestId("card-dent-map").getByText("Choose panel by name").click();
  await p.getByTestId("card-dent-map").getByTestId("vpanel-option-hood").click();
  const reopened=p.getByTestId("card-dent-map").locator('[data-testid^="dent-"]').first();
  check(`${label}: dent details persist after reopening and signing in again`,
   await reopened.getByLabel("Severity").textContent()==="Deep"&&await reopened.getByLabel("Location difficulty").textContent()==="Difficult"&&
   await reopened.getByLabel("Paint damage correctable?").textContent()==="No"&&await reopened.getByLabel(/Estimator notes/).inputValue()==="Browser note: behind the brace");
  // Add to the estimate: the crease needs an entered price first.
  const toAdd=p.getByTestId("dents-to-add");
  check(`${label}: Add to estimate waits for the crease price`,await toAdd.getByTestId("button-add-dents").isDisabled());
  await toAdd.getByLabel("Unit price for Hood: crease").fill("125");
  await toAdd.getByTestId("button-add-dents").click();
  await p.getByTestId("estimate-section-3").getByRole("cell",{name:"Hood: crease"}).waitFor();
  check(`${label}: dents become estimate lines in section 3`,await p.getByTestId("estimate-section-3").getByRole("cell",{name:/^Hood: \w+ dent$/}).count()===1);
  check(`${label}: dent records remain after adding`,await p.getByTestId("text-dent-summary").getByText("2 on estimate lines").isVisible());
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  check(`${label}: no horizontal page scrolling`,overflow<=1,`overflow ${overflow}px`);
  if(shots)await p.screenshot({path:join(shots,`${label}-estimate.png`),fullPage:true});
  if(label==="desktop"){
   // Duplicate check inside New Estimate offers the existing customer instead of a second account.
   await p.goto(base+"/#/estimates");await p.getByTestId("button-new-estimate").click();
   await p.getByTestId("button-create-customer-inline").click();
   await p.getByLabel("First name").fill("Pat");await p.getByLabel("Last name").fill(last);await p.getByLabel("Phone").fill("555-019-1001");
   await p.getByTestId("duplicate-warning").waitFor();
   check(`${label}: likely duplicate blocks Create until confirmed`,await p.getByTestId("button-save-quick-customer").isDisabled());
   await p.getByRole("button",{name:"Use this existing customer"}).first().click();
   await p.getByText(`Pat ${last}`).first().waitFor();
   check(`${label}: duplicate warning selects the existing customer`,await p.getByTestId("form-quick-customer").count()===0);
   await p.keyboard.press("Escape");
   // Other services keep their existing damage tools inside the same four sections.
   for(const [service,card] of [["hail","card-damage-map"],["window_tint","card-tint-matrix"],["upholstery","card-damage-map"],["interior_repair","card-damage-map"]]){
    const est=others.find(e=>e.serviceType===service&&e.status!=="invoiced");
    if(!est)continue;
    await p.goto(`${base}/#/estimates/${est.id}`);
    await p.getByTestId("estimate-section-4").waitFor();
    const tops=await p.evaluate(()=>[1,2,3,4].map(n=>document.querySelector(`[data-testid="estimate-section-${n}"]`)?.getBoundingClientRect().top??-1));
    check(`${label}: ${service} estimate keeps its own damage tool in the four-section order`,tops.every((t,i)=>t>=0&&(i===0||t>tops[i-1]))&&await p.getByTestId("estimate-section-2").getByTestId(card).isVisible());
   }
  }
  check(`${label}: no CSP violations or page errors`,problems.length===0,problems.join(" | "));
  await ctx.close();
 }
 console.log(JSON.stringify({passed:true,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,error:e.message,results},null,2));process.exitCode=1;
}finally{
 await browser?.close();server?.kill("SIGTERM");rmSync(work,{recursive:true,force:true});
}
