import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
type Draft = { id?: number; code: string; description: string; kind: "percent" | "amount"; amount: number; active: boolean };
const blank: Draft = { code: "", description: "", kind: "percent", amount: 0, active: true };

// The discount matrix: each code has a description and an amount (percent of labor or dollars off labor).
// Estimators pick a code on the estimate; changing a code here never reprices an existing estimate.
export function DiscountCodesManager() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: ["/api/discount-codes"], queryFn: () => apiRequest("GET", "/api/discount-codes") });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState("");
  const manage = can("pricing.manage");

  async function save(d: Draft) {
    setBusy(true); setError(""); setSaved("");
    try {
      const body = { code: d.code, description: d.description, kind: d.kind, amount: d.amount, active: d.active };
      await apiRequest(d.id ? "PATCH" : "POST", d.id ? `/api/discount-codes/${d.id}` : "/api/discount-codes", body);
      await qc.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      setDraft(null); setSaved(`Discount code ${d.code.trim().toUpperCase()} saved.`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const select = "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return <Card data-testid="discount-codes-manager">
    <CardHeader><CardTitle className="text-base">Discount codes</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm">
      <p className="text-muted-foreground">Each code has a description and an amount. Discounts come off labor only, so parts, materials, freight and their sales tax are not changed. Changing or turning off a code doesn't change estimates that already use it.</p>
      {q.error && <p role="alert" className="text-destructive">Discount codes could not load. {(q.error as Error).message}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Discount</th><th className="py-2 pr-3">Status</th>{manage && <th />}</tr></thead>
        <tbody>
          {(q.data || []).map(c => <tr key={c.id} className="border-b" data-testid={`discount-code-row-${c.code}`}>
            <td className="py-2 pr-3 font-mono">{c.code}</td><td className="py-2 pr-3">{c.description}</td>
            <td className="py-2 pr-3 whitespace-nowrap">{c.kind === "percent" ? `${c.amount}% off labor` : `${money(c.amount)} off labor`}</td>
            <td className="py-2 pr-3">{c.active ? "Active" : "Turned off"}</td>
            {manage && <td className="py-2 text-right whitespace-nowrap">
              <Button size="sm" variant="ghost" onClick={() => { setDraft({ id: c.id, code: c.code, description: c.description, kind: c.kind, amount: c.amount, active: c.active }); setError(""); setSaved(""); }}>Edit</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ id: c.id, code: c.code, description: c.description, kind: c.kind, amount: c.amount, active: !c.active })}>{c.active ? "Turn off" : "Turn on"}</Button>
            </td>}
          </tr>)}
          {q.data && q.data.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No discount codes yet.</td></tr>}
        </tbody>
      </table></div>
      {!manage && <p className="text-muted-foreground">Only staff who manage pricing can add or change discount codes.</p>}
      {manage && !draft && <Button size="sm" variant="outline" onClick={() => { setDraft({ ...blank }); setError(""); setSaved(""); }} data-testid="button-new-discount-code">Add discount code</Button>}
      {manage && draft && <div className="rounded-md border p-3 grid gap-3 sm:grid-cols-2" data-testid="discount-code-form">
        <label>Code<Input aria-label="Code" className="mt-1" maxLength={30} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="For example: VET10" /></label>
        <label>Description<Input aria-label="Description" className="mt-1" maxLength={200} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="For example: Veteran discount" /></label>
        <label>Type<select aria-label="Type" className={select} value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as any })}>
          <option value="percent">Percent of labor</option><option value="amount">Dollar amount off labor</option></select></label>
        <label>{draft.kind === "percent" ? "Percent" : "Amount ($)"}<NumberInput aria-label="Amount" className="mt-1" value={draft.amount} onValueChange={n => setDraft({ ...draft, amount: n })} /></label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !draft.code.trim() || !draft.description.trim() || !draft.amount} onClick={() => save(draft)} data-testid="button-save-discount-code">{busy ? "Saving…" : "Save discount code"}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setDraft(null); setError(""); }}>Cancel</Button>
        </div>
      </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="text-primary">{saved}</p>}
    </CardContent>
  </Card>;
}
