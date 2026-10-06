import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { runReport, validateReport, previousPeriod, type ReportConfig } from "../shared/reporting";

export function migrateReporting() {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS report_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    config TEXT NOT NULL CHECK(json_valid(config)), created_at TEXT NOT NULL
  )`);
}

export function registerReporting(app: Express) {
  const readData = () => ({
    customers: storage.getCustomers(), jobs: storage.getJobs(), estimates: storage.getEstimates(),
    invoices: storage.getInvoices(), payments: storage.getPayments(), campaigns: storage.getCampaigns(),
  });
  app.post("/api/reports/run", (req, res) => {
    try {
      validateReport(req.body);
      const result = sqlite.transaction(() => {
        const data = readData();
        const current = runReport(req.body, data);
        const prior = req.body.compare ? previousPeriod(req.body) : null;
        return { ...current, comparison: prior ? { start: prior.start, end: prior.end, totals: runReport(prior, data).totals } : null };
      })();
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/reports/definitions", (_req, res) => res.json(sqlite.prepare("SELECT * FROM report_definitions ORDER BY id DESC").all().map((r: any) => ({ ...r, config: JSON.parse(r.config) }))));
  app.post("/api/reports/definitions", (req, res) => {
    try {
      validateReport(req.body.config as ReportConfig);
      const name = String(req.body.name || "").trim();
      if (!name || name.length > 80) throw new Error("Report name must be 1–80 characters.");
      if ((sqlite.prepare("SELECT COUNT(*) AS n FROM report_definitions").get() as any).n >= 200) throw new Error("The preview supports up to 200 saved layouts.");
      const row = sqlite.prepare("INSERT INTO report_definitions(name,config,created_at) VALUES(?,?,?)").run(name, JSON.stringify(req.body.config), new Date().toISOString());
      res.status(201).json({ id: row.lastInsertRowid, name, config: req.body.config });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
}
