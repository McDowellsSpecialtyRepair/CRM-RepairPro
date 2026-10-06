import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Download, Play, Save, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { REPORT_SOURCES, GROUP_LABELS, defaultReport, csvCell, type ReportConfig, type ReportSource } from "@shared/reporting";

const selectClass = "w-full h-11 rounded-md border border-input bg-background px-3 text-sm";
const fmt = (value: number | null | undefined, format: string) => value == null ? "N/A" : format === "money" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value) : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${format === "percent" ? "%" : ""}`;
const presets = [
  { name: "Customer sales", source: "invoices", group: "customer", metrics: ["count", "sales", "tax", "gross"] },
  { name: "Outstanding balances", source: "invoices", group: "aging", metrics: ["count", "gross", "collected", "balance"] },
  { name: "Daily collections", source: "payments", group: "date", metrics: ["count", "collected", "average"] },
  { name: "Estimate conversion", source: "estimates", group: "service", metrics: ["count", "quoted", "approved", "conversion"] },
  { name: "Technician workload", source: "jobs", group: "tech", metrics: ["count", "completed", "completion"] },
  { name: "Marketing results", source: "campaigns", group: "campaign", metrics: ["budget", "sent", "responses", "converted", "conversion"] },
] as const;
export default function Reports() {
  const [config, setConfig] = useState<ReportConfig>(defaultReport());
  const [applied, setApplied] = useState<ReportConfig>(defaultReport());
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: "label", desc: false });
  const [chartMetric, setChartMetric] = useState("");
  const runSequence = useRef(0);
  const saved = useQuery<any[]>({ queryKey: ["/api/reports/definitions"] });
  const customers = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const jobs = useQuery<any[]>({ queryKey: ["/api/jobs"] });
  const estimates = useQuery<any[]>({ queryKey: ["/api/estimates"] });
  const def = REPORT_SOURCES[config.source], active = REPORT_SOURCES[applied.source];
  const dirty = JSON.stringify(config) !== JSON.stringify(applied);
  const patch = (p: Partial<ReportConfig>) => { setConfig(c => ({ ...c, ...p })); setNotice(""); };
  async function run(c = config) {
    const sequence = ++runSequence.current;
    setBusy(true); setError(""); setNotice("");
    try { const data = await apiRequest("POST", "/api/reports/run", c); if (sequence !== runSequence.current) return; setResult(data); setApplied(c); setDetail(null); setPage(0); setSort({ key: "label", desc: false }); }
    catch (e: any) { if (sequence === runSequence.current) setError(e.message); }
    finally { if (sequence === runSequence.current) setBusy(false); }
  }
  useEffect(() => { void run(defaultReport()); }, []);
  const metrics = [...applied.metrics, ...(applied.formula ? ["calculated"] : [])];
  const metricLabel = (k: string) => k === "calculated" ? applied.formula!.name : active.metrics[k]?.label || k;
  const metricFormat = (k: string) => k !== "calculated" ? active.metrics[k]?.format : applied.formula?.op === "%" ? "percent" : ["+", "-"].includes(applied.formula?.op || "") ? active.metrics[applied.formula!.left]?.format : "number";
  const rows = [...(result?.rows || [])].sort((a, b) => {
    const av = sort.key === "label" ? a.label : a.values[sort.key], bv = sort.key === "label" ? b.label : b.values[sort.key];
    return (typeof av === "string" ? av.localeCompare(bv) : (av ?? -Infinity) - (bv ?? -Infinity)) * (sort.desc ? -1 : 1);
  });
  const details = (result?.records || []).filter((r: any) => detail === "*" || r.group === detail);
  const shown = detail ? details : rows;
  const pages = Math.max(1, Math.ceil(shown.length / 25));
  const chartKey = metrics.includes(chartMetric) ? chartMetric : metrics.find(k => metricFormat(k) === "money") || metrics[0];
  const chartRows = [...rows].filter(r => r.values[chartKey] != null).sort((a, b) => b.values[chartKey] - a.values[chartKey]).slice(0, 10);
  const chartMax = Math.max(1, ...chartRows.map(r => Math.abs(r.values[chartKey])));
  async function save() {
    setError(""); setNotice("");
    try { await apiRequest("POST", "/api/reports/definitions", { name, config }); await saved.refetch(); setNotice("Layout saved to the preview database. It is shared with preview users."); setName(""); }
    catch (e: any) { setError(e.message); }
  }
  async function exportCsv() {
    if (!result) return;
    try { await apiRequest("POST","/api/reports/export-log",{source:applied.source,count:result.records.length}); }
    catch(e:any) { setError(e.message); return; }
    const lines: unknown[][] = [
      ["RepairPro report", active.name], ["Generated", result.generatedAt], ["Date basis", active.date],
      ["Period", applied.start || "All history", applied.end || "Present"], ["Definitions", active.note],
      ["Filters", JSON.stringify({ customer: applied.customer, service: applied.service, tech: applied.tech, status: applied.status, search: applied.search })],
      ...(applied.formula ? [["Calculation", `${applied.formula.name}: ${applied.formula.left} ${applied.formula.op} ${applied.formula.right}`]] : []),
      [], [GROUP_LABELS[applied.group], ...metrics.map(metricLabel)],
      ...rows.map(r => [r.label, ...metrics.map(k => r.values[k] ?? "N/A")]),
      ["TOTAL", ...metrics.map(k => result.totals[k] ?? "N/A")],
      ...(result.comparison ? [["PREVIOUS PERIOD", result.comparison.start, result.comparison.end], ["PREVIOUS TOTAL", ...metrics.map(k => result.comparison.totals[k] ?? "N/A")]] : []),
      [], ["Source records"], ["Reference", "Date", "Customer", "Service", "Technician", "Status", "Group"],
      ...result.records.map((r: any) => [r.reference, r.date, r.customer, r.service, r.tech, r.status, r.group]),
    ];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map(l => l.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `RepairPro-${applied.source}-${result.agingAsOf}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const services = Array.from(new Set([...(jobs.data || []), ...(estimates.data || [])].map(j => j.serviceType))).sort();
  const techs = Array.from(new Set((jobs.data || []).map(j => j.assignedTech).filter(Boolean))).sort();
  const statuses: Record<ReportSource, string[]> = { invoices: ["sent", "partial", "paid", "overdue"], payments: [], estimates: ["draft", "sent", "approved", "invoiced", "rejected", "expired"], jobs: ["pending", "scheduled", "in_progress", "completed", "cancelled"], customers: ["active", "inactive"], campaigns: ["draft", "active", "completed", "paused"] };
  return <div className="space-y-5 min-w-0" data-testid="report-builder">
    <div className="flex flex-wrap justify-between gap-3 items-start">
      <div><h1 className="text-2xl font-bold">Report studio</h1><p className="text-sm text-muted-foreground mt-1">Choose a question. Refine the data. See how the answer was calculated.</p></div>
      <Button variant="outline" onClick={() => run()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Refresh data</Button>
    </div>
    <div className="flex flex-wrap gap-2">{presets.map(p => <Button key={p.name} variant="outline" size="sm" onClick={() => { const c = { ...defaultReport(p.source), group: p.group, metrics: [...p.metrics] }; setConfig(c); void run(c); }}>{p.name}</Button>)}</div>
    <Card><CardContent className="pt-5 space-y-5">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <label className="text-sm space-y-1">Data source<select aria-label="Data source" className={selectClass} value={config.source} onChange={e => setConfig(defaultReport(e.target.value as ReportSource))}>{Object.entries(REPORT_SOURCES).map(([key, d]) => <option key={key} value={key}>{d.name}</option>)}</select></label>
        <label className="text-sm space-y-1">Group by<select aria-label="Group by" className={selectClass} value={config.group} onChange={e => patch({ group: e.target.value })}>{["none", ...def.groups].map(g => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}</select></label>
        <label className="text-sm space-y-1">From (inclusive)<Input aria-label="From date" type="date" value={config.start} onChange={e => patch({ start: e.target.value })} className="h-11" /></label>
        <label className="text-sm space-y-1">Through (inclusive)<Input aria-label="Through date" type="date" value={config.end} onChange={e => patch({ end: e.target.value })} className="h-11" /></label>
      </div>
      <p className="text-xs text-muted-foreground">Date basis: {def.date}. Blank dates include all history. All reporting dates use Boise business time.</p>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Filters and calculations</summary>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {!["campaigns", "customers"].includes(config.source) && <label className="text-sm">Customer<select aria-label="Customer filter" className={selectClass} value={config.customer} onChange={e => patch({ customer: e.target.value })}><option value="">All customers</option>{(customers.data || []).map(c => <option value={c.id} key={c.id}>{c.companyName || `${c.firstName || ""} ${c.lastName || ""}`} ({c.customerNumber})</option>)}</select></label>}
          {!["campaigns", "customers"].includes(config.source) && <><label className="text-sm">Service<select aria-label="Service filter" className={selectClass} value={config.service} onChange={e => patch({ service: e.target.value })}><option value="">All services</option><option>Unassigned</option>{services.map(s => <option key={s}>{s}</option>)}</select></label><label className="text-sm">Technician<select aria-label="Technician filter" className={selectClass} value={config.tech} onChange={e => patch({ tech: e.target.value })}><option value="">All technicians</option><option>Unassigned</option>{techs.map(s => <option key={s}>{s}</option>)}</select></label></>}
          {!!statuses[config.source].length && <label className="text-sm">Status<select aria-label="Status filter" className={selectClass} value={config.status} onChange={e => patch({ status: e.target.value })}><option value="">All eligible statuses</option>{statuses[config.source].map(s => <option key={s}>{s}</option>)}</select></label>}
          <label className="text-sm">Search records<Input aria-label="Search records" value={config.search} onChange={e => patch({ search: e.target.value })} placeholder="Customer, document, service…" /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">{Object.entries(def.metrics).map(([key, m]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.metrics.includes(key)} onChange={e => patch({ metrics: e.target.checked ? [...config.metrics, key] : config.metrics.filter(k => k !== key) })} />{m.label}</label>)}</div>
        <div className="mt-5 space-y-3">
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={config.compare} onChange={e => patch({ compare: e.target.checked })} />Compare totals with the preceding equal-length period</label>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={!!config.formula} onChange={e => patch({ formula: e.target.checked ? { name: "My calculation", left: Object.keys(def.metrics)[0], right: Object.keys(def.metrics)[0], op: "/" } : undefined })} />Add a calculated measure</label>
          {config.formula && <><div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input aria-label="Calculation name" maxLength={60} value={config.formula.name} onChange={e => patch({ formula: { ...config.formula!, name: e.target.value } })} />
            <select aria-label="Calculation first measure" className={selectClass} value={config.formula.left} onChange={e => patch({ formula: { ...config.formula!, left: e.target.value } })}>{Object.entries(def.metrics).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
            <select aria-label="Calculation operator" className={selectClass} value={config.formula.op} onChange={e => patch({ formula: { ...config.formula!, op: e.target.value as any } })}><option value="+">Add (+)</option><option value="-">Subtract (−)</option><option value="*">Multiply (×)</option><option value="/">Divide (÷)</option><option value="%">Ratio (%)</option></select>
            <select aria-label="Calculation second measure" className={selectClass} value={config.formula.right} onChange={e => patch({ formula: { ...config.formula!, right: e.target.value } })}>{Object.entries(def.metrics).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
          </div><p className="text-xs text-muted-foreground">Calculated from aggregate measures for each group and the grand total, not by averaging group ratios. Division by zero displays N/A. Multiplication/division use raw numeric units; name the result accordingly. No arbitrary code or SQL is executed.</p></>}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => run()} disabled={busy}><Play className="h-4 w-4 mr-2" />{busy ? "Running…" : "Run report"}</Button><Button variant="ghost" onClick={() => setConfig(defaultReport(config.source))}>Reset options</Button>{dirty && <span className="text-sm text-muted-foreground">Options changed. Run to update results.</span>}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
    <Card><CardContent className="pt-4"><div className="grid gap-3 sm:grid-cols-3 items-end">
      <label className="text-sm">Saved layouts<select aria-label="Saved layouts" className={selectClass} value="" onChange={e => { const r = saved.data?.find(r => String(r.id) === e.target.value); if (r) { setConfig(r.config); void run(r.config); } }}><option value="">Choose a saved layout</option>{(saved.data || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="text-sm">Save these options as<Input aria-label="Report name" placeholder="e.g. Dealer sales by month" maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <Button variant="outline" onClick={save} disabled={!name.trim()}><Save className="h-4 w-4 mr-2" />Save layout</Button>
    </div><p className="text-xs text-muted-foreground mt-2">{notice || "Layouts are shared among authorized reporting staff. They save filters and calculations, not frozen financial results."}</p>{saved.isError && <p className="text-destructive text-sm">Saved layouts could not be loaded.</p>}</CardContent></Card>
    {result && <section aria-live="polite" className="space-y-4">
      <div className="flex justify-between flex-wrap gap-3"><div><h2 className="text-lg font-semibold flex gap-2 items-center"><BarChart3 className="h-5 w-5" />{active.name}</h2><p className="text-xs text-muted-foreground">{result.count} source records · {applied.start || "All history"} to {applied.end || "present"} · Generated {new Date(result.generatedAt).toLocaleString()}</p></div><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>
      <p className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">{active.note}{applied.group === "aging" && ` Aging as of ${result.agingAsOf}; not historical aging.`}</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{metrics.map(k => <Card key={k}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{metricLabel(k)}</p><p className="text-2xl font-semibold tabular-nums mt-2">{fmt(result.totals[k], metricFormat(k) || "number")}</p>{result.comparison && <p className="text-xs text-muted-foreground mt-2">Prior: {fmt(result.comparison.totals[k], metricFormat(k) || "number")} · Change: {result.totals[k] == null || result.comparison.totals[k] == null ? "N/A" : fmt(result.totals[k] - result.comparison.totals[k], metricFormat(k) || "number")}{metricFormat(k) === "percent" ? " points (not % growth)" : ""}</p>}</CardContent></Card>)}</div>
      {result.comparison && <p className="text-xs text-muted-foreground">Previous period: {result.comparison.start} through {result.comparison.end}. Rates are recalculated from the whole cohort.</p>}
      {rows.length > 1 && <Card><CardContent className="pt-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Group comparison</h3><p className="text-xs text-muted-foreground">Highest 10 values. The table and export include all groups. Tap a bar for source records.</p></div><select aria-label="Chart measure" className={`${selectClass} sm:max-w-64`} value={chartKey} onChange={e => setChartMetric(e.target.value)}>{metrics.map(k => <option key={k} value={k}>{metricLabel(k)}</option>)}</select></div>
        {chartRows.map(r => <button key={r.label} className="block w-full text-left rounded-md focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { setDetail(r.label); setPage(0); }} aria-label={`View ${r.label}: ${fmt(r.values[chartKey], metricFormat(chartKey) || "number")}`}><span className="flex justify-between gap-3 text-xs"><span className="break-words">{r.label}</span><span className="shrink-0 tabular-nums">{fmt(r.values[chartKey], metricFormat(chartKey) || "number")}</span></span><span className="block h-2 bg-muted rounded mt-1 mb-3"><span className={`block h-2 rounded ${r.values[chartKey] < 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.abs(r.values[chartKey]) / chartMax * 100}%` }} /></span></button>)}
      </CardContent></Card>}
      <div className="flex flex-wrap gap-2">{detail && <Button variant="outline" onClick={() => { setDetail(null); setPage(0); }}>Back to grouped report</Button>}<Button variant="ghost" onClick={() => { setDetail("*"); setPage(0); }}>View all source records</Button>{detail && <span className="text-sm self-center">{detail === "*" ? "All source records" : detail}</span>}</div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-muted/50"><tr>{detail ? ["Reference", "Date", "Customer", "Service", "Technician", "Status"].map(k => <th key={k} className="text-left p-3 whitespace-nowrap">{k}</th>) : ["label", ...metrics].map(k => <th className={`p-3 whitespace-nowrap ${k === "label" ? "text-left" : "text-right"}`} key={k}><button onClick={() => setSort({ key: k, desc: sort.key === k ? !sort.desc : true })}>{k === "label" ? GROUP_LABELS[applied.group] : metricLabel(k)}{sort.key === k ? sort.desc ? " ↓" : " ↑" : ""}</button></th>)}</tr></thead>
          <tbody>{shown.slice(page * 25, page * 25 + 25).map((r: any) => <tr key={detail ? r.id : r.label} className="border-t hover:bg-muted/20">{detail ? [r.reference, r.date || "No date", r.customer, r.service, r.tech, r.status || "N/A"].map((v, i) => <td key={i} className="p-3 whitespace-nowrap">{v}</td>) : <><td className="p-3"><button className="text-primary underline underline-offset-4 text-left" onClick={() => { setDetail(r.label); setPage(0); }}>{r.label}</button></td>{metrics.map(k => <td key={k} className="p-3 text-right tabular-nums whitespace-nowrap">{fmt(r.values[k], metricFormat(k) || "number")}</td>)}</>}</tr>)}</tbody>
          {!detail && !!rows.length && <tfoot className="border-t font-semibold bg-muted/40"><tr><td className="p-3">Grand total</td>{metrics.map(k => <td key={k} className="p-3 text-right whitespace-nowrap">{fmt(result.totals[k], metricFormat(k) || "number")}</td>)}</tr></tfoot>}
        </table>{shown.length === 0 && <p className="text-sm text-muted-foreground p-8 text-center">No matching records. Broaden the date range or clear filters.</p>}
      </div>
      <div className="flex items-center justify-end gap-3"><Button aria-label="Previous page" size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft /></Button><span className="text-xs">Page {page + 1} of {pages}</span><Button aria-label="Next page" size="icon" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight /></Button></div>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Data limitations and exclusions</summary><ul className="list-disc pl-5 space-y-1 mt-2">{result.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></details>
    </section>}
    <div className="rounded-md border p-4 text-sm"><h2 className="font-semibold">Payroll and profitability: not yet available</h2><p className="text-muted-foreground mt-1">The database does not yet contain approved timecards, pay rates, commission rules, payroll deductions, material costs or actual campaign spend. This builder will not invent payroll, margin, profit or marketing ROI. These need their own source records and authorization controls.</p></div>
  </div>;
}
