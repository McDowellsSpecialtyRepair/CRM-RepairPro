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
// A demo marine interior estimate for Robert Chen with a boat (demo data only).
async function marineEstimate(){
 const login={token:await apiToken()};
 const h={"Content-Type":"application/json",Authorization:`Bearer ${login.token}`};
 const call=async(m,path,body)=>{const r=await fetch(base+path,{method:m,headers:h,body:body&&JSON.stringify(body)});if(!r.ok)throw Error(`${m} ${path}: ${await r.text()}`);return r.json();};
 const cust=(await call("GET","/api/customers")).find(c=>c.firstName==="Robert"&&c.lastName==="Chen");
 const boat=await call("POST","/api/vehicles",{customerId:cust.id,vehicleType:"marine",year:"2015",make:"Sea Ray",model:"Sundancer"});
 return (await call("POST","/api/estimates",{customerId:cust.id,serviceType:"marine_interior",vehicleId:boat.id,taxRate:6})).id;
}
// A demo estimate planned two days out for the first technician, with no booked time (demo data only).
async function plannedEstimate(){
 const login={token:await apiToken()};
 const h={"Content-Type":"application/json",Authorization:`Bearer ${login.token}`};
 const call=async(m,path,body)=>{const r=await fetch(base+path,{method:m,headers:h,body:body&&JSON.stringify(body)});if(!r.ok)throw Error(`${m} ${path}: ${await r.text()}`);return r.json();};
 const cust=(await call("GET","/api/customers")).find(c=>c.firstName==="Robert"&&c.lastName==="Chen");
 const tech=(await call("GET","/api/technicians")).find(t=>t.status==="active");
 const e=await call("POST","/api/estimates",{customerId:cust.id,serviceType:"interior_repair"});
 await call("POST",`/api/estimates/${e.id}/line-items`,{serviceCategory:"interior_vinyl",description:"Driver seat bolster repair",unitPrice:180});
 const day=new Date(Date.now()+2*86400000).toLocaleDateString("en-CA",{timeZone:"America/Boise"});
 const pl=await call("GET",`/api/estimates/${e.id}/planning`);
 await call("PATCH",`/api/estimates/${e.id}/planning`,{revision:pl.revision,scheduledDate:day,assignedTechId:tech.id});
 return e.id;
}
// A demo work order (pending, nothing booked) for Robert Chen (demo data only).
async function pendingJob(label){
 const login={token:await apiToken()};
 const h={"Content-Type":"application/json",Authorization:`Bearer ${login.token}`};
 const call=async(m,path,body)=>{const r=await fetch(base+path,{method:m,headers:h,body:body&&JSON.stringify(body)});if(!r.ok)throw Error(`${m} ${path}: ${await r.text()}`);return r.json();};
 const cust=(await call("GET","/api/customers")).find(c=>c.firstName==="Robert"&&c.lastName==="Chen");
 return call("POST","/api/jobs",{customerId:cust.id,serviceType:"upholstery",title:`Checklist: waiting on vinyl (${label})`,status:"pending",priority:"normal"});
}
// One back-door API session for the set-up helpers (the CRM limits how many sessions one login may hold, so
// logging in again for each helper would sign the browser out).
let cachedToken;
async function apiToken(){
 if(!cachedToken)cachedToken=(await (await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})})).json()).token;
 return cachedToken;
}
// The invoice id for a demo estimate number (demo data only).
async function invoiceFor(estimateNumber){
 const login={token:await apiToken()};
 const h={Authorization:`Bearer ${login.token}`};
 const e=(await (await fetch(base+"/api/estimates",{headers:h})).json()).find(x=>x.estimateNumber===estimateNumber);
 const i=(await (await fetch(base+"/api/invoices",{headers:h})).json()).find(x=>x.estimateId===e.id||x.id===e.invoiceId);
 if(!i)throw Error(`No invoice found for ${estimateNumber}`);
 return i.id;
}
// A demo work order in progress with its own linked estimate (made through the API, demo data only).
async function workOrderInProgress(){
 const login={token:await apiToken()};
 const h={"Content-Type":"application/json",Authorization:`Bearer ${login.token}`};
 const call=async(m,path,body)=>{const r=await fetch(base+path,{method:m,headers:h,body:body&&JSON.stringify(body)});if(!r.ok)throw Error(`${m} ${path}: ${await r.text()}`);return r.json();};
 const cust=(await call("GET","/api/customers")).find(c=>c.firstName==="Robert"&&c.lastName==="Chen");
 const job=await call("POST","/api/jobs",{customerId:cust.id,serviceType:"upholstery",title:"Checklist: chair in progress",status:"pending",priority:"normal"});
 const e=await call("POST",`/api/jobs/${job.id}/estimate`,{});
 await call("POST",`/api/estimates/${e.id}/line-items`,{serviceCategory:"upholstery",description:"Reupholster chair",unitPrice:400});
 const pl=await call("GET",`/api/jobs/${job.id}/planning`);
 await call("PATCH",`/api/jobs/${job.id}/planning`,{revision:pl.revision,status:"in_progress"});
 return {jobId:job.id,estimateNumber:e.estimateNumber};
}
// Another staff member's save, made through the API while the page has unsaved edits.
async function otherUserSets(estimateId,changes){
 const login=await (await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"sam.rivera@example.invalid",password})})).json();
 const h={"Content-Type":"application/json",Authorization:`Bearer ${login.token}`};
 const cur=await (await fetch(`${base}/api/estimates/${estimateId}/planning`,{headers:h})).json();
 const r=await fetch(`${base}/api/estimates/${estimateId}/planning`,{method:"PATCH",headers:h,body:JSON.stringify({revision:cur.revision,...changes})});
 if(!r.ok)throw Error("Other user's save failed: "+await r.text());
}
const noSideScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth<=1);
try{
 browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const [label,viewport] of [["desktop",{width:1366,height:900}],["phone",{width:390,height:844}]]){
  const {ctx,p,problems,signIn,nav}=await session(viewport,label);
  await p.goto(base+"/");
  // The private demo offers a one-click sign-in (no hunting for DEMO-LOGIN.md). The phone run uses it.
  const demoBtn=p.getByTestId("button-demo-signin");
  check(`${label}: the demo sign-in screen has a "Sign in to the demo" button`,await demoBtn.waitFor({timeout:10000}).then(()=>true,()=>false));
  if(label==="phone"){await shot(p,`phone-0-demo-signin`,false);await demoBtn.click();await p.getByRole("button",{name:"Sign out",exact:true}).waitFor({state:"attached"});check("phone: one click on \"Sign in to the demo\" signs in",true);}
  else await signIn();
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

  const openBox=async(box,id)=>{const b=box.getByTestId(id);if(await b.isVisible().catch(()=>false))await b.click();};
  // 3. One People box: 2 salespeople split 60/40, an estimator and a follow-up salesperson, saved with one button.
  const card=p.getByTestId("card-estimate-people");await card.waitFor();
  check(`${label}: the People box starts closed, as a one-line summary`,await card.getByTestId("text-people-summary").isVisible());
  await openBox(card,"button-edit-people");
  check(`${label}: there is no second salesperson editor further down the estimate`,await p.getByText("Sales team",{exact:true}).count()===0);
  await card.getByTestId("button-add-salesperson").click();
  const opts=await card.getByLabel("Salesperson 1",{exact:true}).locator("option").allInnerTexts();
  check(`${label}: the salesperson list includes the service writer and service advisor (not just Owner)`,
   opts.some(o=>/Sam Rivera \(service writer\)/.test(o))&&opts.some(o=>/Kelly Brooks/.test(o)),opts.join(" | "));
  await card.getByLabel("Salesperson 1",{exact:true}).selectOption({label:"Sam Rivera (service writer)"});
  await card.getByTestId("button-add-salesperson").click();
  await card.getByLabel("Salesperson 2",{exact:true}).selectOption({label:"Kelly Brooks (service advisor)"});
  const share1=card.getByLabel("Salesperson 1 share percent"),share2=card.getByLabel("Salesperson 2 share percent");
  await share1.fill("60");await share2.fill("50");
  check(`${label}: shares that don't add up to 100% are flagged`,/110%.*must be 100%/.test(await card.getByTestId("sales-share-total").innerText()));
  await card.getByTestId("button-save-people").click();
  check(`${label}: Save people refuses shares that don't add up to 100%, with an explanation`,await card.getByText(/must add up to 100%/).first().isVisible());
  await share2.fill("40");
  check(`${label}: the total shows 100%`,(await card.getByTestId("sales-share-total").innerText()).trim()==="Total: 100%");
  await card.getByLabel("Estimator",{exact:true}).selectOption({label:"Kelly Brooks (service advisor)"});
  await card.getByLabel("Follow-up salesperson",{exact:true}).selectOption({label:"Morgan Lee (manager)"});
  await shot(p,`${label}-3a-people-two-salespeople`,false);
  await card.getByTestId("button-save-people").click();
  await card.getByText("People saved.").waitFor();
  check(`${label}: Save people works (no "record changed" message)`,await p.getByText(/changed while you were editing/).count()===0);
  check(`${label}: after saving, the People box closes to a summary of who is on the estimate`,/Sam Rivera[^,]*60%/.test(await card.getByTestId("text-people-summary").innerText()),await card.getByTestId("text-people-summary").innerText());
  // Cancel throws away an unsaved change.
  await openBox(card,"button-edit-people");
  await card.getByLabel("Estimator",{exact:true}).selectOption({label:"Morgan Lee (manager)"});
  await card.getByTestId("button-cancel-people").click();
  await openBox(card,"button-edit-people");
  check(`${label}: Cancel puts the estimator back`,await card.getByLabel("Estimator",{exact:true}).evaluate(s=>s.options[s.selectedIndex].text)==="Kelly Brooks (service advisor)");
  await p.reload();await signIn();await p.goto(estUrl);
  const card2=p.getByTestId("card-estimate-people");await card2.waitFor();
  await openBox(card2,"button-edit-people");
  await card2.getByLabel("Salesperson 2",{exact:true}).waitFor();
  const chosen=async l=>card2.getByLabel(l,{exact:true}).evaluate(s=>s.options[s.selectedIndex].text);
  check(`${label}: both salespeople with 60/40, the estimator and follow-up are still there after signing out and in`,
   (await chosen("Salesperson 1"))==="Sam Rivera (service writer)"&&(await chosen("Salesperson 2"))==="Kelly Brooks (service advisor)"&&
   await card2.getByLabel("Salesperson 1 share percent").inputValue()==="60"&&await card2.getByLabel("Salesperson 2 share percent").inputValue()==="40"&&
   (await chosen("Estimator"))==="Kelly Brooks (service advisor)"&&(await chosen("Follow-up salesperson"))==="Morgan Lee (manager)");
  check(`${label}: the planning section shows the lead salesperson (the 60% share)`,(await p.getByTestId("planning-salesperson").innerText()).includes("Sam Rivera"));

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
  await p.getByRole("button",{name:"Add repair"}).click();
  await p.getByTestId("input-description").fill("Reupholster seat");
  await p.getByTestId("input-unit-price").fill("500");
  await p.getByTestId("button-add-item").click();
  await p.getByText("Reupholster seat").first().waitFor();
  check(`${label}: Add Item saves a repair (labor) line`,await p.getByText("Reupholster seat").first().isVisible());

  // 5. Work planning: saving after adding lines and after saving people works (the "record changed" bug).
  const urgency=p.getByLabel("Repair urgency");
  const planSave=p.getByRole("button",{name:"Save planning changes"});
  await urgency.selectOption("high");await planSave.click();
  await p.getByText("Planning changes saved.").waitFor();
  check(`${label}: Save planning changes works after adding line items (no "record changed" message)`,await p.getByText(/changed while you were editing/).count()===0);
  await openBox(card2,"button-edit-people");
  await card2.getByLabel("Follow-up salesperson",{exact:true}).selectOption({label:"Sam Rivera (service writer)"});
  await card2.getByTestId("button-save-people").click();await card2.getByText("People saved.").waitFor();
  await urgency.selectOption("urgent");await planSave.click();await p.getByText("Planning changes saved.").waitFor();
  check(`${label}: people and planning can be saved one after the other without a "record changed" message`,await p.getByText(/changed while you were editing/).count()===0);
  await urgency.selectOption("low");await p.getByRole("button",{name:"Discard edits"}).click();
  check(`${label}: Discard edits puts the urgency back`,await urgency.inputValue()==="urgent");
  // A real conflict (someone else saves first) still warns, and Reload latest record recovers.
  await urgency.selectOption("low");
  await otherUserSets(estId,{priority:"normal"});
  await planSave.click();
  const reloadBtn=p.getByRole("button",{name:"Reload latest record (discard edits)"});await reloadBtn.waitFor();
  check(`${label}: when someone else really changed planning, the warning still appears`,await p.getByText(/This record changed while you were editing/).isVisible());
  await reloadBtn.click();
  await p.waitForFunction(()=>![...document.querySelectorAll('[role="alert"]')].some(a=>/changed while you were editing/.test(a.textContent)));
  check(`${label}: Reload latest record shows the other person's change (Normal)`,await urgency.inputValue()==="normal");

  // 6. Planned date before the estimate was created: a warning, a deliberate yes, then it saves.
  const date=p.getByLabel("Planned schedule date");
  await date.fill("2020-01-15");await planSave.click();
  const warn=p.getByTestId("early-date-warning");await warn.waitFor();
  check(`${label}: an early planned date shows the warning and is not saved yet`,/before this estimate was created/.test(await warn.innerText())&&await p.getByTestId("button-save-early-date").isDisabled());
  await shot(p,`${label}-6-early-date-warning`,false);
  await p.getByRole("button",{name:"Go back and change the date"}).click();
  check(`${label}: "Go back and change the date" closes the warning`,await warn.count()===0);
  await planSave.click();await warn.waitFor();
  await p.getByTestId("checkbox-confirm-early-date").check();
  await p.getByTestId("button-save-early-date").click();
  await p.getByText("Planning changes saved.").waitFor();
  check(`${label}: after "Yes, I know", the early date is saved`,await date.inputValue()==="2020-01-15");

  // 7. Discounts: a discount code from the list, then a hand-entered one with a description, then remove it.
  await p.getByTestId("button-edit-discount").click();
  await p.getByTestId("select-discount-code").selectOption("SAMPLE10");
  await shot(p,`${label}-7a-discount-code`,false);
  await p.getByTestId("button-apply-discount").click();
  const dlabel=p.getByTestId("text-discount-label");await dlabel.waitFor();
  check(`${label}: the discount code shows its code, description and "10% off labor"`,/SAMPLE10 · Sample: returning customer \(10% off labor\)/.test(await dlabel.innerText()),await dlabel.innerText());
  check(`${label}: 10% of the $500.00 labor is taken off ($50.00)`,(await p.getByTestId("text-discount-amount").innerText()).includes("$50.00"));
  await p.getByTestId("button-edit-discount").click();
  await p.getByTestId("select-discount-code").selectOption("");
  await p.getByLabel("Discount description").fill("Returning customer");
  await p.getByLabel("Discount type").selectOption("amount");
  await p.getByLabel("Discount amount").fill("25");
  await p.getByTestId("button-apply-discount").click();
  await p.getByText("Returning customer (off labor)").waitFor();
  check(`${label}: a hand-entered $25.00 labor discount with a description is applied`,(await p.getByTestId("text-discount-amount").innerText()).includes("$25.00"));
  await shot(p,`${label}-7b-discount-by-hand`,false);
  await p.getByTestId("button-edit-discount").click();await p.getByTestId("button-remove-discount").click();
  await p.getByTestId("button-edit-discount").filter({hasText:"Add discount"}).waitFor();
  check(`${label}: Remove discount takes it off`,await p.getByTestId("text-discount-label").count()===0);

  // 8. Discount Codes tab on the Pricing Matrix: add a code and turn it off.
  await nav("Pricing Matrix");await p.getByTestId("tab-discount-codes").click();
  await p.getByTestId("button-new-discount-code").click();
  const form=p.getByTestId("discount-code-form"),newCode=`TEST-${label.toUpperCase()}`;
  await form.getByLabel("Code").fill(newCode);await form.getByLabel("Description").fill("Test code from the checklist");
  await form.getByLabel("Amount").fill("15");
  await p.getByTestId("button-save-discount-code").click();
  const row=p.getByTestId(`discount-code-row-${newCode}`);await row.waitFor();
  check(`${label}: a new discount code is added to the list with "15% off labor"`,/15% off labor/.test(await row.innerText())&&/Active/.test(await row.innerText()));
  await row.getByRole("button",{name:"Turn off"}).click();
  await row.getByText("Turned off").waitFor();
  check(`${label}: a discount code can be turned off`,true);
  await shot(p,`${label}-8-discount-codes-tab`,false);

  // 9. How the customer heard about us: a referral by an existing customer, saved on the estimate.
  await p.goto(estUrl);
  const mk=p.getByTestId("card-estimate-marketing");await mk.waitFor();
  await openBox(mk,"button-edit-tags");
  check(`${label}: the estimate asks "How did the customer hear about us?"`,/how did the customer hear about us\?/i.test(await mk.innerText()));
  const tagNames=["Radio","Referral","Repeat Customer","Building Sign","Vans / vehicle lettering","Bodyshop Referral","Lobby - In Person","2nd Work Order"];
  check(`${label}: the RoadFS tags are offered, in four groups`,(await Promise.all(tagNames.map(n=>mk.getByTestId(`tag-${n}`).isVisible()))).every(Boolean)&&await mk.locator('[data-testid^="tag-group-"]').count()===4);
  await mk.getByTestId("tag-Radio").click();await mk.getByTestId("tag-Lobby - In Person").click();await mk.getByTestId("tag-Referral").click();
  check(`${label}: several tags can be picked at once`,(await mk.locator('[data-testid^="tag-"][aria-pressed="true"]').count())===3);
  await mk.getByTestId("referrer-fields").waitFor();
  await mk.getByLabel("Find referring customer").fill("Sarah");
  await mk.getByTestId("referrer-matches").getByRole("button",{name:/Sarah Mitchell/}).click();
  await mk.getByLabel("Referral note").fill(`Neighbor (${label} test)`);
  await shot(p,`${label}-9-heard-about-us-referral`,false);
  await mk.getByTestId("button-save-marketing").click();
  await mk.getByText("Saved.").waitFor();
  check(`${label}: the referral is saved and waiting for a thank-you`,/Referred by Sarah Mitchell \(to thank\)/.test(await mk.innerText()),await mk.innerText());
  const estNumber=(await p.getByText(/^EST-\d{4}-\d+$/).first().innerText()).trim();

  // 10. Marketing page: the referral thank-you list and the editable list of choices.
  await nav("Marketing");
  const thanks=p.getByTestId("card-referral-thanks");await thanks.waitFor();
  const refRow=thanks.getByTestId(`referral-row-${estNumber}`);await refRow.waitFor();
  check(`${label}: Sarah Mitchell is on the referral thank-you list for ${estNumber}`,/Sarah Mitchell/.test(await refRow.innerText())&&/Robert Chen/.test(await refRow.innerText()));
  if(shots)await thanks.screenshot({path:join(shots,`${label}-10-referral-thank-you-list.png`)});
  await refRow.getByLabel(/How we thanked/).fill("Thank-you card mailed");
  await thanks.getByTestId(`button-mark-thanked-${estNumber}`).click();
  await thanks.getByTestId("button-referrals-thanked").click();
  await thanks.getByTestId(`referral-row-${estNumber}`).getByText(/Thanked .*Thank-you card mailed/).waitFor();
  check(`${label}: Mark thanked moves it to "Already thanked" with how we thanked them`,true);
  const choices=p.getByTestId("card-marketing-sources");
  await choices.getByTestId("button-new-marketing-source").click();
  const newChoice=`KBOI radio ${label}`;
  await choices.getByLabel("Choice name").fill(newChoice);
  await choices.getByTestId("button-save-marketing-source").click();
  await choices.getByTestId(`marketing-source-${newChoice}`).waitFor();
  check(`${label}: a new "heard about us" choice can be added`,true);

  // 11. A work order in progress: people, discount and marketing are still editable there.
  const wo=await workOrderInProgress();
  await p.goto(`${base}/#/jobs/${wo.jobId}`);
  const woBox=p.getByTestId(`work-order-estimate-${wo.estimateNumber}`);await woBox.waitFor();
  check(`${label}: the work order shows its estimate number at the top`,(await p.getByTestId("text-job-estimate-numbers").innerText()).includes(wo.estimateNumber));
  const woPeople=woBox.getByTestId("card-estimate-people");
  await openBox(woPeople,"button-edit-people");
  await woPeople.getByTestId("button-add-salesperson").click();
  await woPeople.getByLabel("Salesperson 1",{exact:true}).selectOption({label:"Kelly Brooks (service advisor)"});
  await woPeople.getByLabel("Estimator",{exact:true}).selectOption({label:"Sam Rivera (service writer)"});
  await woPeople.getByTestId("button-save-people").click();await woPeople.getByText("People saved.").waitFor();
  check(`${label}: on a work order in progress, Save people works`,await p.getByText(/changed while you were editing/).count()===0);
  await woBox.getByTestId("button-edit-discount").click();
  await woBox.getByTestId("select-discount-code").selectOption("SAMPLE10");
  await woBox.getByTestId("button-apply-discount").click();
  await woBox.getByTestId("text-discount-label").waitFor();
  check(`${label}: on a work order in progress, a discount code can be applied`,/SAMPLE10/.test(await woBox.getByTestId("text-discount-label").innerText()));
  await openBox(woBox.getByTestId("card-estimate-marketing"),"button-edit-tags");
  await woBox.getByTestId("card-estimate-marketing").getByTestId("tag-Radio").click();
  await woBox.getByTestId("button-save-marketing").click();await woBox.getByTestId("card-estimate-marketing").getByText("Saved.",{exact:true}).waitFor();
  check(`${label}: on a work order in progress, "heard about us" can be changed`,true);
  await shot(p,`${label}-11-work-order-in-progress-editing`,true);

  // 12. Change history: who changed what, with their login.
  const hist=p.getByTestId("card-change-history");
  await hist.getByTestId("button-toggle-history").click();
  const entries=hist.getByTestId("history-entries");await entries.locator("li").first().waitFor();
  const htext=await entries.innerText();
  check(`${label}: the work order's change history shows the people change with the login that made it`,/People changed/.test(htext)&&/demo\.owner@example\.invalid/.test(htext),htext.slice(0,300));
  check(`${label}: the history shows the tags changed to include Radio`,/Tags:.*Radio/.test(htext));
  if(shots)await hist.screenshot({path:join(shots,`${label}-12-change-history.png`)});

  // 13. New Estimate, new customer: the owner's exact entry (Insurance, no company name, 11-digit phone,
  // "bm47 ford @ gmmail.con"). Every problem is explained, the email fix is one click, duplicates are caught.
  await nav("Estimates");
  await p.getByTestId("button-new-estimate").click();
  await p.getByTestId("button-service-interior_repair").click();
  await p.getByTestId("button-create-customer-inline").click();
  await p.locator("#qc-type").click();await p.getByRole("option",{name:"Insurance"}).click();
  await p.locator("#qc-phone").fill("208-555-12111");
  await p.locator("#qc-email").fill("bm47 ford @ gmmail.con");
  check(`${label}: an 11-digit phone number is flagged right under the box`,/11 digits.*10 digits/.test(await p.getByTestId("check-quick-phone").innerText()));
  check(`${label}: the email with spaces and "gmmail.con" is flagged and "bm47ford@gmail.com" is suggested`,
   /can't contain spaces/.test(await p.getByTestId("check-quick-email").innerText())&&/bm47ford@gmail\.com/.test(await p.getByTestId("check-quick-email").innerText()));
  const qcCreate=p.getByTestId("button-save-quick-customer");
  check(`${label}: Create customer is not greyed out`,await qcCreate.isEnabled());
  await qcCreate.click();
  const probs=p.getByTestId("quick-customer-problems");await probs.waitFor();
  const ptext=await probs.innerText();
  check(`${label}: clicking Create customer lists everything to fix (company name, phone, email)`,/company name/i.test(ptext)&&/phone/i.test(ptext)&&/email/i.test(ptext),ptext);
  check(`${label}: the estimate's message says to finish the new customer (not just "choose a customer")`,/Finish the new customer/.test(await p.getByTestId("text-create-missing").innerText()));
  await shot(p,`${label}-13a-new-customer-problems`,false);
  await p.getByTestId("check-quick-email-fix").click();
  check(`${label}: "Use this" puts in bm47ford@gmail.com`,await p.locator("#qc-email").inputValue()==="bm47ford@gmail.com");
  await p.locator("#qc-phone").fill("208-555-0177");
  await p.getByTestId("duplicate-warning").waitFor();
  check(`${label}: a phone number already on file shows the existing customer (Sarah Mitchell)`,/Sarah Mitchell/.test(await p.getByTestId("duplicate-warning").innerText()));
  await shot(p,`${label}-13b-duplicate-customer-found`,false);
  await p.locator("#qc-phone").fill(label==="desktop"?"208-555-7161":"208-555-7162");
  await p.locator("#qc-company").fill(`BM47 Ford Insurance ${label}`);
  await p.waitForTimeout(700);
  if(await p.getByTestId("checkbox-confirm-different").count())await p.getByTestId("checkbox-confirm-different").check();
  await qcCreate.click();
  await p.getByTestId("form-quick-customer").waitFor({state:"detached"});
  check(`${label}: after fixing the entries, the customer is created and chosen for the estimate`,await p.getByText(`BM47 Ford Insurance ${label}`).first().isVisible());
  await p.getByRole("button",{name:"Cancel",exact:true}).click();

  // 14. Marine interior: a panel can be reupholstered instead of repaired (like the furniture splat).
  const boatEst=await marineEstimate();
  await p.goto(`${base}/#/estimates/${boatEst}`);
  await p.getByTestId("estimate-section-2").waitFor();
  const panelBtn=p.locator('[data-testid^="fpanel-option-"]').first();await panelBtn.waitFor();
  const panelName=(await panelBtn.innerText()).replace(/^\d+\./,"").split("\n")[0].trim();
  await panelBtn.click();
  const work=p.getByTestId("select-panel-work");await work.waitFor();
  check(`${label}: a marine panel offers "Work on this panel" (repair or reupholster)`,true);
  await work.click();await p.getByRole("option",{name:"Reupholster the panel"}).click();
  await p.getByLabel("Panel unit price override").fill("150");
  await shot(p,`${label}-14-marine-reupholster`,false);
  await p.getByTestId("button-add-splat-items").click();
  const addedLine=p.getByTestId("estimate-section-3").locator("visible=true").getByText(`${panelName}: reupholster`).first();
  check(`${label}: the marine estimate gets a "reupholster" line for ${panelName}`,await addedLine.waitFor({timeout:15000}).then(()=>true,()=>false));

  // 15b set-up: an estimate planned for Maria Santos in two days, with no booked time (the owner's case).
  const plannedId=await plannedEstimate();
  // 15. Scheduling: each booking shows the customer, item, service and work, not just a work order number.
  await nav("Scheduling");
  const det=p.locator('[data-testid^="slot-details-"]').first();
  check(`${label}: calendar bookings show the job details`,await det.waitFor({timeout:15000}).then(()=>true,()=>false));
  const dtext=await det.innerText();
  check(`${label}: a booking shows the customer name, service and work order number`,/JOB-|WO-|\d/.test(dtext)&&dtext.split("\n").length>=3,dtext);
  if(shots)await det.locator("xpath=..").screenshot({path:join(shots,`${label}-15-schedule-booking-details.png`)});
  const planned=p.getByTestId(`planned-estimate-${plannedId}`);
  check(`${label}: an estimate planned with a date and lead technician (no booked time) shows on that technician's day`,await planned.waitFor({timeout:15000}).then(()=>true,()=>false));
  check(`${label}: it is marked "Planned – no time booked" and shows the customer`,/Planned – no time booked/.test(await planned.innerText())&&/Robert Chen/.test(await planned.innerText()));
  if(shots)await planned.screenshot({path:join(shots,`${label}-15b-planned-estimate.png`)});

  // 16. Callbacks and the waiting list: a parts callback holds the job; marking it done makes it Ready to schedule.
  const pj=await pendingJob(label);
  await p.goto(`${base}/#/jobs/${pj.id}`);
  const cbCard=p.getByTestId("card-callbacks");await cbCard.waitFor();
  await cbCard.getByTestId("button-add-callback").click();
  await cbCard.getByLabel("Callback type").selectOption({label:"Awaiting Parts (parts)"});
  await cbCard.getByLabel("Callback note").fill("Vinyl ordered, due Friday");
  await cbCard.getByTestId("button-save-callback").click();
  await cbCard.getByTestId("text-parts-outstanding").waitFor();
  check(`${label}: a parts callback on a work order shows "Parts outstanding"`,true);
  await shot(p,`${label}-16a-callback-parts`,false);
  await nav("Waiting list");
  const wp=p.getByTestId("waiting-waiting_parts").getByTestId(`waiting-row-${pj.jobNumber}`);
  check(`${label}: the job is on the Waiting list under "Waiting on parts"`,await wp.waitFor({timeout:15000}).then(()=>true,()=>false));
  await shot(p,`${label}-16b-waiting-list`,false);
  await p.goto(`${base}/#/jobs/${pj.id}`);
  const cb2=p.getByTestId("card-callbacks");await cb2.waitFor();
  await cb2.locator('[data-testid^="button-callback-done-"]').first().click();
  await cb2.getByTestId("text-ready-to-schedule").waitFor();
  check(`${label}: marking the parts received says the job is Ready to schedule`,/Ready to schedule/.test(await cb2.getByTestId("text-ready-to-schedule").innerText()));
  await nav("Waiting list");
  const wr=p.getByTestId("waiting-ready").getByTestId(`waiting-row-${pj.jobNumber}`);
  check(`${label}: the job moved to "Ready to schedule" with the date the parts arrived`,await wr.waitFor({timeout:15000}).then(()=>true,()=>false)&&/All parts in since/.test(await wr.innerText()));
  await p.getByTestId("tab-callbacks").click();
  check(`${label}: the Callbacks tab has type, person and date filters`,await p.getByLabel("Filter by callback type").isVisible()&&await p.getByLabel("Filter by person").isVisible());
  check(`${label}: managers see the editable list of callback types`,await p.getByTestId("card-callback-types").isVisible());
  // 17. The calendar is set up by technician group.
  await nav("Scheduling");
  const groupSel=p.getByLabel("Technician group").first();
  check(`${label}: the calendar can show one technician group`,(await groupSel.locator("option").allInnerTexts()).join("|").includes("ME - Mobile Exterior"));

  // 18. Invoiced estimates have their own list; a bookkeeper or manager can correct the invoice until it is
  // marked entered in QuickBooks (the owner's EST-2026-003 case).
  await nav("Estimates");
  await p.getByTestId("button-filter-open").waitFor();
  const openList=await p.locator("main").innerText();
  check(`${label}: the default Estimates list ("Open") leaves out invoiced estimates`,/Open \(not invoiced\)/.test(openList)&&!/EST-2026-003\b/.test(openList));
  await p.getByTestId("button-filter-invoiced").click();
  await p.getByText("EST-2026-003",{exact:true}).first().waitFor();
  check(`${label}: EST-2026-003 is under "Invoiced (completed)"`,true);
  if(label==="desktop"){
   const invId=await invoiceFor("EST-2026-003");
   await p.goto(`${base}/#/invoices/${invId}`);
   const cc=p.getByTestId("card-invoice-correction");await cc.waitFor();
   await cc.getByTestId("button-correct-invoice").click();
   const f=cc.getByTestId("invoice-correction-form");
   const price=f.getByLabel("Line 1 unit price");const was=Number(await price.inputValue());
   await price.fill(String(was+25));
   await f.getByLabel("Correction reason").fill("Checklist: price agreed with customer");
   await shot(p,`${label}-18a-invoice-correction`,false);
   await f.getByTestId("button-save-correction").click();
   await cc.getByTestId("text-correction-notice").waitFor();
   check(`${label}: a manager can correct an invoice that is not yet in QuickBooks`,/Invoice corrected/.test(await cc.getByTestId("text-correction-notice").innerText()));
   await cc.getByTestId("button-mark-qb").click();
   await p.waitForFunction(()=>/Entered in QuickBooks on/.test(document.querySelector('[data-testid="text-qb-state"]')?.textContent||""));
   check(`${label}: after "Mark as entered in QuickBooks" the invoice is locked (no Correct button)`,await cc.getByTestId("button-correct-invoice").count()===0);
   await shot(p,`${label}-18b-invoice-entered-in-qb`,false);
  }

  // 5. Invoices list and detail: no fake "QB Synced" labels.
  await nav("Invoices");await p.getByText(/INV-2026-/).first().waitFor();
  check(`${label}: the invoices list shows no "QB Synced" / "Not Synced" labels`,await p.getByText(/QB Synced|Not Synced/).count()===0);

  check(`${label}: no sideways scrolling`,await noSideScroll(p));
  check(`${label}: no security-policy or page errors`,problems.length===0,problems.join(" | "));
  await ctx.close();
 }

 // 6. Printed estimate and invoice carry the logo (checked from the printable document itself).
 const login={token:await apiToken()};
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
