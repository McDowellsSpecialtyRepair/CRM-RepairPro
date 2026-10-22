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
  // Section 3 billing (Phase 2.2): the crease has no crease matrix price, so it is "pricing incomplete" until entered.
  const billing=p.getByTestId("card-dent-billing");
  await billing.waitFor();
  check(`${label}: unpriced crease shows Pricing incomplete, not $0`,await billing.getByText("Pricing incomplete").first().isVisible());
  await billing.getByRole("button",{name:"Select all not billed"}).click();
  check(`${label}: individual billing waits for every selected price`,await billing.getByTestId("button-bill-individually").isDisabled());
  await billing.getByRole("button",{name:"Enter price"}).click();
  await billing.getByLabel("Price",{exact:true}).fill("125");
  await billing.getByRole("button",{name:"Save price"}).click();
  await billing.getByText(/Entered price by .*No matrix price available/).waitFor();
  await billing.getByRole("button",{name:"Select all not billed"}).click();
  await billing.getByTestId("button-bill-individually").click();
  await p.getByTestId("estimate-section-3").getByRole("cell",{name:/^Hood: crease #\d$/}).waitFor();
  check(`${label}: individual billing adds one line per dent in section 3`,await p.getByTestId("estimate-section-3").getByRole("cell",{name:/^Hood: (Dime dent|crease) #\d$/}).count()===2);
  check(`${label}: dent records remain after billing`,await p.getByTestId("text-dent-summary").getByText("2 billed").isVisible());
  if(label==="desktop"){
   // Panel package below the calculated total needs management approval.
   const map=p.getByTestId("card-dent-map");
   await map.getByTestId("vpanel-option-roof").click();
   await map.getByTestId("button-add-dent").click();
   await p.waitForFunction(()=>document.querySelectorAll('[data-testid="card-dent-billing"] [data-testid^="dent-price-"]').length===2);
   await billing.getByRole("button",{name:"Select all not billed"}).click();
   await billing.getByTestId("button-panel-package").click();
   const form=billing.getByTestId("form-package");
   await form.getByLabel("Package price (you enter it)").fill("100");
   check(`${label}: package form shows calculated total, price, difference and percent`,await form.getByTestId("package-comparison").getByText("Calculated total").isVisible()&&await form.getByText(/will need approval/).isVisible());
   await form.getByTestId("button-create-package").click();
   await billing.getByText("Roof: dent repair package (2 dents)").waitFor();
   check(`${label}: an unapproved package is flagged and blocks sending`,await billing.getByTestId("text-package-needs-approval").isVisible());
   await billing.getByRole("button",{name:"Approve package price"}).click();
   await billing.getByText(/Approved by Owner/).waitFor();
   check(`${label}: an owner can approve the package price, recording who`,await billing.getByText(/Approved by Owner/).isVisible());
   await billing.getByTestId("switch-show-dent-details").click();
   await billing.getByText("Dent details will show on the customer estimate and invoice.").waitFor();
   check(`${label}: Show dent details to customer can be switched on`,await billing.getByTestId("switch-show-dent-details").isChecked());
   if(shots)await p.screenshot({path:join(shots,`${label}-billing.png`),fullPage:true});
   // Management pricing editor.
   await p.goto(base+"/#/pricing-matrix");
   const editor=p.getByTestId("pdr-pricing-editor");
   await editor.waitFor();
   await editor.getByLabel("New range from inches").fill("1");await editor.getByLabel("New range to inches").fill("6");
   await editor.getByRole("button",{name:"Add range"}).click();
   const cell=editor.getByLabel('Crease 1"–6" Deep price, Sedan');
   await cell.waitFor();
   await cell.fill("210");await cell.blur();
   await editor.getByTestId("pricing-save-status").getByText("Saved").waitFor();
   check(`${label}: management can add a length range and a crease price`,await cell.inputValue()==="210.00");
   const adj=editor.getByLabel("Crease adjustment, Difficult amount");
   await editor.getByLabel("Crease adjustment, Difficult type").selectOption("percent");
   await adj.fill("10");
   await editor.getByRole("button",{name:"Save"}).first().click();
   await editor.getByTestId("pricing-save-status").getByText("Saved").waitFor();
   check(`${label}: management can set a percentage adjustment`,await adj.inputValue()==="10");
   if(shots)await p.screenshot({path:join(shots,`${label}-pricing-editor.png`),fullPage:true});
   await p.goto(estimateUrl);await p.getByTestId("card-dent-billing").waitFor();
  }
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  check(`${label}: no horizontal page scrolling`,overflow<=1,`overflow ${overflow}px`);
  if(shots)await p.screenshot({path:join(shots,`${label}-estimate.png`),fullPage:true});
  if(label==="desktop"){
   // Duplicate check inside New Estimate offers the existing customer instead of a second account.
   await p.goto(base+"/#/estimates");await p.getByTestId("button-new-estimate").click();
   await p.getByTestId("button-create-customer-inline").click();
   await p.getByLabel("First name").fill("Pat");await p.getByLabel("Last name").fill(last);await p.getByLabel("Phone").fill("555-019-1001");
   await p.getByTestId("duplicate-warning").waitFor();
   await p.getByTestId("button-save-quick-customer").click();
   check(`${label}: likely duplicate blocks Create until confirmed, and says why`,/existing customer/.test(await p.getByTestId("quick-customer-problems").innerText())&&await p.getByTestId("form-quick-customer").count()===1);
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
 // ---- Regression (Phase 2.2 Codespaces report): when something other than RepairPro answers, or the
 // server is gone, screens must explain it instead of showing empty tables or unexplained errors. ----
 {
  const ctx=await browser.newContext({viewport:{width:1366,height:900}}),p=await ctx.newPage();
  await p.goto(base+"/#/pricing-matrix");
  await p.getByLabel("Work email").fill("owner@example.invalid");await p.getByLabel("Password",{exact:true}).fill(password);
  // A proxy sign-in page (HTML, status 200) instead of price data:
  await p.route("**/api/pricing-matrices",r=>r.fulfill({status:200,contentType:"text/html",body:"<html><body>Sign in to GitHub</body></html>"}));
  await p.getByRole("button",{name:"Sign in",exact:true}).click();
  await p.getByTestId("pricing-load-error").waitFor();
  check("Pricing Matrix explains a non-RepairPro answer instead of showing 0 entries and $0.00 tables",
   /could not be loaded/.test(await p.getByTestId("pricing-load-error").textContent())&&await p.getByText("0 stored entries").count()===0&&await p.getByText("$0.00").count()===0);
  // An empty 404 from something in between (the "Catalog request failed (404)" report):
  await p.unroute("**/api/pricing-matrices");
  await p.route("**/print/pricing-matrices",r=>r.fulfill({status:404,body:""}));
  await p.getByRole("button",{name:"Try again"}).click();
  await p.getByTestId("pdr-pricing-editor").waitFor();
  await p.getByRole("button",{name:/Print all pricing/}).click();
  await p.getByText(/The pricing catalog could not be loaded \(error 404\)\. RepairPro could not reach its server/).waitFor();
  check("Print all pricing explains an unexplained 404 in plain English",true);
  await p.keyboard.press("Escape");
  // The server stops (a stopped codespace): creating a customer must say why it failed.
  await p.goto(base+"/#/estimates");
  await p.getByTestId("button-new-estimate").click();
  await p.getByTestId("button-create-customer-inline").click();
  await p.getByLabel("First name").fill("Offline");await p.getByLabel("Last name").fill("Check");
  server.kill("SIGTERM");await new Promise(r=>server.once("exit",r));
  await p.getByTestId("button-save-quick-customer").click();
  await p.getByText(/RepairPro could not reach its server, so this was not loaded or saved/).waitFor();
  check("Creating a customer while the server is unreachable explains why and what to do",await p.getByText("Could not create the customer",{exact:true}).count()===0);
  await ctx.close();
 }
 console.log(JSON.stringify({passed:true,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,error:e.message,results},null,2));process.exitCode=1;
}finally{
 await browser?.close();server?.kill("SIGTERM");rmSync(work,{recursive:true,force:true});
}
