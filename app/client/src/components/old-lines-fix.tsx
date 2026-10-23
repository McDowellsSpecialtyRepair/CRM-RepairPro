import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { nonLaborCategory } from "@shared/estimate-rules";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

// Estimates from the old system: lines marked "Needs classification" and old-style negative discount lines
// block every change. One box to classify each line and turn the negative line into the discount.
export function OldLinesFix({ estimate, lines }: { estimate: any; lines: any[] }) {
  const qc = useQueryClient();
  const legacy = lines.filter(l => l.lineType === "legacy" && l.total >= 0);
  const negative = lines.filter(l => l.total < 0);
  const [types, setTypes] = useState<Record<number, string>>(() => Object.fromEntries(legacy.map(l => [l.id, nonLaborCategory(l.serviceCategory) ? "parts" : "labor"])));
  const [neg, setNeg] = useState<"add_to_discount" | "delete">("add_to_discount");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!legacy.length && !negative.length) return null;
  const negTotal = negative.reduce((s, l) => s - l.total, 0);
  async function fix() {
    setBusy(true); setError("");
    try {
      await apiRequest("POST", `/api/estimates/${estimate.id}/fix-old-lines`, { lines: legacy.map(l => ({ id: l.id, lineType: types[l.id] })), negative: neg });
      await qc.invalidateQueries({ queryKey: ["/api/estimates"] });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="mb-4 rounded-md border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-3" data-testid="old-lines-fix">
    <p className="font-semibold">This estimate came from the old system and needs a quick fix before it can be changed.</p>
    {legacy.length > 0 && <div className="space-y-2"><p>Choose whether each line is <strong>labor</strong> (technician work) or <strong>parts / materials</strong>:</p>
      {legacy.map(l => <label key={l.id} className="flex flex-wrap items-center justify-between gap-2"><span>{l.description} · {money(l.total)}</span>
        <select aria-label={`${l.description} is`} className="h-9 rounded-md border bg-background px-2" value={types[l.id]} onChange={e => setTypes({ ...types, [l.id]: e.target.value })}>
          <option value="labor" disabled={nonLaborCategory(l.serviceCategory)}>Labor</option><option value="parts">Parts / materials</option></select></label>)}
    </div>}
    {negative.length > 0 && <div className="space-y-1"><p>Old-style discount line{negative.length > 1 ? "s" : ""}: {negative.map(l => `"${l.description}" ${money(l.total)}`).join(", ")}. The estimate's discount is currently {money(estimate.discount || 0)}.</p>
      <label className="flex items-start gap-2"><input type="radio" name="neg" checked={neg === "add_to_discount"} onChange={() => setNeg("add_to_discount")} className="mt-1" /><span>Move it into the discount (the discount becomes {money((estimate.discount || 0) + negTotal)})</span></label>
      <label className="flex items-start gap-2"><input type="radio" name="neg" checked={neg === "delete"} onChange={() => setNeg("delete")} className="mt-1" /><span>Delete it, because the discount of {money(estimate.discount || 0)} already includes it</span></label>
    </div>}
    <p className="text-xs text-muted-foreground">Totals and tax are recalculated after the fix, and the before and after are kept in the change history.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button size="sm" onClick={fix} disabled={busy} data-testid="button-fix-old-lines">{busy ? "Fixing…" : "Fix old lines"}</Button>
  </div>;
}
