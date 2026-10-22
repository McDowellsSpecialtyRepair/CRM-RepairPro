// A1 owner checklist, run through the real screens like a person would, against a demo server started with
// `.devcontainer/demo.sh` (demo data only). Local only: needs Playwright and Chromium.
//   ACCEPT_BASE=http://127.0.0.1:5000 ACCEPT_PASSWORD=... node script/a1-acceptance.mjs [screenshot-dir]
import {mkdirSync} from "node:fs";
import {resolve,join} from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require("playwright"));}catch{({chromium}=await import(process.env.PLAYWRIGHT_MODULE||"playwright"));}
const base=process.env.ACCEPT_BASE||"http://127.0.0.1:5000",email=process.env.ACCEPT_EMAIL||"demo.owner@example.invalid",password=process.env.ACCEPT_PASSWORD;
if(!password)throw Error("Set ACCEPT_PASSWORD to the demo password from DEMO-LOGIN.md");
const shots=process.argv[2]?resolve(process.argv[2]):null;if(shots)mkdirSync(shots,{recursive:true});
const results=[];const check=(name,passed,detail="")=>{results.push({name,passed,...(detail?{detail}:{})});if(!passed)throw Error(name+(detail?`: ${detail}`:""));};
const shot=async(p,name,full=true)=>{if(shots)await p.screenshot({path:join(shots,name+".png"),fullPage:full});};
let browser;
async function session(viewport,label){
 const ctx=await browser.newContext({viewport,isMobile:label==="phone",hasTouch:label==="phone"});
 const p=await ctx.newPage(),problems=[];
 p.on("console",m=>{if(m.type()==="error"&&/Content Security Policy|Refused to/.test(m.text()))problems.push(m.text());});
 p.on("pageerror",e=>problems.push(e.message));
 const signIn=async()=>{await p.getByLabel("Work email").fill(email);await p.getByLabel("Password",{exact:true}).fill(password);
  await p.getByRole("button",{name:"Sign in",exact:true}).click();await p.getByRole("button",{name:"Sign out",exact:true}).waitFor({state:"attached"});};
 const nav=async name=>{if(await p.getByTestId("button-mobile-menu").isVisible())await p.getByTestId("button-mobile-menu").click();await p.getByRole("link",{name,exact:true}).first().click();};
 return {ctx,p,problems,signIn,nav};
}
const noSideScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth<=1);
try{
 browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const [label,viewport] of [["desktop",{width:1366,height:900}],["phone",{width:390,height:844}]]){
  const {ctx,p,problems,signIn,nav}=await session(viewport,label);
  await p.goto(base+"/");await signIn();
  const version=(await p.getByTestId("text-build-version").textContent())||"";
  check(`${label}: the menu shows the version under test`,/^Version [0-9a-f]{7,}/.test(version.trim()),version);
  if(process.env.ACCEPT_EXPECT_VERSION)check(`${label}: running version is ${process.env.ACCEPT_EXPECT_VERSION}`,version.includes(process.env.ACCEPT_EXPECT_VERSION),version);

  // 1. Pricing Matrix: the old tabs say clearly that they are sample prices; PDR does not.
  await nav("Pricing Matrix");
  await p.getByTestId("pdr-pricing-editor").waitFor();
  check(`${label}: PDR Dent & Crease tab has no sample-price warning`,await p.getByTestId("sample-prices-banner").count()===0);
  await p.getByRole("tab",{name:"Upholstery"}).click();
  const banner=p.getByTestId("sample-prices-banner");await banner.waitFor();
  check(`${label}: Upholstery tab says "Sample prices from the original software. These are not McDowells prices."`,/not McDowells prices/.test(await banner.innerText()));
  await shot(p,`${label}-1-upholstery-sample-banner`,false);
  check(`${label}: the Pricing Matrix page says QuickBooks is not connected (no fake "pushed to QuickBooks" log)`,
   await p.getByTestId("card-quickbooks-not-connected").isVisible()&&await p.getByText(/pushed to QuickBooks/).count()===0);
  await p.getByRole("tab",{name:"Interior Vinyl"}).click();
  check(`${label}: Interior Vinyl tab also shows the sample-price warning`,await p.getByTestId("sample-prices-banner").isVisible());

  // 2. New Estimate for Robert Chen, furniture, new item with the Name box left blank.
  await nav("Estimates");
  await p.getByTestId("button-new-estimate").click();
  await p.getByTestId("input-customer-lookup").fill("Robert Chen");
  await p.getByRole("button",{name:"Select"}).first().click();
  await p.getByTestId("button-service-upholstery").click();
  await p.getByTestId("button-item-new").click();
  check(`${label}: the Name box is marked optional and explains what happens if it is blank`,
   /Name \(optional\)/.test(await p.getByText("Name (optional)").innerText())&&await p.getByText(/If left blank, it is saved as "Chair"/).isVisible());
  const create=p.getByTestId("button-create-estimate");
  check(`${label}: Create is enabled with the Name box left blank`,await create.isEnabled());
  await shot(p,`${label}-2-new-item-name-optional`,false);
  await create.click();
  await p.waitForURL(/#\/estimates\/\d+/);
  const estUrl=p.url(),estId=Number(estUrl.match(/estimates\/(\d+)/)[1]);
  await p.getByTestId("estimate-section-1").waitFor();
  const chairShown=await p.getByTestId("estimate-section-1").getByText("Chair",{exact:false}).first().waitFor({timeout:15000}).then(()=>true,()=>false);
  check(`${label}: the estimate opens, linked to a new item named "Chair"`,chairShown);
  check(`${label}: a furniture estimate's section 2 says "damage details", not dents`,/damage details/.test(await p.getByTestId("estimate-section-2").locator("h2").first().innerText()));

  // 3. People on the estimate: Salesperson, Estimator, Follow-up salesperson (sample staff from demo.sh).
  const card=p.getByTestId("card-estimate-people");await card.waitFor();
  const opts=await card.getByLabel("Salesperson",{exact:true}).locator("option").allInnerTexts();
  check(`${label}: the salesperson list includes the service writer and service advisor (not just Owner)`,
   opts.some(o=>/Sam Rivera \(service writer\)/.test(o))&&opts.some(o=>/Kelly Brooks/.test(o)),opts.join(" | "));
  await card.getByLabel("Salesperson",{exact:true}).selectOption({label:"Sam Rivera (service writer)"});
  await card.getByLabel("Estimator",{exact:true}).selectOption({label:"Kelly Brooks (service advisor)"});
  await card.getByLabel("Follow-up salesperson",{exact:true}).selectOption({label:"Morgan Lee (manager)"});
  await card.getByTestId("button-save-people").click();
  await card.getByText("People saved.").waitFor();
  await shot(p,`${label}-3-people-on-estimate`,false);
  await p.reload();await signIn();await p.goto(estUrl);
  const card2=p.getByTestId("card-estimate-people");await card2.waitFor();
  await p.waitForFunction(()=>{const s=document.querySelector('[data-testid="card-estimate-people"] select');return s&&s.selectedIndex>0;});
  const chosen=async l=>card2.getByLabel(l,{exact:true}).evaluate(s=>s.options[s.selectedIndex].text);
  check(`${label}: salesperson, estimator and follow-up are still there after signing out and in`,
   (await chosen("Salesperson"))==="Sam Rivera (service writer)"&&(await chosen("Estimator"))==="Kelly Brooks (service advisor)"&&(await chosen("Follow-up salesperson"))==="Morgan Lee (manager)");
  check(`${label}: the planning section shows the same salesperson (one place to change it)`,(await p.getByTestId("planning-salesperson").innerText()).includes("Sam Rivera"));

  // 4. Add Line Item: typing 600 shows 600, not 0600.
  await p.getByRole("button",{name:"Add materials"}).click();
  await p.getByTestId("input-description").fill("Vinyl, 3 yards");
  const price=p.getByTestId("input-unit-price");
  await price.click();await price.pressSequentially("600");
  check(`${label}: typing 600 in Customer unit price shows "600" (no leading zero)`,await price.inputValue()==="600",await price.inputValue());
  const qty=p.getByTestId("input-quantity");await qty.fill("");await qty.pressSequentially("3");
  check(`${label}: quantity shows "3" and the item total is $1,800.00`,await qty.inputValue()==="3"&&await p.getByText("Item total: $1,800.00").isVisible());
  const cost=p.getByLabel("Purchase unit cost");
  if(await cost.count()){await cost.click();await cost.pressSequentially("250.5");check(`${label}: typing 250.5 in purchase cost shows "250.5"`,await cost.inputValue()==="250.5",await cost.inputValue());}
  await shot(p,`${label}-4-line-item-no-leading-zero`,false);
  await p.getByTestId("button-add-item").click();
  await p.getByText("Vinyl, 3 yards").first().waitFor();
  check(`${label}: the line is saved at $1,800.00`,await p.getByText("$1,800.00").first().isVisible());

  // 5. Invoices list and detail: no fake "QB Synced" labels.
  await nav("Invoices");await p.getByText(/INV-2026-/).first().waitFor();
  check(`${label}: the invoices list shows no "QB Synced" / "Not Synced" labels`,await p.getByText(/QB Synced|Not Synced/).count()===0);

  check(`${label}: no sideways scrolling`,await noSideScroll(p));
  check(`${label}: no security-policy or page errors`,problems.length===0,problems.join(" | "));
  await ctx.close();
 }

 // 6. Printed estimate and invoice carry the logo (checked from the printable document itself).
 const login=await (await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})})).json();
 const auth={headers:{Authorization:`Bearer ${login.token}`}};
 const ests=await (await fetch(base+"/api/estimates",auth)).json();
 const est=ests.find(e=>e.estimateNumber==="EST-2026-001")||ests[0];
 const estHtml=await (await fetch(`${base}/print/estimate/${est.id}`,auth)).text();
 check("Printed estimate shows the McDowells logo",/<img src="data:image\/png;base64,[^"]{1000,}" alt="McDowells Specialty Repair"/.test(estHtml));
 const invs=await (await fetch(base+"/api/invoices",auth)).json();
 const invHtml=await (await fetch(`${base}/print/invoice/${invs[0].id}`,auth)).text();
 check("Printed invoice shows the McDowells logo",/alt="McDowells Specialty Repair"/.test(invHtml));
 if(shots){const ctx=await browser.newContext({viewport:{width:900,height:1100}});const pg=await ctx.newPage();
  await pg.setContent(estHtml.replace(/<script[\s\S]*?<\/script>/gi,""));await pg.screenshot({path:join(shots,"print-estimate-with-logo.png"),fullPage:false});await ctx.close();}
 console.log(JSON.stringify({passed:true,checks:results.length,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,error:e.message,results},null,2));
 process.exitCode=1;
}finally{await browser?.close();}
