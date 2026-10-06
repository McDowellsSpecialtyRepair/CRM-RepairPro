import {documentBreakdown} from "../shared/estimate-rules";
export function breakdownHtml(lines:any[],subtotal:number){
  const b=documentBreakdown(lines,subtotal);
  const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100);
  return b.rows.map(r=>`<tr><td style="padding:6px 12px">${r.label}</td><td class="text-right" style="padding:6px 12px;text-align:right;white-space:nowrap">${money(r.cents)}</td></tr>`).join("")
    +(b.needsReview?`<tr><td colspan="2" style="font-size:12px;padding:8px 12px">${b.note}</td></tr>`:"");
}
// Escape every stored string before it is interpolated into a print template.
export function printable<T>(value: T): T {
  if (typeof value === "string") return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!) as T;
  if (Array.isArray(value)) return value.map(printable) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, printable(v)])) as T;
  return value;
}
