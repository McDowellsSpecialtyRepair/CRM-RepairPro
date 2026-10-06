// Numeric facts transcribed from the carrier-hosted PDF, not a generic shop matrix.
export const HAIL_SOURCE = {
  carrier: "State Farm",
  revision: "125278.13 · 2025-04-29",
  checked: "2026-09-27",
  url: "https://role-based-content-app.digital.statefarm.com/b2b/pdr/docs/ss_paintless-dent-repair-matrix.pdf",
  scopeUrl: "https://role-based-content-app.digital.statefarm.com/b2b/pdr/paintless-dent-repair",
  title: "State Farm PDR Pricing Matrix for State Farm Paintless Dent Repair Agreement",
};
export const HAIL_CARRIERS = ["State Farm", "Allstate", "Farmers", "GEICO", "Liberty Mutual/Safeco", "Nationwide", "Progressive", "Travelers", "USAA"];
export const HAIL_SIZES = ["dime", "nickel", "quarter", "half_dollar"] as const;
export const HAIL_RANGES = [[1,5],[6,15],[16,30],[31,50],[51,75],[76,100],[101,150],[151,200],[201,250]] as const;
export type HailRate = number | "MCE";
// Four sizes per range, left-to-right in the original document.
const low: Record<string, HailRate[]> = {
  Hood: [80,100,125,150,125,175,200,250,200,225,275,350,300,350,425,500],
  Roof: [100,125,150,200,175,225,250,325,250,300,350,425,375,425,525,600],
  "Deck Lid": [80,100,125,150,125,150,200,250,175,225,275,300,275,325,400,475],
  "Roof Rail": [85,100,125,150,125,150,175,"MCE",200,250,275,"MCE",300,400,"MCE","MCE"],
  Fender: [80,100,125,150,125,150,175,200,175,225,275,300,275,300,350,375],
  Door: [80,100,125,150,125,150,175,200,175,225,250,300,275,300,350,"MCE"],
  Quarter: [80,100,125,150,125,150,175,200,175,225,250,300,275,325,400,475],
  "Cab Corner": [80,100,125,150,125,150,175,200,175,225,250,300,225,250,300,375],
  "Cowl, Other": [100,125,150,175,150,175,200,225,200,225,250,275,"MCE","MCE","MCE","MCE"],
};
const high: Record<string,HailRate[]> = {
  Hood: [375,400,500,625,450,550,650,750,550,650,"MCE","MCE",650,800,"MCE","MCE",725,825,"MCE","MCE"],
  Roof: [475,550,675,800,575,675,800,900,650,750,950,1100,850,950,1150,1450,950,1150,1350,1550],
  "Deck Lid": [400,450,500,600,450,550,650,"MCE",550,650,"MCE","MCE",650,"MCE","MCE","MCE",750,"MCE","MCE","MCE"],
};
export const HAIL_REFERENCE_ROWS = Object.entries(low).flatMap(([panel,values]) =>
  [...values,...(high[panel]||[])].map((price,i)=>({
    panel, sizeCategory:HAIL_SIZES[i%4], min:HAIL_RANGES[Math.floor(i/4)][0],
    max:HAIL_RANGES[Math.floor(i/4)][1], dentCountRange:HAIL_RANGES[Math.floor(i/4)].join("-"), price,
  })));
export const HAIL_RULES = [
  ["Source and scope",`${HAIL_SOURCE.title}; revision ${HAIL_SOURCE.revision}. Retrieved ${HAIL_SOURCE.checked}. Confirm applicability to the claim and your repair agreement. Not a guarantee of carrier payment.`],
  ["Mixed sizes","Use the size category representing the majority of dents on the panel."],
  ["Oversized","Damage exceeding half-dollar size: separately enter $50 per dent with a line remark. No separate $100 double-oversized rate is stated in this source."],
  ["Aluminum","25% of matrix base. Maximum ONE available upcharge per panel."],
  ["High Strength Steel","When requested, 25% of matrix base. Maximum ONE available upcharge per panel."],
  ["Double-layer / limited access","25% of matrix base. Limited-access areas such as roof rails can be subject to markup. Maximum ONE available upcharge per panel."],
  ["Large roof","25% of matrix base for full-size vans, full-size SUVs and extended-cab trucks. Verify actual vehicle eligibility. Maximum ONE available upcharge per panel."],
  ["Corrosion protection","$10 per panel, maximum $30 per vehicle; combination repairs may warrant additional labor and materials. Add separately after checking existing charges."],
  ["R&I","Necessary removal and installation uses times published in Collision Estimating Guides; guide times are not supplied by this app."],
  ["MCE / beyond published range","Most Cost Effective. Negotiate PDR case by case; never treat MCE or an absent cell as $0 or reuse a lower count bracket."],
  ["Glue-pull-only","No separate fixed glue-pull-only rate is specified in this carrier PDF. Document method/access and enter a proposed or agreed additional amount, including explicit $0 when already included."],
  ["Stretched / sharp dents","No separate fixed stretched-dent rate is specified in this carrier PDF. Assess repairability; document conventional repair, push-to-paint or replacement decisions and price separately."],
];
export const HAIL_UPCHARGES: Record<string,string> = {
  none:"None",
  aluminum:"Aluminum",
  hss:"HSS (when requested)",
  double:"Double-layer / limited access",
  large_roof:"Eligible large roof",
};
export const HAIL_EXTRAS = {
  oversized:"Oversized dents (> half-dollar)",
  double_oversized:"Double-oversized dents (manual, not a published $100 rate)",
  stretched:"Stretched / sharp dents (repairability review required)",
  glue:"Glue-pull-only (additional charge, not total panel price)",
  ri:"Removal and installation (guide-based manual amount)",
  other:"Other documented adjustment",
};
export type HailExtra = keyof typeof HAIL_EXTRAS;
export function savedHailCarriers(lines:{description?:string}[]):string[] {
  return Array.from(new Set(lines.flatMap(l=>Array.from((l.description||"").matchAll(/\[HAIL-CARRIER:([^\]]+)\]/g)).map(m=>m[1]).filter(c=>HAIL_CARRIERS.includes(c)))));
}
export interface HailDraft {
  panelId:string; panelName:string; matrixPanel:string;
  count:number; size:string; upcharge:string; baseOverride?:number|null;
  note:string;
  extras:Partial<Record<HailExtra,{count:number;unit:number|null}>>;
}
export function findHailRate(carrier:string,panel:string,count:number,size:string): HailRate | null {
  if(carrier!==HAIL_SOURCE.carrier || !Number.isInteger(count) || count<1)return null;
  return HAIL_REFERENCE_ROWS.find(r=>r.panel===panel&&r.sizeCategory===size&&count>=r.min&&count<=r.max)?.price??null;
}
const moneyValid=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1000000;
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
export function priceHailPanel(carrier:string,d:HailDraft) {
  const errors:string[]=[], lines:any[]=[];
  const reference=findHailRate(carrier,d.matrixPanel,d.count,d.size);
  const isSource=carrier===HAIL_SOURCE.carrier;
  if(!HAIL_CARRIERS.includes(carrier))errors.push("Choose a supported carrier.");
  const manual=d.baseOverride!=null;
  if(!Number.isInteger(d.count)||d.count<0||d.count>9999)errors.push("Enter a whole regular dent count from 0 to 9999.");
  if(!HAIL_SIZES.includes(d.size as any))errors.push("Choose a supported dent size.");
  if(!Object.hasOwn(HAIL_UPCHARGES,d.upcharge))errors.push("Choose a valid upcharge.");
  if(d.upcharge!=="none"&&(!isSource||manual||typeof reference!=="number"))errors.push("Automatic upcharges apply only to a published State Farm numeric matrix base. Include adjustments in a documented manual amount instead.");
  if(d.upcharge==="large_roof"&&d.matrixPanel!=="Roof")errors.push("The large-roof upcharge applies only to a Roof matrix row.");
  if(manual&&!moneyValid(d.baseOverride))errors.push("Enter a valid non-negative manual base amount.");
  if(d.count>0&&!manual&&typeof reference!=="number")errors.push(reference==="MCE"?"MCE: enter a documented negotiated panel amount.":"No verified numeric carrier rate for this panel/count/size. Enter a documented manual panel amount.");
  const activeExtras=Object.entries(d.extras).filter(([,v])=>v&&v.count>0);
  if(d.count===0&&(manual||d.upcharge!=="none"))errors.push("For zero regular dents, leave the base override blank and select no upcharge.");
  if(d.count===0&&!activeExtras.length)errors.push("Enter regular dents or at least one separately priced item.");
  if((manual||d.upcharge!=="none"||activeExtras.length)&&!d.note.trim())errors.push("Add a line remark / repairability or approval reference for adjustments.");
  const provenance=isSource?`State Farm ${HAIL_SOURCE.revision}; ${HAIL_SOURCE.url}`:`${carrier}: manual proposal; current carrier matrix not verified`;
  const append=(description:string,quantity:number,unitPrice:number,unit="panel",damageSize=d.size)=>{
    lines.push({serviceCategory:"pdr_hail",lineType:"labor",description:`${d.panelName}: ${description}. ${provenance}${d.note.trim()?`; Remark: ${d.note.trim()}`:""} [HAIL-CARRIER:${carrier}]`,panelLocation:d.panelName,damageSize,damageSeverity:"moderate",quantity,unit,unitPrice:cents(unitPrice)/100,total:cents(cents(unitPrice)/100*quantity)/100});
  };
  const base=manual&&moneyValid(d.baseOverride)?d.baseOverride!:typeof reference==="number"?reference:0;
  if(d.count>0)append(`${d.count} regular hail dents, ${d.size.replace("_"," ")}; ${manual?"manual base proposal":"published matrix base"}`,1,base);
  if(d.upcharge!=="none"&&Object.hasOwn(HAIL_UPCHARGES,d.upcharge))append(`${HAIL_UPCHARGES[d.upcharge]} upcharge, 25% of matrix base only (one per panel)`,1,cents(base*.25)/100);
  for(const [key,value] of Object.entries(d.extras)){
    if(!value)continue;
    if(!Object.hasOwn(HAIL_EXTRAS,key)||!Number.isInteger(value.count)||value.count<0||value.count>9999){errors.push("Separate item counts must be whole numbers from 0 to 9999.");continue;}
    if(!value.count)continue;
    // Non-standard items never inherit an invented carrier surcharge.
    const unit=key==="oversized"&&isSource&&value.unit==null?50:value.unit;
    if(!moneyValid(unit)){errors.push(`Enter an explicit unit amount for ${HAIL_EXTRAS[key as HailExtra]}, or 0 if included.`);continue;}
    append(`${HAIL_EXTRAS[key as HailExtra]}${key==="oversized"&&isSource&&value.unit==null?" (published $50 per dent)":" (manual additional amount; not a verified fixed carrier rate)"}`,value.count,unit!,key==="oversized"||key==="double_oversized"||key==="stretched"?"dent":"each",key==="oversized"||key==="double_oversized"||key==="stretched"?key:d.size);
  }
  return {reference,errors,lines,total:lines.reduce((sum,l)=>sum+cents(l.total),0)/100,provenance};
}
