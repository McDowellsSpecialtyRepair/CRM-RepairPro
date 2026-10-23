import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Trash2, Plus, BookCheck } from "lucide-react";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
type Line = { id?: number; description: string; quantity: number; unitPrice: number; lineType: "labor" | "parts"; serviceCategory?: string };

// Bookkeeper / manager: correct an issued invoice until it is marked "Entered in QuickBooks", then lock it.
export function InvoiceCorrection({ invoice }: { invoice: any }) {
  const { can, user } = useAuth() as any;
  const qc = useQueryClient();
  const qb = useQuery<any>({ queryKey: ["/api/invoices", String(invoice.id), "quickbooks"], queryFn: () => apiRequest("GET", `/api/invoices/${invoice.id}/quickbooks`) });
  const [draft, setDraft] = useState<{ lines: Line[]; discount: number; discountNote: string; taxRate: number; dueDate: string; issueDate: string; notes: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const entered = !!qb.data?.enteredAt;
  const canCorrect = can("invoices.correct");
  const manager = ["owner", "admin", "manager"].includes(user?.role);
  async function refresh() { await qc.invalidateQueries({ queryKey: ["/api/invoices"] }); await qc.invalidateQueries({ queryKey: ["/api/invoices", String(invoice.id), "quickbooks"] }); }
  async function markEntered(value: boolean) {
    if (!value && !window.confirm("Undo \"Entered in QuickBooks\"? The invoice becomes correctable again. Make the same change in QuickBooks.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await apiRequest("POST", `/api/invoices/${invoice.id}/quickbooks`, { entered: value }); await refresh(); setNotice(value ? "Marked as entered in QuickBooks. The invoice is now locked." : "Unlocked for corrections."); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const start = () => { setError(""); setNotice(""); setDraft({
    lines: (invoice.lineItems || []).map((l: any) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineType: l.lineType === "parts" ? "parts" : "labor", serviceCategory: l.serviceCategory })),
    discount: invoice.discount || 0, discountNote: invoice.discountNote || "", taxRate: invoice.taxRate || 0, dueDate: invoice.dueDate || "", issueDate: invoice.issueDate || "", notes: invoice.notes || "", reason: "" }); };
  const setLine = (i: number, patch: Partial<Line>) => draft && setDraft({ ...draft, lines: draft.lines.map((l, j) => j === i ? { ...l, ...patch } : l) });
  async function save() {
    if (!draft) return;
    if (!draft.reason.trim()) { setError("Enter the reason for the correction."); return; }
    setBusy(true); setError("");
    try {
      const r = await apiRequest("PUT", `/api/invoices/${invoice.id}/correction`, { ...draft, discountNote: draft.discountNote || null });
      await refresh(); setDraft(null);
      setNotice(`Invoice corrected. New total ${money(r.invoice.total)}.${r.warnings?.length ? " " + r.warnings.join(" ") : ""}`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const subtotal = draft ? draft.lines.reduce((s, l) => s + Math.round((l.quantity || 0) * (l.unitPrice || 0) * 100) / 100, 0) : 0;

  return <Card data-testid="card-invoice-correction"><CardContent className="p-4 space-y-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><BookCheck className="h-4 w-4" /><h2 className="font-semibold">QuickBooks and corrections</h2></div>
      <div className="flex flex-wrap gap-2">
        {!entered && canCorrect && !draft && invoice.status !== "void" && <Button size="sm" variant="outline" onClick={start} data-testid="button-correct-invoice">Correct invoice</Button>}
        {!entered && can("billing.write") && !draft && <Button size="sm" onClick={() => markEntered(true)} disabled={busy} data-testid="button-mark-qb">Mark as entered in QuickBooks</Button>}
        {entered && manager && <Button size="sm" variant="outline" onClick={() => markEntered(false)} disabled={busy} data-testid="button-undo-qb">Undo "entered in QuickBooks"</Button>}
      </div>
    </div>
    <p className="text-muted-foreground" data-testid="text-qb-state">{entered
      ? `Entered in QuickBooks on ${String(qb.data.enteredAt).slice(0, 10)}${qb.data.enteredBy ? ` by ${qb.data.enteredBy}` : ""}. Locked: make any change in QuickBooks as an adjustment${manager ? ", or undo the mark first" : ""}.`
      : "Not entered in QuickBooks yet. A bookkeeper or manager can still correct this invoice; every change is kept in the change history with the reason. RepairPro is not connected to QuickBooks, so mark it after you enter it there."}</p>
    {draft && <div className="rounded-md border p-3 space-y-3" data-testid="invoice-correction-form">
      <div className="space-y-2">{draft.lines.map((l, i) => <div key={l.id ?? `new-${i}`} className="grid gap-2 sm:grid-cols-12 items-end border-b pb-2" data-testid={`correction-line-${i}`}>
        <label className="sm:col-span-5">Description<Input aria-label={`Line ${i + 1} description`} className="mt-1" value={l.description} onChange={e => setLine(i, { description: e.target.value })} /></label>
        <label className="sm:col-span-2">Type<select aria-label={`Line ${i + 1} type`} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-2" value={l.lineType} onChange={e => setLine(i, { lineType: e.target.value as any })}><option value="labor">Labor</option><option value="parts">Parts / materials</option></select></label>
        <label className="sm:col-span-1">Qty<NumberInput aria-label={`Line ${i + 1} quantity`} className="mt-1" value={l.quantity} onValueChange={n => setLine(i, { quantity: n })} /></label>
        <label className="sm:col-span-2">Unit price<NumberInput aria-label={`Line ${i + 1} unit price`} className="mt-1" value={l.unitPrice} onValueChange={n => setLine(i, { unitPrice: n })} /></label>
        <div className="sm:col-span-1 text-right tabular-nums pb-2">{money(Math.round((l.quantity || 0) * (l.unitPrice || 0) * 100) / 100)}</div>
        <Button type="button" variant="ghost" className="sm:col-span-1" aria-label={`Remove line ${i + 1}`} disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
      </div>)}</div>
      <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: "", quantity: 1, unitPrice: 0, lineType: "labor" }] })} data-testid="button-add-correction-line"><Plus className="h-4 w-4 mr-1" />Add line</Button>
      <div className="grid gap-2 sm:grid-cols-3">
        <label>Discount ($)<NumberInput aria-label="Invoice discount" className="mt-1" value={draft.discount} onValueChange={n => setDraft({ ...draft, discount: n })} /></label>
        <label className="sm:col-span-2">Discount description<Input aria-label="Invoice discount description" className="mt-1" value={draft.discountNote} onChange={e => setDraft({ ...draft, discountNote: e.target.value })} /></label>
        <label>Tax rate (%)<NumberInput aria-label="Invoice tax rate" className="mt-1" value={draft.taxRate} onValueChange={n => setDraft({ ...draft, taxRate: n })} /></label>
        <label>Invoice date<Input aria-label="Invoice date" type="date" className="mt-1" value={draft.issueDate} onChange={e => setDraft({ ...draft, issueDate: e.target.value })} /></label>
        <label>Due date<Input aria-label="Invoice due date" type="date" className="mt-1" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></label>
        <label className="sm:col-span-3">Notes on the invoice<Input aria-label="Invoice notes" className="mt-1" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
        <label className="sm:col-span-3">Reason for the correction (required, kept in the history)<Input aria-label="Correction reason" className="mt-1" maxLength={500} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder="For example: customer approved extra seat repair on site" /></label>
      </div>
      <p className="text-muted-foreground">Lines subtotal {money(subtotal)}. Tax, totals, technician production and sales credit are recalculated when you save, the same way as when the invoice was issued. The total can't go below what has already been paid.</p>
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={save} data-testid="button-save-correction">{busy ? "Saving…" : "Save correction"}</Button><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
    </div>}
    {notice && <p role="status" className="text-primary" data-testid="text-correction-notice">{notice}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </CardContent></Card>;
}
