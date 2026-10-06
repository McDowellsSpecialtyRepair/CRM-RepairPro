import type {Express} from "express";
import {sqlite} from "./storage-db";
import {storage} from "./storage";
import {audit} from "./security";
import {editableEstimate,fail} from "./billing";
import {apportion} from "./labor";
import {purchaseTotals} from "../shared/estimate-rules";
export function migrateEstimateSales(){
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS estimate_sales_versions(estimate_id INTEGER PRIMARY KEY REFERENCES estimates(id),version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS estimate_sales_team(estimate_id INTEGER NOT NULL REFERENCES estimates(id),staff_id INTEGER NOT NULL REFERENCES staff_accounts(id),share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),PRIMARY KEY(estimate_id,staff_id));
    CREATE TABLE IF NOT EXISTS invoice_sales_credits(invoice_id INTEGER NOT NULL REFERENCES invoices(id),staff_id INTEGER NOT NULL REFERENCES staff_accounts(id),staff_name TEXT NOT NULL,share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),net_sales_cents INTEGER NOT NULL CHECK(net_sales_cents>=0),PRIMARY KEY(invoice_id,staff_id));
    CREATE TRIGGER IF NOT EXISTS invoice_sales_immutable_update BEFORE UPDATE ON invoice_sales_credits BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable');END;
    CREATE TRIGGER IF NOT EXISTS invoice_sales_immutable_delete BEFORE DELETE ON invoice_sales_credits BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable');END;
  `);
}
export function salesTeam(id:number){
  if(!storage.getEstimate(id))fail("Estimate not found",404);
  const version=(sqlite.prepare("SELECT version FROM estimate_sales_versions WHERE estimate_id=?").get(id) as any)?.version||1;
  return {version,rows:sqlite.prepare("SELECT t.staff_id,t.share_bps,s.full_name name FROM estimate_sales_team t JOIN staff_accounts s ON s.id=t.staff_id WHERE estimate_id=? ORDER BY staff_id").all(id)};
}
export function snapshotSales(estimateId:number,invoiceId:number,netCents:number){
  const team=salesTeam(estimateId).rows as any[];
  if(team.some(t=>!sqlite.prepare("SELECT id FROM staff_accounts WHERE id=? AND status='active' AND role IN ('owner','admin','manager','advisor')").get(t.staff_id)))fail("Choose active sales staff before invoicing",409);
  if(team.length&&team.reduce((sum,t)=>sum+t.share_bps,0)!==10000)fail("Salesperson shares must total 100%",409);
  const shares=apportion(netCents,team.map(t=>t.share_bps));
  team.forEach((t,i)=>sqlite.prepare("INSERT INTO invoice_sales_credits VALUES(?,?,?,?,?)").run(invoiceId,t.staff_id,t.name,t.share_bps,shares[i]));
  if(team.length)audit("invoice.sales_credits_created","invoices",invoiceId,null,{estimateId,team:team.map((t,i)=>({...t,netSalesCents:shares[i]}))});
}
export function registerEstimateSales(app:Express){
  app.get("/api/estimate-sales/staff",(_req,res)=>res.json(sqlite.prepare("SELECT id,full_name name FROM staff_accounts WHERE status='active' AND role IN ('owner','admin','manager','advisor') ORDER BY full_name").all()));
  app.get("/api/estimates/:id/sales-team",(req,res)=>res.json(salesTeam(Number(req.params.id))));
  app.put("/api/estimates/:id/sales-team",(req,res)=>{
    const id=Number(req.params.id);
    const result=sqlite.transaction(()=>{
      const est=editableEstimate(id),before=salesTeam(id),splits=req.body.splits;
      if(req.body.version!==before.version)fail("Sales team changed. Reload before saving.",409);
      if(!Array.isArray(splits)||splits.length>40)fail("Choose up to 40 salespeople");
      const ids=new Set();
      for(const s of splits){
        if(!s||!Number.isInteger(s.staffId)||ids.has(s.staffId)||!Number.isInteger(s.shareBps)||s.shareBps<=0||s.shareBps>10000||!sqlite.prepare("SELECT id FROM staff_accounts WHERE id=? AND status='active' AND role IN ('owner','admin','manager','advisor')").get(s.staffId))fail("Choose unique active salespeople and valid percentages");
        ids.add(s.staffId);
      }
      if(splits.length&&splits.reduce((n,s)=>n+s.shareBps,0)!==10000)fail("Salesperson shares must total exactly 100%");
      sqlite.prepare("DELETE FROM estimate_sales_team WHERE estimate_id=?").run(id);
      for(const s of splits)sqlite.prepare("INSERT INTO estimate_sales_team VALUES(?,?,?)").run(id,s.staffId,s.shareBps);
      sqlite.prepare("INSERT INTO estimate_sales_versions VALUES(?,?) ON CONFLICT(estimate_id) DO UPDATE SET version=excluded.version").run(id,before.version+1);
      if(est.status==="approved")storage.updateEstimate(id,{status:"draft",approvedDate:null});
      audit("estimate.sales_team_updated","estimates",id,before,salesTeam(id));
      return salesTeam(id);
    }).immediate();res.json(result);
  });
  app.get("/api/invoices/:id/commercial",(req,res)=>{
    if(!storage.getInvoice(Number(req.params.id)))fail("Invoice not found",404);
    res.json({
    sales:sqlite.prepare("SELECT * FROM invoice_sales_credits WHERE invoice_id=?").all(Number(req.params.id)),
    costs:storage.getInvoiceLineItems(Number(req.params.id)).map(l=>({description:l.description,category:l.serviceCategory,quantity:l.quantity,unitCost:l.unitCost,useTaxRate:l.useTaxRate,estimatedCost:purchaseTotals(l).costCents/100,useTax:purchaseTotals(l).useTaxCents/100})),
  });});
  app.get("/api/reports/commercial",(_req,res)=>res.json({
    basis:"Issued non-void invoices. Estimated purchase costs and use tax, not booked vendor bills or tax filings. Sales credit excludes customer sales tax and is not commission pay.",
    sales:sqlite.prepare("SELECT c.*,i.invoice_number,i.issue_date FROM invoice_sales_credits c JOIN invoices i ON i.id=c.invoice_id WHERE i.status NOT IN ('draft','void') ORDER BY i.id,c.staff_id").all(),
    costs:sqlite.prepare("SELECT i.id invoice_id,i.invoice_number,i.issue_date,l.description,l.service_category,l.quantity,l.unit_cost,ROUND(l.quantity*l.unit_cost*100)/100 estimated_cost,l.use_tax_rate,ROUND(ROUND(l.quantity*l.unit_cost*100)*l.use_tax_rate/100)/100 use_tax FROM invoice_line_items l JOIN invoices i ON i.id=l.invoice_id WHERE i.status NOT IN ('draft','void') AND (l.unit_cost>0 OR l.use_tax_rate>0) ORDER BY i.id,l.id").all(),
  }));
}
