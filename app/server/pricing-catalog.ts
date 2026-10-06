import type {Express} from "express";
import {storage} from "./storage";
import {printable} from "./print-safety";
import {FURNITURE_PANEL_PRICES} from "../client/src/lib/splat-pricing";
import {FURNITURE_STYLES,FURNITURE_NAMES} from "../client/src/lib/furniture-geometry";
import {SERVICES} from "../client/src/lib/services";
import {HAIL_SOURCE,HAIL_RULES,HAIL_REFERENCE_ROWS,HAIL_RANGES,HAIL_SIZES} from "../shared/hail-reference";

type Table = {heading:string; description?:string; columns:string[]; rows:string[][]; ids:number[]};
const titles:Record<string,string>={pdr_dent:"Paintless dent repair",pdr_hail:"Generic hail repair",window_tint:"Window tint",interior_vinyl:"Vinyl / plastic interior repair",interior_fabric:"Fabric interior repair",upholstery:"General upholstery",labor:"Labor rates",material:"Material rates"};
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const label=(s:any)=>s==null||s===""?"Not specified":String(s).replace(/_/g," ");
const serviceSections:Record<string,string>={
  pdr:"Paintless dent repair; shared labor and materials",
  hail:"Generic hail; insurer-specific hail; shared labor and materials",
  window_tint:"Window tint; service templates",
  interior_repair:"Vinyl / plastic and fabric repair; leather service template; shared labor and materials",
  rv_interior:"Shared vinyl / plastic and fabric repair matrices; shared labor and materials",
  rv_upholstery:"RV diagram-panel rates; general upholstery; shared labor and materials",
  marine_interior:"Shared vinyl / plastic and fabric repair matrices; shared labor and materials",
  marine_upholstery:"Marine diagram-panel rates; general upholstery; shared labor and materials",
  upholstery:"General upholstery; furniture / booth diagram-panel rates; quote-required furniture variations; shared labor and materials",
};
export const catalogNotes=[
  "Internal working price reference, not a customer quote or proof of carrier approval. These are the rates currently configured in RepairPro; their approval dates and external provenance are not recorded. Review before using them commercially.",
  "All amounts are USD. No tax, discount, customer-specific fleet agreement or quantity extension has been applied. Separate repair labor from materials. Sales tax applies to materials, passed-through freight-in and explicitly selected new fabrication; separately stated repair labor, customer delivery and shop-consumed supplies are not taxed to the customer. Use tax on shop purchases is internal and separately estimated. Verify claim and jurisdiction applicability.",
  "A stored $0.00 is shown as zero, not as a missing value or an offer of free work. In carrier tables, read any MCE / MCA / CR / RR instruction instead of treating zero as an approved repair price. An absent cell says Not configured.",
  "Not specified means the saved field is blank. Confirm the unit before quoting. PDR damage-map prices are multiplied by dent quantity; interior damage-map prices by repair-spot quantity; insurance hail rates apply per selected panel and dent-count bucket.",
  "Upholstery diagram pricing: repair = base × 60%; reupholster = base × 100%; reupholster plus foam = base × 125%, rounded to cents, then multiplied by quantity. Alternate diagram views can represent the same physical component: do not charge twice.",
  "New furniture and open-bow boat upholstery panels have no automatic list prices. A service advisor must enter an explicit price. Marine interior spot repairs still use the selected material/damage matrix. General upholstery matrix prices and legacy diagram-panel prices are separate choices, not amounts to automatically add together.",
  `Carrier source snapshot: State Farm ${HAIL_SOURCE.revision}, checked ${HAIL_SOURCE.checked}. ${HAIL_SOURCE.url}. Confirm applicability to the claim and repair agreement; a published rate is not payment approval.`,
  "Legacy insurance rows are retained for historical reference but are unverified and are not used for new automatic carrier quotes. Missing rates and MCE require a documented manual amount. No cross-carrier averaging or lower-count fallback is used. State Farm numeric ranges extend through 250 dents only where published.",
  "State Farm permits maximum ONE listed 25% matrix upcharge per panel and separately lists oversized dents at $50 each. This source does not state a fixed glue-pull-only, stretched-dent or $100 double-oversized charge. Those items require explicit manual pricing and a line remark. Do not apply one insurer's rules to another.",
  "Carrier abbreviations as labeled in the CRM: MCE = Most Cost Effective; MCA = Most Cost Appropriate; CR = Conventional or Replace; RR = Repair or Replace. Preserve the carrier instruction and verify the current claim requirements.",
  "Service-template base prices are shortcuts, not additional charges on top of a matrix line. Customer-specific contract discounts are intentionally excluded from this general shop catalog.",
];

export function buildPricingCatalog(matrices:any[],templates:any[],date=new Date()){
  const tables:Table[]=[];
  tables.push({heading:"Service coverage",columns:["Service","Pricing sections to use"],rows:SERVICES.map(s=>[s.label,serviceSections[s.value]]),ids:[]});
  for(const type of [...Object.keys(titles),...Array.from(new Set(matrices.map(m=>m.matrixType).filter(t=>!titles[t]&&t!=="hail_insurance")))]){
    const rows=matrices.filter(m=>m.matrixType===type).sort((a,b)=>a.id-b.id);
    const dimensions:[string,string][]=[["panel","Panel / item"],["vehicleCategory","Vehicle"],["sizeCategory","Size"],["dentCountRange","Dent count"],["filmType","Film"],["damageType","Damage"],["severity","Severity"],["insuranceCompany","Insurer"]];
    const used=dimensions.filter(([k])=>rows.some(r=>r[k]));
    tables.push({heading:titles[type]||label(type),description:`${rows.length} saved matrix entries.`,columns:["ID / matrix",...used.map(([,v])=>v),"Rate","Unit","Notes"],
      rows:rows.map(r=>[`${r.id} · ${r.name}`,...used.map(([k])=>label(r[k])),money(r.price),label(r.unitType),r.notes||""]),ids:rows.map(r=>r.id)});
  }
  tables.push({heading:"Service-template base prices",description:"Separate estimating shortcuts; do not add to a matrix price for the same work.",columns:["ID / template","Service","Description","Base rate","Unit","Status"],rows:templates.map(t=>[`${t.id} · ${t.name}`,SERVICES.find(s=>s.value===t.serviceType)?.label||label(t.serviceType),t.description||"",money(t.basePrice),label(t.unitType),t.isActive?"Active":"Inactive"]),ids:[]});
  for(const [heading,filter] of [
    ["Furniture / booth diagram-panel rates",(id:string)=>!/^m[t]?-|^r[t]?-/.test(id)],
    ["RV diagram-panel rates",(id:string)=>/^r[t]?-/.test(id)],
    ["Marine diagram-panel rates",(id:string)=>/^m[t]?-/.test(id)],
  ] as const){
    tables.push({heading,description:"Legacy diagram IDs are preserved to distinguish similarly named panels. Base rates are per selected panel; top / mt / rt are alternate diagram views.",columns:["Panel / diagram ID","Repair 60%","Reupholster 100%","Plus foam 125%"],rows:Object.entries(FURNITURE_PANEL_PRICES).filter(([id])=>filter(id)).map(([id,p])=>[id,money(Math.round(p*60)/100),money(p),money(Math.round(p*125)/100)]),ids:[]});
  }
  tables.push({heading:"Furniture and boat variations requiring a quote",description:"No automatic upholstery prices are configured for the modern variation panels. Legacy options remain listed in the diagram-rate sections for historical reference.",columns:["Item","Variation","Pricing"],rows:Object.entries(FURNITURE_STYLES).flatMap(([type,styles])=>Object.entries(styles).filter(([key])=>key!=="classic").map(([,name])=>[FURNITURE_NAMES[type]||type,name,"Quote required for each selected panel"])),ids:[]});
  tables.push({heading:"Carrier-published State Farm adjustments and exceptions",description:`Revision ${HAIL_SOURCE.revision}; checked ${HAIL_SOURCE.checked}. Document: ${HAIL_SOURCE.url}. Agreement scope: ${HAIL_SOURCE.scopeUrl}. Internal reference; verify authorized use and claim applicability.`,columns:["Rule","Instruction"],rows:HAIL_RULES,ids:[]});
  for(const panel of Array.from(new Set(HAIL_REFERENCE_ROWS.map(r=>r.panel)))){
    tables.push({heading:`Carrier-published State Farm: ${panel}`,description:`Source revision ${HAIL_SOURCE.revision}: ${HAIL_SOURCE.url}. MCE is a review decision, not zero. Not published means no value exists in this source for that combination.`,columns:["Regular dent count",...HAIL_SIZES.map(label)],rows:HAIL_RANGES.map(([min,max])=>[`${min}-${max}`,...HAIL_SIZES.map(size=>{const row=HAIL_REFERENCE_ROWS.find(r=>r.panel===panel&&r.min===min&&r.sizeCategory===size);return row?typeof row.price==="number"?money(row.price):row.price:"Not published";})]),ids:[]});
  }
  for(const carrier of Array.from(new Set(matrices.filter(m=>m.matrixType==="hail_insurance").map(m=>m.insuranceCompany||"Unspecified insurer"))).sort()){
    const entries=matrices.filter(m=>m.matrixType==="hail_insurance"&&(m.insuranceCompany||"Unspecified insurer")===carrier);
    const preferred=["dime","nickel","quarter","half_dollar","softball"];
    const sizes=Array.from(new Set(entries.map(r=>r.sizeCategory||"Not specified"))).sort((a,b)=>(preferred.includes(a)?preferred.indexOf(a):99)-(preferred.includes(b)?preferred.indexOf(b):99)||a.localeCompare(b));
    const groups=new Map<string,any[]>();
    for(const e of entries){
      const key=JSON.stringify([e.name,e.panel,e.dentCountRange,e.vehicleCategory,e.filmType,e.damageType,e.severity,e.unitType,e.notes]);
      groups.set(key,[...(groups.get(key)||[]),e]);
    }
    const rows=Array.from(groups.values()).sort((a,b)=>String(a[0].panel).localeCompare(String(b[0].panel))||parseInt(a[0].dentCountRange)-parseInt(b[0].dentCountRange)).map(g=>{
      const e=g[0],extra=[e.vehicleCategory,e.filmType,e.damageType,e.severity].filter(Boolean).join(" / ");
      return [[e.name,extra].filter(Boolean).join(" / "),label(e.panel),label(e.dentCountRange),...sizes.map(size=>{
        const matching=g.filter(e=>(e.sizeCategory||"Not specified")===size);
        return matching.length?matching.map(e=>`${money(e.price)} [${e.id}]`).join("; "):"Not configured";
      }),label(e.unitType),e.notes||""];
    });
    tables.push({heading:`Legacy insurance hail: ${carrier} (UNVERIFIED)`,description:`${entries.length} historical stored entries, NOT used for new automatic carrier quoting. Bracketed numbers are CRM row IDs. Carrier authorization and revision are not verified; use only as historical context. Zero with a carrier code is not free repair.`,columns:["Matrix","Panel","Dent count",...sizes.map(label),"Unit","Instruction"],rows,ids:entries.map(e=>e.id)});
  }
  return {title:"McDowells Specialty Repair | Complete Pricing Catalog",generated:date.toLocaleString("en-US",{timeZone:"America/Denver",dateStyle:"long",timeStyle:"short"})+" Mountain Time",matrixCount:matrices.length,templateCount:templates.length,panelCount:Object.keys(FURNITURE_PANEL_PRICES).length,tables,notes:catalogNotes};
}
export type PricingCatalog=ReturnType<typeof buildPricingCatalog>;
export function pricingMarkdown(c:PricingCatalog){
  const cell=(s:string)=>s.replace(/\|/g,"\\|").replace(/\r?\n/g," ");
  return `# ${c.title}\n\nSnapshot: ${c.generated}. Includes ${c.matrixCount} saved matrix entries, ${c.templateCount} service templates and ${c.panelCount} diagram-panel base rates.\n\n## How to use this catalog\n\n${c.notes.map(n=>`- ${n}`).join("\n")}\n\n`+
    c.tables.map(t=>`## ${t.heading}\n\n${t.description||""}\n\n| ${t.columns.map(cell).join(" | ")} |\n| ${t.columns.map(()=>"---").join(" | ")} |\n${t.rows.map(r=>`| ${r.map(cell).join(" | ")} |`).join("\n")}\n`).join("\n");
}
export function pricingHtml(c:PricingCatalog){
  const e=(s:any)=>printable(String(s??""));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.title)}</title>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<style>:root{color-scheme:light}*{box-sizing:border-box}body{font-family:Satoshi,Arial,sans-serif;color:#1f2937;background:#eee;margin:0;font-size:14px;line-height:1.4}main{max-width:1160px;background:white;margin:24px auto;padding:36px}h1{font-size:26px;margin:0 0 12px}h2{font-size:20px;margin:26px 0 8px}p{margin:8px 0 12px}li{margin:8px 0}.meta{color:#555}.toolbar{position:sticky;top:0;background:#173d40;color:white;padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.toolbar button{background:white;border:0;border-radius:4px;padding:10px 18px;font:inherit;cursor:pointer}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:12px}th,td{text-align:left;vertical-align:top;border:1px solid #cbd0d2;padding:6px;overflow-wrap:anywhere}th{background:#edf2f2;font-weight:700}tr:nth-child(even){background:#fafafa}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}a{color:#165e64}.summary{padding:12px;border:1px solid #a3babb;background:#f4f8f8}.toc{columns:2}section{break-before:page}@media(max-width:600px){main{margin:0;padding:16px}.toc{columns:1}h1{font-size:23px}}@page{size:letter landscape;margin:0.45in}@media print{body{background:white;font-size:10pt}main{margin:0;padding:0;max-width:none}.toolbar,.toc{display:none}h1{font-size:20pt}h2{font-size:15pt}table{font-size:9pt}th,td{padding:4px}.table-wrap{overflow:visible}.meta{color:#444}a{text-decoration:none;color:inherit}}</style></head><body>
<div class="toolbar"><button onclick="window.print()">Print complete catalog</button><span>Landscape letter • all services • internal working rates</span></div><main>
<h1>McDowells Specialty Repair</h1><h2>Complete Pricing Catalog</h2><p class="meta">Snapshot: ${e(c.generated)}</p><p class="summary">${c.matrixCount} saved matrix entries (includes unverified legacy carrier tables) · ${HAIL_REFERENCE_ROWS.length} carrier-source State Farm cells · ${c.templateCount} service templates · ${c.panelCount} diagram-panel base rates. This complete reference prints over multiple pages so the prices remain readable.</p>
<h2>How to use this catalog</h2><ul>${c.notes.map(n=>`<li>${e(n)}</li>`).join("")}</ul>
<nav class="toc" aria-label="Catalog sections">${c.tables.map((t,i)=>`<p><a href="#section-${i}">${e(t.heading)}</a></p>`).join("")}</nav>
${c.tables.map((t,i)=>`<section id="section-${i}" data-matrix-ids="${t.ids.join(",")}"><h2>${e(t.heading)}</h2>${t.description?`<p>${e(t.description)}</p>`:""}<div class="table-wrap"><table><thead><tr>${t.columns.map(h=>`<th scope="col">${e(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(v=>`<td>${e(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`).join("")}
<p class="meta">End of catalog. Refresh the authorized catalog from RepairPro to print current saved rates.</p></main></body></html>`;
}
export function registerPricingCatalog(app:Express){
  app.get("/print/pricing-matrices",(_req,res)=>{
    res.set("Cache-Control","no-store").type("html").send(pricingHtml(buildPricingCatalog(storage.getPricingMatrices(),storage.getServiceTemplates())));
  });
}
