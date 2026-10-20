// Phase 2.2 acceptance run through the real screens, the way the owner tests in Codespaces.
// Point it at a demo server started with `.devcontainer/demo.sh` (demo data only) and the demo login:
//   DEMO_DIR=/tmp/x/repairpro-demo DEMO_PORT=5195 bash .devcontainer/demo.sh setup && ... demo.sh start
//   ACCEPT_BASE=http://127.0.0.1:5195 ACCEPT_PASSWORD=<from DEMO-LOGIN.md> node script/phase22-acceptance.mjs [screenshot-dir]
// Needs Playwright and Chromium (not installed in CI). Every step clicks the visible interface.
import {mkdirSync} from "node:fs";
import {join,resolve} from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require("playwright"));}catch{({chromium}=await import(process.env.PLAYWRIGHT_MODULE||"playwright"));}
const base=process.env.ACCEPT_BASE||"http://127.0.0.1:5000",email=process.env.ACCEPT_EMAIL||"demo.owner@example.invalid",password=process.env.ACCEPT_PASSWORD;
if(!password)throw Error("Set ACCEPT_PASSWORD (the demo password from DEMO-LOGIN.md)");
const shots=process.argv[2]?resolve(process.argv[2]):null;if(shots)mkdirSync(shots,{recursive:true});
const results=[];const check=(name,passed,detail="")=>{results.push({name,passed,...(detail?{detail}:{})});if(!passed)throw Error(name+(detail?`: ${detail}`:""));};
const money=s=>Number(String(s).replace(/[^0-9.]/g,""));
let browser,savedEstimateUrl="";
async function session(viewport,label){
 const ctx=await browser.newContext({viewport,isMobile:label==="phone",hasTouch:label==="phone"});
 const p=await ctx.newPage(),problems=[];
 p.on("console",m=>{if(m.type()==="error"&&/Content Security Policy|Refused to/.test(m.text()))problems.push(m.text());});
 p.on("pageerror",e=>problems.push(e.message));
 const signIn=async(as=email,pw=password)=>{
  await p.getByLabel("Work email").fill(as);await p.getByLabel("Password",{exact:true}).fill(pw);
  await p.getByRole("button",{name:"Sign in",exact:true}).click();
  await p.getByRole("button",{name:"Sign out",exact:true}).waitFor({state:"attached"});
 };
 const nav=async name=>{
  if(await p.getByTestId("button-mobile-menu").isVisible())await p.getByTestId("button-mobile-menu").click();
  await p.getByRole("link",{name,exact:true}).first().click();
 };
 const reload=async()=>{await p.reload();await signIn();};
 return {ctx,p,problems,signIn,nav,reload};
}
// True when the element is inside the visible window, so the owner can actually see it without scrolling.
const inView=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>0&&r.top>=0&&r.bottom<=innerHeight;});
const shot=async(p,name)=>{if(shots)await p.screenshot({path:join(shots,name+".png"),fullPage:true});};

try{
 browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 // =================== desktop: full checklist ===================
 {
  const {p,problems,signIn,nav,reload}=await session({width:1366,height:900},"desktop");
  await p.goto(base+"/");await signIn();
  const version=(await p.getByTestId("text-build-version").textContent())||"";
  check("The menu shows the version under test",/^Version [0-9a-f]{7,} · built \d{4}-\d{2}-\d{2}$/.test(version.trim()),version);
  if(process.env.ACCEPT_EXPECT_VERSION)check(`Running version is ${process.env.ACCEPT_EXPECT_VERSION}`,version.includes(process.env.ACCEPT_EXPECT_VERSION),version);
  // 1. Edit standard dent prices through the normal navigation.
  await nav("Pricing Matrix");
  await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  const editor=p.getByTestId("pdr-pricing-editor");await editor.waitFor();
  const dime=editor.getByLabel("Standard Dime dent price, Sedan");
  check("Pricing Matrix → PDR Dent & Crease shows the existing standard dent prices",await dime.inputValue()==="125.00",await dime.inputValue());
  await dime.fill("130");await dime.press("Enter");
  await editor.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  await reload();await nav("Pricing Matrix");await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  check("A standard dent price change is still there after refreshing and signing in again",await p.getByTestId("pdr-pricing-editor").getByLabel("Standard Dime dent price, Sedan").inputValue()==="130.00");
  // 2. Configure crease pricing.
  const ed=p.getByTestId("pdr-pricing-editor");
  const addRange=async(a,b)=>{if(a!==null)await ed.getByLabel("New range from inches").fill(a);await ed.getByLabel("New range to inches").fill(b);await ed.getByRole("button",{name:"Add range"}).click();};
  await addRange("1","6");await ed.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  // Owner retest 2026-10-20: a second range that shares the first range's last inch looked like "Add" did nothing,
  // because the explanation appeared at the top of the page, out of view.
  await addRange("6","12");
  const rangeErr=ed.getByTestId("range-error");await rangeErr.waitFor();
  check("A second range sharing an inch (1\"–6\" then 6\"–12\") explains why, next to the Add range button",
    /overlaps the existing 1"–6" range/.test(await rangeErr.innerText())&&/Start the new range at 7"/.test(await rangeErr.innerText())&&await inView(rangeErr),await rangeErr.innerText());
  await ed.getByLabel("New range from inches").fill("");await ed.getByLabel("New range to inches").fill("");
  await reload();await nav("Pricing Matrix");await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  check("After the first range, \"New range from\" starts at the next free inch (7)",await ed.getByLabel("New range from inches").inputValue()==="7",await ed.getByLabel("New range from inches").inputValue());
  await addRange(null,"12");const saved=ed.getByTestId("pricing-save-status");await saved.getByText("Saved").waitFor();
  check("The second range 7\"–12\" is added, and the Saved notice is on screen",await ed.getByTestId("range-error").count()===0&&await inView(saved)&&await ed.getByLabel('Range 7"–12" from inches').count()===1);
  const c1=ed.getByLabel('Crease 1"–6" Deep price, Sedan');await c1.fill("200");await c1.press("Enter");await ed.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  const c2=ed.getByLabel('Crease 7"–12" Medium price, Sedan');await c2.fill("260");await c2.press("Enter");await ed.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  await ed.getByLabel("Crease adjustment, Difficult type").selectOption("percent");
  await ed.getByLabel("Crease adjustment, Difficult amount").fill("10");
  await ed.getByRole("button",{name:"Save"}).first().click();await ed.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  check("Overlapping range is refused with an explanation",await (async()=>{await addRange("5","8");await ed.getByTestId("range-error").getByText(/cannot overlap/).waitFor();return true;})());
  await ed.getByLabel("New range to inches").fill("");
  await shot(p,"desktop-1-pricing-editor");
  await reload();await nav("Pricing Matrix");await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  const ed2=p.getByTestId("pdr-pricing-editor");await ed2.waitFor();
  check("Crease ranges, crease prices and the difficulty adjustment are still there after reopening",
   await ed2.getByLabel('Crease 1"–6" Deep price, Sedan').inputValue()==="200.00"&&await ed2.getByLabel('Crease 7"–12" Medium price, Sedan').inputValue()==="260.00"
   &&await ed2.getByLabel("Crease adjustment, Difficult amount").inputValue()==="10"&&await ed2.getByLabel("Crease adjustment, Difficult type").inputValue()==="percent");
  // 3. Estimate with multiple dents (new customer, VIN-only vehicle).
  await nav("Estimates");await p.getByTestId("button-new-estimate").click();
  await p.getByTestId("button-create-customer-inline").click();
  await p.getByLabel("First name").fill("Accept");await p.getByLabel("Last name").fill("Tester");await p.getByLabel("Phone").fill("555-019-2202");
  await p.getByTestId("button-save-quick-customer").click();await p.getByText("Accept Tester").first().waitFor();
  await p.getByTestId("button-service-pdr").click();
  await p.locator("#estimate-vin").fill("1HGCV1F30LA000222");await p.waitForTimeout(800);
  await p.getByTestId("button-create-estimate").click();await p.waitForURL(/#\/estimates\/\d+/);
  const estimateUrl=p.url();savedEstimateUrl=estimateUrl;
  const map=p.getByTestId("card-dent-map");
  await map.getByText("Choose panel by name").click();
  await map.getByTestId("vpanel-option-hood").click();
  const d1=map.locator('[data-testid^="dent-"]').first();await d1.waitFor();
  await d1.getByLabel("Size").click();await p.getByRole("option",{name:"Crease",exact:true}).click();
  await d1.getByLabel("Length (in, required)").click();await p.getByRole("option",{name:'4"',exact:true}).click();await d1.getByText("Saved").waitFor();
  await d1.getByLabel("Severity").click();await p.getByRole("option",{name:"Deep",exact:true}).click();await p.waitForTimeout(300);
  await d1.getByLabel("Location difficulty").click();await p.getByRole("option",{name:"Difficult",exact:true}).click();await p.waitForTimeout(300);
  await map.getByTestId("button-add-dent").click();await map.locator('[data-testid^="dent-"]').nth(1).waitFor();
  await map.getByTestId("vpanel-option-roof").click();await map.locator('[data-testid^="dent-"]').first().waitFor();
  await map.getByTestId("button-add-dent").click();await p.waitForFunction(()=>document.querySelectorAll('[data-testid="card-dent-map"] [data-testid^="dent-"]').length===2);
  const billing=p.getByTestId("card-dent-billing");await billing.waitFor();
  await p.waitForFunction(()=>document.querySelectorAll('[data-testid="card-dent-billing"] [data-testid^="dent-price-"]').length===4);
  const rows=billing.locator('[data-testid^="dent-price-"]');
  const texts=await rows.allTextContents();
  check("The saved crease and standard prices are used in the estimate (crease $200 + 10% difficult = $220; dime $130)",texts.some(t=>/Hood · Crease · 4" · Deep · Difficult location.*\$220\.00/.test(t))&&texts.filter(t=>/Dime.*\$130\.00/.test(t)).length===3,texts.join(" | "));
  await shot(p,"desktop-2-estimate-dents");
  // 4. Bill individually (hood dime).
  const hoodDime=rows.filter({hasText:/^Hood · Dime/});
  await hoodDime.getByRole("checkbox").check();
  await billing.getByTestId("button-bill-individually").click();
  const sec3=p.getByTestId("estimate-section-3");
  await sec3.getByRole("cell",{name:/^Hood: Dime dent #2$/}).waitFor();
  check("Billing a dent individually adds one separately priced line",await sec3.getByRole("row").filter({hasText:"Hood: Dime dent #2"}).getByText("$130.00",{exact:true}).first().isVisible());
  // 5. Group by panel with a manual price below the calculated total; approval required.
  await billing.locator('[data-testid^="dent-price-"]').filter({hasText:/^Roof/}).first().waitFor();
  for(const r of await billing.locator('[data-testid^="dent-price-"]').filter({hasText:/^Roof/}).all())await r.getByRole("checkbox").check();
  await billing.getByTestId("button-panel-package").click();
  const form=billing.getByTestId("form-package");
  await form.getByLabel("Package price (you enter it)").fill("200");
  const cmp=await form.getByTestId("package-comparison").textContent();
  check("Package form shows calculated total $260, price $200, difference −$60.00 and −23.1%",/\$260\.00/.test(cmp)&&/\$200\.00/.test(cmp)&&/−\$60\.00/.test(cmp)&&/-23\.1%/.test(cmp),cmp);
  await form.getByTestId("button-create-package").click();
  await billing.getByText("Roof: dent repair package (2 dents)").waitFor();
  check("A discounted package is flagged as needing approval",await billing.getByTestId("text-package-needs-approval").isVisible());
  // Sending and approving are blocked until approval.
  await p.getByTestId("button-approve-estimate").click();
  await sec3.getByRole("alert").filter({hasText:/must approve the package price/}).first().waitFor();
  check("Mark Approved is blocked with a clear explanation until the package is approved",true);
  await p.getByTestId("button-send-estimate").click();await p.getByTestId("button-confirm-send").click();
  await p.getByText(/must approve the package price before this estimate can be sent/).waitFor();
  check("Sending is blocked with a clear explanation until the package is approved",true);
  await p.keyboard.press("Escape");
  // 8. Management approval.
  const pkgRoof=billing.locator('[data-testid^="package-"]').filter({hasText:"Roof: dent repair package"});
  await pkgRoof.getByRole("button",{name:"Approve package price"}).click();
  await pkgRoof.getByText(/Approved by .*Owner|Approved by/).waitFor();
  check("The owner approves the package price; who and when are shown",/Approved by/.test(await pkgRoof.textContent()));
  // 9. Change the approved price -> needs approval again.
  await pkgRoof.getByRole("button",{name:"Change package price"}).click();
  await pkgRoof.getByLabel("New package price").fill("210");
  await pkgRoof.getByRole("button",{name:"Save price"}).click();
  await pkgRoof.getByText("Needs approval").waitFor();
  check("Changing an approved package price requires approval again",await billing.getByTestId("text-package-needs-approval").isVisible());
  await pkgRoof.getByRole("button",{name:"Approve package price"}).click();await pkgRoof.getByText(/Approved by/).waitFor();
  // 6. Group by vehicle: move the crease and the individually billed dime into a whole-vehicle package.
  await billing.locator('[data-testid^="dent-price-"]').filter({hasText:/Crease/}).getByRole("checkbox").check();
  await billing.getByRole("checkbox",{name:/Select Hood · Dime/}).check();
  await billing.getByTestId("button-vehicle-package").click();
  // 7. Manual package price at or above the calculated total: no approval needed.
  await billing.getByTestId("form-package").getByLabel("Package price (you enter it)").fill("400");
  await billing.getByTestId("button-create-package").click();
  await billing.getByText("Whole-vehicle dent repair package (2 dents)").waitFor();
  check("Whole-vehicle package created; the dime's individual line is removed (no double charge)",await sec3.getByRole("cell",{name:/^Hood: Dime dent #2$/}).count()===0);
  const veh=billing.locator('[data-testid^="package-"]').filter({hasText:"Whole-vehicle"});
  check("A package above its calculated total needs no approval",/No approval needed/.test(await veh.textContent()));
  const total=money(await p.getByTestId("span-estimate-total").textContent());
  check("Estimate total = package prices only ($210 + $400)",total===610,String(total));
  await shot(p,"desktop-3-packages");
  // Existing estimates keep prices unless repriced: add an unbilled dent, change the master, compare.
  await map.getByTestId("vpanel-option-lf-door").click();await map.locator('[data-testid^="dent-"]').first().waitFor();
  await billing.locator('[data-testid^="dent-price-"]').filter({hasText:/LF Door · Dime/}).getByText("$130.00",{exact:true}).waitFor();
  await nav("Pricing Matrix");await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  const dime2=p.getByTestId("pdr-pricing-editor").getByLabel("Standard Dime dent price, Sedan");await dime2.fill("150");await dime2.press("Enter");
  await p.getByTestId("pdr-pricing-editor").getByTestId("pricing-save-status").getByText("Saved").waitFor();
  await p.goto(estimateUrl);
  const billing2=p.getByTestId("card-dent-billing");await billing2.waitFor();
  await billing2.getByTestId("matrix-changed").waitFor(); // the dent list refreshes from the server when the estimate reopens
  check("After a master price change, the estimate keeps $130 and offers repricing",await billing2.locator('[data-testid^="dent-price-"]').filter({hasText:/LF Door · Dime/}).getByText("$130.00",{exact:true}).isVisible()&&await billing2.getByTestId("matrix-changed").isVisible());
  check("Billed lines and packages are unchanged by the master change",money(await p.getByTestId("span-estimate-total").textContent())===610);
  await billing2.getByRole("button",{name:"Reprice from current matrix"}).click();
  await billing2.locator('[data-testid^="dent-price-"]').filter({hasText:/LF Door · Dime/}).getByText("$150.00",{exact:true}).waitFor();
  check("Reprice from current matrix applies the new price only when chosen",true);
  // 10. Save and reopen with all dent records intact.
  await reload();await p.goto(estimateUrl);
  await p.getByTestId("text-dent-summary").waitFor();
  check("After refresh and sign-in, all 5 dents, both packages and their approval are intact",
   /5 dents saved · 4 billed · 1 not yet billed/.test(await p.getByTestId("text-dent-summary").textContent())
   &&await p.getByTestId("card-dent-billing").getByText("Roof: dent repair package (2 dents)").isVisible()&&/Approved by/.test(await p.getByTestId("card-dent-billing").locator('[data-testid^="package-"]').filter({hasText:"Roof"}).textContent()));
  // 11. Print with details off, then on.
  const printed=async()=>{const [w]=await Promise.all([p.context().waitForEvent("page"),p.getByTestId("button-print-estimate").click()]);await w.waitForFunction(()=>document.body.innerText.includes("ESTIMATE"));const t=await w.evaluate(()=>document.body.innerText);await w.close();return t;};
  let text=await printed();
  check("Printed estimate with details off: package lines, no dent details",text.includes("Roof: dent repair package (2 dents)")&&!/Deep severity/.test(text));
  await p.getByTestId("switch-show-dent-details").click();await p.getByText("Dent details will show on the customer estimate and invoice.").waitFor();
  text=await printed();
  check("Printed estimate with details on: panel, size, length and severity; no notes or paint answer",text.includes('Hood · Crease · 4" long · Deep severity')&&!/Paint damage/i.test(text)&&!/Calculated/.test(text));
  // 12. Scheduling and technician assignments at the very bottom.
  const tops=await p.evaluate(()=>[1,2,3,4].map(n=>document.querySelector(`[data-testid="estimate-section-${n}"]`)?.getBoundingClientRect().top??-1));
  const last=await p.evaluate(()=>{const s=document.querySelector('[data-testid="estimate-section-4"]');return !!s&&!s.nextElementSibling;});
  check("Sections in order; scheduling and work planning are last",tops.every((t,i)=>t>=0&&(i===0||t>tops[i-1]))&&last);
  check("Desktop: no horizontal scrolling",await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
  check("Desktop: no CSP violations or page errors",problems.length===0,problems.join(" | "));
  await shot(p,"desktop-4-estimate");
  check("A PDR estimate's section 2 is titled \"Damage map and dent details\"",(await p.getByTestId("estimate-section-2").locator("h2,h3").first().innerText()).includes("dent details"));
  // Owner retest 2026-10-20: furniture and other non-dent estimates must not talk about dents.
  await nav("Estimates");await p.getByText("EST-2026-005",{exact:true}).first().click();
  const s2=p.getByTestId("estimate-section-2");await s2.waitFor();
  const s2Title=await s2.locator("h2,h3").first().innerText();
  check("A furniture estimate's section 2 is titled \"Damage map and damage details\", not dent details",s2Title.includes("damage details")&&!/dent/i.test(s2Title),s2Title);
  // Advisor: can view prices and create packages but cannot change pricing or approve.
  await p.getByRole("button",{name:"Sign out",exact:true}).click();
  results.push({name:"Desktop checklist complete",passed:true});
 }
 // =================== phone ===================
 {
  const {p,problems,signIn,nav}=await session({width:390,height:844},"phone");
  await p.goto(base+"/");await signIn();
  await nav("Pricing Matrix");await p.getByRole("tab",{name:"PDR Dent & Crease"}).click();
  const ed=p.getByTestId("pdr-pricing-editor");await ed.waitFor();
  const c=ed.getByLabel('Crease 7"–12" Deep price, Sedan');await c.fill("300");await c.press("Enter");await ed.getByTestId("pricing-save-status").getByText("Saved").waitFor();
  check("Phone: pricing editor reachable from the menu and editable",await c.inputValue()==="300.00");
  check("Phone: pricing editor has no horizontal page scrolling",await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
  await shot(p,"phone-1-pricing-editor");
  await nav("Estimates");
  await p.goto(savedEstimateUrl);
  await p.getByTestId("card-dent-billing").waitFor();
  check("Phone: estimate dents and packages open",await p.getByTestId("card-dent-billing").getByText("Whole-vehicle dent repair package (2 dents)").isVisible());
  check("Phone: estimate has no horizontal page scrolling",await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
  check("Phone: no CSP violations or page errors",problems.length===0,problems.join(" | "));
  await shot(p,"phone-2-estimate");
 }
 console.log(JSON.stringify({passed:true,results},null,2));
}catch(e){
 console.error(JSON.stringify({passed:false,error:e.message,results},null,2));process.exitCode=1;
}finally{await browser?.close();}
