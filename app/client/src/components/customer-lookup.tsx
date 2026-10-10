import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, FileText, Wrench, Car, Phone, Mail, ChevronRight } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export function useCustomerLookup(q: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest("GET", `/api/customers/lookup?q=${encodeURIComponent(term)}`);
        setResults(r.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return { results, loading };
}

interface Props {
  onNewEstimate?: (customerId: number) => void;
  onNewWorkOrder?: (customerId: number) => void;
  onSelect?: (customer: any) => void;   // picker mode (inside dialogs)
  autoFocus?: boolean;
  placeholder?: string;
}

export function CustomerLookup({ onNewEstimate, onNewWorkOrder, onSelect, autoFocus, placeholder }: Props) {
  const [q, setQ] = useState("");
  const { results, loading } = useCustomerLookup(q);
  const picker = !!onSelect;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder || "Name, phone, email, VIN, plate, customer # or estimate #"}
          className="pl-9 pr-9"
          data-testid="input-customer-lookup"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {q.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No existing customer matches “{q.trim()}”.</p>
      )}

      {results.length > 0 && (
        <div className={`space-y-2 ${picker ? "max-h-72 overflow-y-auto pr-1" : ""}`}>
          {results.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3 hover:border-primary/50" data-testid={`lookup-result-${c.id}`}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left flex-1" onClick={() => onSelect?.(c)} disabled={!picker}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.customerNumber}</span>
                    {c.estimateCount + c.jobCount + c.invoiceCount > 0 && <Badge variant="secondary" className="text-[10px]">Repeat customer</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {c.email}</span>}
                  </div>
                  {c.vehicles?.length > 0 && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <Car className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{c.vehicles.slice(0, 3).map((v: any) => v.label).join(" · ")}{c.vehicles.length > 3 ? ` +${c.vehicles.length - 3}` : ""}</span>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {c.estimateCount} est · {c.jobCount} WO · {c.invoiceCount} inv · {fmt(c.lifetimeValue)} lifetime{c.lastVisit ? ` · last ${fmtDate(c.lastVisit)}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.matchedOn.map((m: string) => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
                  </div>
                </button>
                {picker ? (
                  <Button size="sm" onClick={() => onSelect?.(c)} data-testid={`button-pick-${c.id}`}>Select</Button>
                ) : (
                  <Link href={`/customers/${c.id}`}><ChevronRight className="h-5 w-5 text-muted-foreground" /></Link>
                )}
              </div>
              {!picker && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/customers/${c.id}`}><Button size="sm" variant="outline">Open profile</Button></Link>
                  {onNewEstimate && <Button size="sm" onClick={() => onNewEstimate(c.id)} data-testid={`button-lookup-estimate-${c.id}`}><FileText className="h-3.5 w-3.5 mr-1" /> New Estimate</Button>}
                  {onNewWorkOrder && <Button size="sm" variant="outline" onClick={() => onNewWorkOrder(c.id)} data-testid={`button-lookup-wo-${c.id}`}><Wrench className="h-3.5 w-3.5 mr-1" /> New Work Order</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Warning panel shown while entering a new customer
export function DuplicateWarning({ matches, onUse, useOnlyLabel }: { matches: any[]; onUse: (c: any, action: "open" | "estimate") => void; useOnlyLabel?: string }) {
  if (!matches.length) return null;
  const likely = matches.some((m) => m.level === "likely");
  return (
    <div className={`rounded-md border p-3 space-y-2 ${likely ? "border-destructive/50 bg-destructive/5" : "border-amber-500/50 bg-amber-500/10"}`} data-testid="duplicate-warning">
      <div className="text-sm font-semibold">{likely ? "This customer may already exist" : "Possible match found"}</div>
      <p className="text-xs text-muted-foreground">Check before creating a new account so service history, vehicles, and warranties stay in one place.</p>
      {matches.map((m) => (
        <div key={m.id} className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{m.name}</span>
            <span className="text-xs text-muted-foreground">{m.customerNumber}</span>
            <Badge variant={m.level === "likely" ? "destructive" : "secondary"} className="text-[10px]">{m.level === "likely" ? "Likely duplicate" : "Possible"}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{[m.phone, m.email, [m.address, m.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
          <div className="mt-1 flex flex-wrap gap-1">{m.reasons.map((r: string) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {useOnlyLabel ? <Button size="sm" onClick={() => onUse(m, "estimate")}>{useOnlyLabel}</Button> : <>
              <Button size="sm" variant="outline" onClick={() => onUse(m, "open")}>Open existing</Button>
              <Button size="sm" onClick={() => onUse(m, "estimate")}>Use existing &amp; start estimate</Button>
            </>}
          </div>
        </div>
      ))}
    </div>
  );
}
