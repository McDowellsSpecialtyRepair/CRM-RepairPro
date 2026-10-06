import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerLookup } from "@/components/customer-lookup";
import { ContactChangeQuestions, allAnswered, type ContactAnswer } from "@/components/contact-change-questions";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  contacts: "contacts", vehicles: "vehicles / RVs / boats", service_history: "service history records", assets: "furniture & commercial items",
  jobs: "work orders", estimates: "estimates", invoices: "invoices", payments: "payments", activities: "activity entries",
  schedule_slots: "schedule entries", bookings: "booking requests", coi_certificates: "insurance certificates", third_party_payers: "third-party payers",
  fleet_accounts: "fleet accounts", fleet_authorized_contacts: "fleet contacts", warranty_claims: "warranty claims", asset_details: "item details",
};

interface Props { open: boolean; onOpenChange: (o: boolean) => void; customer: any; }

export function MergeCustomerDialog({ open, onOpenChange, customer }: Props) {
  const qc = useQueryClient();
  const [suggested, setSuggested] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [useSource, setUseSource] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ContactAnswer | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    if (!open) { setSourceId(null); setPreview(null); setUseSource({}); setConfirm(false); setAnswers({}); setError(""); setDone(null); return; }
    apiRequest("POST", "/api/customers/check-duplicates", { ...customer, excludeId: customer.id })
      .then((r) => setSuggested(r.matches || [])).catch(() => setSuggested([]));
  }, [open, customer?.id]);

  useEffect(() => {
    setPreview(null); setAnswers({}); setConfirm(false); setUseSource({});
    if (!sourceId) { setPreview(null); return; }
    setError("");
    let active = true;
    apiRequest("GET", `/api/customers/${customer.id}/merge-preview?sourceId=${sourceId}`)
      .then(r => { if (active) setPreview(r); }).catch((e) => { if (active) setError(String(e.message)); });
    return () => { active = false; };
  }, [sourceId, customer.id]);

  // Show the NEWER account's value as the "new" one
  const swapped = preview ? !preview.sourceIsNewer : false;
  const shownDiffs = (preview?.contactDiffs || []).map((d: any) => swapped
    ? { ...d, current: d.incoming, incoming: d.current, currentText: d.incomingText, incomingText: d.currentText }
    : d);
  const flip: Record<string, ContactAnswer> = { replaced: "kept", kept: "replaced", both: "both" };
  const contactAnswers = (preview?.contactDiffs || []).filter((d: any) => answers[d.key]).map((d: any) => ({
    key: d.key, current: d.current, incoming: d.incoming,
    answer: swapped ? flip[answers[d.key] as string] : answers[d.key],
  }));
  const ready = preview && allAnswered(shownDiffs, answers);

  const doMerge = async () => {
    setBusy(true); setError("");
    try {
      const r = await apiRequest("POST", `/api/customers/${customer.id}/merge`, { sourceId, useSource, contactAnswers, version: preview.version, confirmed: confirm });
      qc.invalidateQueries();
      setDone(r);
    } catch (e: any) { setError(String(e.message)); }
    setBusy(false);
  };

  const movingEntries = preview ? Object.entries(preview.moving as Record<string, number>) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge duplicate customer</DialogTitle>
          <DialogDescription>
            Everything from the duplicate moves into <b>{customer.companyName || `${customer.firstName} ${customer.lastName}`}</b> ({customer.customerNumber}). The duplicate account is then removed.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-2" data-testid="merge-done">
            <CheckCircle2 className="h-10 w-10 mx-auto text-chart-3" />
            <p className="text-sm font-medium">Merged {done.removed} into {customer.customerNumber}</p>
            <p className="text-xs text-muted-foreground">
              Moved: {Object.entries(done.moved).map(([t, n]) => `${n} ${TABLE_LABELS[t] || t}`).join(", ") || "no linked records"}.
            </p>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : !sourceId ? (
          <div className="space-y-3">
            {suggested.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Suggested duplicates</div>
                {suggested.map((m) => (
                  <div key={m.id} className="rounded-md border border-border p-2.5 flex items-start justify-between gap-2" data-testid={`merge-suggest-${m.id}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.customerNumber}</span>
                        <Badge variant={m.level === "likely" ? "destructive" : "secondary"} className="text-[10px]">{m.level === "likely" ? "Likely" : "Possible"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{[m.phone, m.email].filter(Boolean).join(" · ")}</div>
                      <div className="mt-1 flex flex-wrap gap-1">{m.reasons.map((r: string) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}</div>
                    </div>
                    <Button size="sm" onClick={() => setSourceId(m.id)} data-testid={`button-merge-pick-${m.id}`}>Select</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Or find the duplicate</div>
              <CustomerLookup placeholder="Name, phone, email, VIN…" onSelect={(c) => c.id !== customer.id && setSourceId(c.id)} />
            </div>
          </div>
        ) : !preview ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4" data-testid="merge-preview">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1">{preview.source.customerNumber} {preview.source.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span className="rounded-md border border-primary bg-primary/5 px-2 py-1 font-medium">{preview.keep.customerNumber} {preview.keep.name}</span>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Records that will move</div>
              {movingEntries.length ? (
                <ul className="text-sm space-y-0.5">
                  {movingEntries.map(([t, n]) => <li key={t}>{n} {TABLE_LABELS[t] || t}</li>)}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No linked records.</p>}
              {(preview.vehicles.length > 0 || preview.estimates.length > 0) && (
                <p className="text-xs text-muted-foreground mt-1">{[...preview.vehicles, ...preview.estimates].join(" · ")}</p>
              )}
            </div>

            {shownDiffs.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Ask the customer</div>
                <p className="text-xs text-muted-foreground mb-2">
                  The {swapped ? preview.keep.customerNumber : preview.source.customerNumber} account was used more recently, so its details are shown as "New."
                </p>
                <ContactChangeQuestions diffs={shownDiffs} answers={answers} onChange={(k, a) => setAnswers({ ...answers, [k]: a })} />
              </div>
            )}

            {preview.fields.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Other details that differ</div>
                <p className="text-xs text-muted-foreground mb-2">Choose which to keep. Whatever you don't choose is saved in the customer's notes, so nothing is lost.</p>
                <div className="space-y-2">
                  {preview.fields.map((f: any) => {
                    const pick = f.keep ? (useSource[f.field] === "source" ? "source" : "keep") : "source";
                    return (
                      <div key={f.field} className="rounded-md border border-border p-2">
                        <div className="text-xs font-medium mb-1">{f.label}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(["keep", "source"] as const).map((side) => {
                            const val = side === "keep" ? f.keep : f.source;
                            const disabled = !val;
                            return (
                              <button key={side} type="button" disabled={disabled}
                                onClick={() => setUseSource({ ...useSource, [f.field]: side === "source" ? "source" : "keep" })}
                                className={`text-left rounded border px-2 py-1.5 text-xs break-all ${pick === side ? "border-primary bg-primary/10" : "border-border"} ${disabled ? "opacity-40" : ""}`}
                                data-testid={`merge-field-${f.field}-${side}`}>
                                <span className="block text-[10px] text-muted-foreground">{side === "keep" ? preview.keep.customerNumber : preview.source.customerNumber}</span>
                                {val || "(blank)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!ready && <p className="text-xs text-amber-700 dark:text-amber-400">Answer each question above to continue.</p>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} data-testid="checkbox-merge-confirm" />
              <span>I understand {preview.source.customerNumber} will be removed after its records move to {preview.keep.customerNumber}.</span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!done && sourceId && preview && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSourceId(null)}>Back</Button>
            <Button onClick={doMerge} disabled={!confirm || busy || !ready} data-testid="button-merge-confirm">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Merge customers
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
