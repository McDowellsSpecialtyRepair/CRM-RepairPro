export const CATEGORY_DEFS = [
  {value:"pdr_dent",label:"PDR dent repair",defaultUnit:"each"},
  {value:"pdr_hail",label:"Hail repair",defaultUnit:"panel"},
  {value:"interior_vinyl",label:"Vinyl / leather / plastic repair",defaultUnit:"each"},
  {value:"interior_fabric",label:"Fabric repair",defaultUnit:"each"},
  {value:"upholstery",label:"Upholstery repair / replacement",defaultUnit:"each"},
  {value:"window_tint",label:"Window tint installation",defaultUnit:"each"},
  {value:"labor",label:"Repair labor",defaultUnit:"hour"},
  {value:"fabrication",label:"New fabrication labor (taxable)",defaultUnit:"hour"},
  {value:"material",label:"Parts / materials sold to customer",defaultUnit:"each"},
  {value:"supplies",label:"Shop-consumed supplies",defaultUnit:"each"},
  {value:"freight_in",label:"Freight-in passed through to customer",defaultUnit:"each"},
  {value:"freight_out",label:"Separately stated delivery to customer",defaultUnit:"each"},
  {value:"other",label:"Other repair labor for this service",defaultUnit:"each"},
];
export const SERVICE_CATEGORIES:Record<string,string[]>={
  pdr:["pdr_dent"],hail:["pdr_hail"],window_tint:["window_tint"],
  interior_repair:["interior_vinyl","interior_fabric"],
  rv_interior:["interior_vinyl","interior_fabric"],
  marine_interior:["interior_vinyl","interior_fabric"],
  rv_upholstery:["upholstery","interior_fabric"],
  marine_upholstery:["upholstery","interior_fabric"],
  upholstery:["upholstery","interior_fabric","interior_vinyl"],
};
export const categoriesFor=(service:string)=>CATEGORY_DEFS.filter(c=>
  !!SERVICE_CATEGORIES[service] && [...SERVICE_CATEGORIES[service],"labor","material","supplies","freight_in","freight_out","other",
    ...(["upholstery","rv_upholstery","marine_upholstery"].includes(service)?["fabrication"]:[])].includes(c.value));
export const categoryAllowed=(service:string,category:string)=>categoriesFor(service).some(c=>c.value===category);
export const nonLaborCategory=(category:string)=>["material","supplies","freight_in","freight_out"].includes(category);
export const categoryTaxable=(category:string,lineType:string)=>category==="fabrication"||category==="freight_in"||lineType==="parts"&&!["supplies","freight_out"].includes(category);
export const templateAllowed=(service:string,t:any)=>t.isActive!==0&&t.isActive!==false&&t.serviceType===service;
export const repairActionsFor=(service:string)=>["repair","remove_install","replace",...(["upholstery","rv_upholstery","marine_upholstery"].includes(service)?["reupholster","foam_replacement","fabricate"]:[])];
export const TAX_GUIDE="https://tax.idaho.gov/taxes/sales-use/guides-for-certain-groups/repair-shops/";
export const customerLineLabel=(line:any)=>line.lineType==="legacy"?"Needs classification":
  `${CATEGORY_DEFS.find(c=>c.value===line.serviceCategory)?.label||line.lineType}${line.repairAction&&line.lineType==="labor"?` · ${line.repairAction.replaceAll("_"," ")}`:""}`;
export function purchaseTotals(line:any){
  const costCents=Math.round(Number(line.quantity||0)*Number(line.unitCost||0)*100);
  return {costCents,useTaxCents:Math.round(costCents*Number(line.useTaxRate||0)/100)};
}
// Display reconciliation only. Never infer classification or recalculate an issued document.
export function documentBreakdown(lines:{lineType?:string|null;total:number}[],subtotal:number){
  const groups=[
    {key:"parts",label:"Materials / freight / supplies before discount",cents:0,count:0},
    {key:"labor",label:"Labor before discount",cents:0,count:0},
    {key:"unclassified",label:"Unclassified charges before discount",cents:0,count:0},
  ];
  for(const line of lines){
    const group=groups.find(g=>g.key===line.lineType)||groups[2];
    group.cents+=Math.round(line.total*100);group.count++;
  }
  const difference=Math.round(subtotal*100)-groups.reduce((s,g)=>s+g.cents,0);
  const needsReview=groups[2].count>0||difference!==0;
  const rows=groups.filter(g=>g.count>0||!needsReview&&g.key!=="unclassified");
  if(difference)rows.push({key:"unreconciled",label:"Stored subtotal difference (review required)",cents:difference,count:0});
  return {rows,needsReview,note:needsReview
    ?"This saved document has unclassified charges or a subtotal difference. Its recorded tax has not been revalidated. Original amounts are preserved; review the breakdown and tax before relying on them."
    :"",taxLabel:needsReview?"Recorded tax (not revalidated)":"Sales tax after discount"};
}
