import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

// Discount on an estimate: pick a discount code (management's discount list supplies the description and
// amount) or enter one by hand with a description. Discounts reduce labor only, so parts, materials and
// freight keep their price and sales tax.
export function DiscountEditor({ estimate, locked, onEditingChange }: { estimate: any; locked: boolean; onEditingChange?: (editing: boolean) => void }) {
  const qc = useQueryClient();
  const codes = useQuery<any[]>({ queryKey: ["/api/discount-codes"], queryFn: () => apiRequest("GET", "/api/discount-codes") });
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(""), [note, setNote] = useState(""), [kind, setKind] = useState<"percent" | "amount">("percent"), [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { onEditingChange?.(open); }, [open, onEditingChange]);
  const active = (codes.data || []).filter(c => c.active);
  const chosen = active.find(c => c.code === code);
  const labor = (estimate.lineItems || []).reduce((n: number, l: any) => n + (l.lineType === "labor" ? Number(l.total) || 0 : 0), 0);
  const previewKind = chosen ? chosen.kind : kind, previewAmount = chosen ? chosen.amount : amount;
  const preview = previewKind === "percent" ? Math.round(labor * previewAmount) / 100 : previewAmount;

  const start = () => {
    setCode(estimate.discountCode || ""); setNote(estimate.discountCode ? "" : estimate.discountNote || "");
    setKind(estimate.discountPercent != null ? "percent" : "amount");
    setAmount(estimate.discountPercent != null ? estimate.discountPercent : (estimate.discountCode ? 0 : Number(estimate.discount) || 0));
    setError(""); setOpen(true);
  };
  async function apply(remove = false) {
    setBusy(true); setError("");
    try {
      const body = remove ? { discountBasis: "labor", discount: 0, discountPercent: null, discountCode: null, discountNote: null }
        : chosen ? { discountBasis: "labor", discountCode: chosen.code, discountNote: note.trim() || null }
        : { discountBasis: "labor", discountCode: null, discountNote: note.trim(), ...(kind === "percent" ? { discountPercent: amount, discount: 0 } : { discountPercent: null, discount: amount }) };
      await apiRequest("PATCH", `/api/estimates/${estimate.id}`, body);
      await qc.invalidateQueries({ queryKey: ["/api/estimates", String(estimate.id)] });
      setOpen(false);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const label = Number(estimate.discount) > 0
    ? [estimate.discountCode, estimate.discountNote].filter(Boolean).join(" · ") + (estimate.discountBasis === "labor" ? (estimate.discountPercent != null ? ` (${estimate.discountPercent}% off labor)` : " (off labor)") : "")
    : "";
  if (!open) return <div className="space-y-1" data-testid="discount-row">
    <div className="flex justify-between text-sm gap-2">
      <span className="text-muted-foreground">Discount</span>
      {Number(estimate.discount) > 0 ? <span className="tabular-nums text-destructive" data-testid="text-discount-amount">-{money(estimate.discount)}</span> : <span className="text-muted-foreground">None</span>}
    </div>
    {label && <p className="text-xs text-muted-foreground text-right" data-testid="text-discount-label">{label}</p>}
    {!locked && <div className="text-right"><Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={start} data-testid="button-edit-discount">{Number(estimate.discount) > 0 ? "Change discount" : "Add discount"}</Button></div>}
  </div>;

  return <div className="rounded-md border p-3 space-y-3 text-sm" data-testid="discount-editor">
    <p className="font-medium">Discount (off labor)</p>
    <label className="block">Discount code
      <select aria-label="Discount code" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={code} onChange={e => setCode(e.target.value)} data-testid="select-discount-code">
        <option value="">No code: enter the discount by hand</option>
        {active.map(c => <option key={c.id} value={c.code}>{c.code}: {c.description} ({c.kind === "percent" ? `${c.amount}% off labor` : `${money(c.amount)} off labor`})</option>)}
      </select></label>
    {codes.error && <p role="alert" className="text-destructive">Discount codes could not load. You can still enter a discount by hand.</p>}
    {!chosen && <div className="grid gap-2 sm:grid-cols-2">
      <label className="block sm:col-span-2">Description (printed on the estimate)
        <Input aria-label="Discount description" className="mt-1" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: Returning customer" /></label>
      <label className="block">Type
        <select aria-label="Discount type" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={e => setKind(e.target.value as any)}>
          <option value="percent">Percent of labor</option><option value="amount">Dollar amount off labor</option></select></label>
      <label className="block">{kind === "percent" ? "Percent" : "Amount ($)"}
        <NumberInput aria-label="Discount amount" className="mt-1" placeholder={kind === "percent" ? "10" : "0.00"} value={amount} onValueChange={setAmount} /></label>
    </div>}
    <p className="text-xs text-muted-foreground">Labor on this estimate: {money(labor)}. Discount: <strong>{money(preview)}</strong>. Discounts come off labor only, so parts, materials, freight and their sales tax don't change.{previewKind === "percent" ? " A percentage follows the labor if lines change." : ""}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={busy || (!chosen && (!amount || !note.trim()))} onClick={() => apply()} data-testid="button-apply-discount">{busy ? "Saving…" : "Apply discount"}</Button>
      {Number(estimate.discount) > 0 && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => apply(true)} data-testid="button-remove-discount">Remove discount</Button>}
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  </div>;
}
