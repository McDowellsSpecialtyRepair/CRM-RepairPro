import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "@/lib/queryClient";
import { authState } from "@/lib/auth-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CatalogTable = { heading: string; description: string; columns: string[]; rows: string[][] };
type CatalogPreview = { summary: string; generated: string; notes: string[]; tables: CatalogTable[] };

// Extract only text and table structure. Never execute or inject returned HTML
// into the app; customer-configured names and notes remain plain React text.
function parseCatalog(html: string): CatalogPreview {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const summary = doc.querySelector(".summary")?.textContent || "";
  const tables = Array.from(doc.querySelectorAll("main > section")).map(section => ({
    heading: section.querySelector("h2")?.textContent || "Pricing section",
    description: section.querySelector(":scope > p")?.textContent || "",
    columns: Array.from(section.querySelectorAll("thead th")).map(cell => cell.textContent || ""),
    rows: Array.from(section.querySelectorAll("tbody tr")).map(row =>
      Array.from(row.querySelectorAll("td")).map(cell => cell.textContent || "")),
  }));
  if (!summary || !tables.length || !tables.some(table => table.rows.length) ||
      tables.some(table => !table.columns.length || table.rows.some(row => row.length !== table.columns.length))) {
    throw new Error("The complete pricing tables could not be loaded. Retry or contact an owner.");
  }
  return {
    summary, tables,
    generated: doc.querySelector("main > .meta")?.textContent || "",
    notes: Array.from(doc.querySelectorAll("main > ul > li")).map(item => item.textContent || ""),
  };
}

function CatalogTables({ tables, prefix }: { tables: CatalogTable[]; prefix: string }) {
  return <div className="space-y-8">
    {tables.map((table, index) => <section key={index} id={`${prefix}-${index}`} className="catalog-section min-w-0 scroll-mt-4" data-testid="catalog-section">
      <h2 className="text-base font-semibold">{table.heading}</h2>
      {table.description && <p className="text-sm text-muted-foreground mt-1 break-words">{table.description}</p>}
      <div className="catalog-table-scroll overflow-x-auto border rounded-md mt-3" role="region" aria-label={`${table.heading} table`} tabIndex={0}>
        <table className="w-full text-xs border-collapse" style={table.columns.length > 4 ? { minWidth: `${table.columns.length * 100}px` } : undefined} data-testid="catalog-table">
          <thead><tr className="bg-muted">{table.columns.map((heading, col) =>
            <th key={col} scope="col" className="text-left align-top p-2 border-b font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{table.rows.length ? table.rows.map((row, rowIndex) =>
            <tr key={rowIndex} className="border-b last:border-0 even:bg-muted/30">{row.map((cell, col) =>
              <td key={col} className="p-2 align-top min-w-[5rem] break-words">{cell}</td>)}</tr>) :
            <tr><td colSpan={table.columns.length} className="p-3">No saved entries in this section.</td></tr>}</tbody>
        </table>
      </div>
    </section>)}
  </div>;
}

const printStyles = `
#pricing-catalog-print-root { display: none; }
@media print {
  @page { size: letter landscape; margin: 0.45in; }
  html, body { height: auto !important; overflow: visible !important; }
  body > :not(#pricing-catalog-print-root) { display: none !important; }
  #pricing-catalog-print-root { display: block !important; color: #111; background: white; font-size: 10pt; }
  #pricing-catalog-print-root * { color: #111 !important; box-shadow: none !important; }
  #pricing-catalog-print-root h1 { font-size: 20pt; font-weight: 700; margin-bottom: 8pt; }
  #pricing-catalog-print-root h2 { font-size: 14pt; margin: 12pt 0 6pt; break-after: avoid; }
  #pricing-catalog-print-root p, #pricing-catalog-print-root li { margin: 6pt 0; overflow-wrap: anywhere; }
  #pricing-catalog-print-root .catalog-section { break-before: page; margin: 0; }
  #pricing-catalog-print-root .catalog-table-scroll { overflow: visible; border: 0; }
  #pricing-catalog-print-root table { width: 100%; min-width: 0 !important; font-size: 9pt; border-collapse: collapse; table-layout: auto; }
  #pricing-catalog-print-root th, #pricing-catalog-print-root td { padding: 4pt; border: 1px solid #bbb; min-width: 0; overflow-wrap: anywhere; }
  #pricing-catalog-print-root th { background: #eee !important; }
  #pricing-catalog-print-root thead { display: table-header-group; }
  #pricing-catalog-print-root tr { break-inside: avoid; }
}`;

export function PricingPrintPreview() {
  const [open, setOpen] = useState(false), [html, setHtml] = useState("");
  const [catalog, setCatalog] = useState<CatalogPreview | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const request = useRef(0);
  async function load() {
    const id = ++request.current;
    setOpen(true); setBusy(true); setError(""); setHtml(""); setCatalog(null);
    try {
      const response = await fetch(`${API_BASE}/print/pricing-matrices`, { headers: { Authorization: `Bearer ${authState.get()?.token || ""}` } });
      if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again, then retry printing." : `Catalog request failed (${response.status}). Please retry.`);
      if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("The server did not return a printable catalog.");
      const text = await response.text(), parsed = parseCatalog(text);
      if (id !== request.current) return;
      setHtml(text); setCatalog(parsed);
    } catch (e: any) {
      if (id === request.current) setError(e.message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  function close(next: boolean) {
    setOpen(next);
    if (!next) { request.current++; setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" })), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "McDowells-Complete-Pricing-Catalog.html"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function print() {
    try { window.print(); }
    catch { setError("This browser blocked printing. Download the printable catalog, open the saved file, then choose Print complete catalog."); }
  }
  return <>
    <Button variant="outline" onClick={load} disabled={busy} data-testid="button-export-matrix">{busy ? "Preparing catalog…" : "Print all pricing"}</Button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-6xl w-[calc(100%-1rem)] max-h-[92dvh] overflow-y-auto block p-4 sm:p-6" data-testid="pricing-catalog-dialog">
        <DialogHeader className="pr-5"><DialogTitle>Complete pricing catalog</DialogTitle><DialogDescription>All pricing tables are displayed below, expanded and ready to review. Printing includes every section, not just what is on screen.</DialogDescription></DialogHeader>
        {busy && <p role="status" className="mt-4">Loading all pricing data…</p>}
        {error && <p role="alert" className="text-sm text-destructive mt-4">{error}</p>}
        {catalog && <div className="mt-4 space-y-4 min-w-0" data-testid="catalog-visible-content">
          <p data-testid="pricing-print-summary" className="text-xs">{catalog.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={print}>Print / Save PDF</Button>
            <Button variant="outline" onClick={download}>Download printable catalog</Button>
            <Button variant="ghost" onClick={load}>Refresh catalog</Button>
          </div>
          <p className="text-xs text-muted-foreground">{catalog.generated}. Internal working rates. On a narrow screen, swipe wide tables sideways to see every column.</p>
          <label className="block text-sm font-medium">Jump to a pricing section
            <select aria-label="Jump to a pricing section" className="mt-1 block w-full rounded-md border bg-background p-2 text-sm" defaultValue="" onChange={event => {
              const index = event.target.value;
              if (index !== "") document.getElementById(`catalog-screen-${index}`)?.scrollIntoView({ block: "start" });
              event.target.value = "";
            }}>
              <option value="">All {catalog.tables.length} tables shown below</option>
              {catalog.tables.map((table, index) => <option key={index} value={index}>{table.heading}</option>)}
            </select>
          </label>
          <details className="border rounded-md p-3"><summary className="text-sm font-medium cursor-pointer">Pricing notes and limitations (included when printing)</summary><ul className="list-disc pl-5 text-sm space-y-2 mt-3">{catalog.notes.map((note, index) => <li key={index} className="break-words">{note}</li>)}</ul></details>
          <p className="text-sm font-medium" role="status">{catalog.tables.length} tables loaded. Scroll to review all sections.</p>
          <CatalogTables tables={catalog.tables} prefix="catalog-screen" />
          <p className="text-xs text-muted-foreground" data-testid="catalog-end">End of catalog. All {catalog.tables.length} tables are displayed above.</p>
          <Button variant="outline" onClick={() => document.querySelector('[data-testid="pricing-catalog-dialog"]')?.scrollTo({ top: 0 })}>Back to catalog controls</Button>
        </div>}
        {!catalog && !busy && <Button className="mt-4" onClick={load}>Retry loading catalog</Button>}
      </DialogContent>
    </Dialog>
    {open && catalog && createPortal(<div id="pricing-catalog-print-root" aria-hidden="true">
      <style>{printStyles}</style>
      <h1>McDowells Specialty Repair</h1><h2>Complete Pricing Catalog</h2>
      <p>{catalog.generated}</p><p>{catalog.summary}</p>
      <h2>How to use this catalog</h2><ul>{catalog.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      <CatalogTables tables={catalog.tables} prefix="catalog-paper" />
      <p>End of catalog. All {catalog.tables.length} pricing tables included.</p>
    </div>, document.body)}
  </>;
}
