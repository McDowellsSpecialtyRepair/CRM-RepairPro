import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactChangeQuestions, allAnswered, type ContactAnswer } from "@/components/contact-change-questions";
import { Loader2 } from "lucide-react";

const FIELDS = ["customerType", "firstName", "lastName", "companyName", "email", "phone", "mobile", "address", "city", "state", "zip", "referralSource"] as const;
const ADDR = ["address", "city", "state", "zip"];

interface Props { open: boolean; onOpenChange: (o: boolean) => void; customer: any; onMergeRequest?: () => void; }

export function EditCustomerDialog({ open, onOpenChange, customer, onMergeRequest }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [diffs, setDiffs] = useState<any[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, ContactAnswer | undefined>>({});
  const [dups, setDups] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const f: Record<string, string> = {};
    FIELDS.forEach((k) => (f[k] = customer?.[k] || ""));
    setForm(f); setDiffs(null); setAnswers({}); setDups([]); setError("");
  }, [open, customer?.id]);

  // Warn if the edited phone/email/address belongs to another customer
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest("POST", "/api/customers/check-duplicates", { ...form, excludeId: customer.id });
        setDups((r.matches || []).filter((m: any) => m.level === "likely"));
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [form.email, form.phone, form.mobile, form.address, form.firstName, form.lastName, form.companyName, open]);

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const save = async (withAnswers: boolean) => {
    setBusy(true); setError("");
    try {
      let d = diffs;
      if (!withAnswers) {
        const r = await apiRequest("POST", `/api/customers/${customer.id}/contact-diffs`, form);
        d = r.diffs || [];
        if (d!.length) { setDiffs(d); setBusy(false); return; }   // ask the questions first
      }
      const covered = new Set<string>();
      (d || []).forEach((x: any) => (x.key === "address" ? ADDR.forEach((k) => covered.add(k)) : covered.add(x.key)));
      const patch: any = {};
      FIELDS.forEach((k) => { if (!covered.has(k) && (form[k] || "") !== (customer[k] || "")) patch[k] = form[k]; });
      if (Object.keys(patch).length) await apiRequest("PATCH", `/api/customers/${customer.id}`, patch);
      if (d && d.length) {
        await apiRequest("POST", `/api/customers/${customer.id}/contact-update`, {
          context: "Profile edit",
          answers: d.map((x: any) => ({ key: x.key, current: x.current, incoming: x.incoming, answer: answers[x.key] })),
        });
      }
      qc.invalidateQueries();
      onOpenChange(false);
    } catch (e: any) { setError(String(e.message)); }
    setBusy(false);
  };

  const field = (k: string, label: string, type = "text") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" type={type} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} data-testid={`edit-${k}`} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{diffs ? "Confirm contact changes" : "Edit customer"}</DialogTitle></DialogHeader>

        {diffs ? (
          <div className="space-y-3" data-testid="edit-contact-review">
            <p className="text-sm text-muted-foreground">You changed contact details. Confirm with the customer so history stays accurate.</p>
            <ContactChangeQuestions diffs={diffs} answers={answers} onChange={(k, a) => setAnswers({ ...answers, [k]: a })} />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Customer Type</Label>
              <Select value={form.customerType || "retail"} onValueChange={(v) => set("customerType", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["retail", "dealership", "insurance", "fleet", "commercial"].map((t) => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">{field("firstName", "First Name")}{field("lastName", "Last Name")}</div>
            {field("companyName", "Company Name")}
            {field("email", "Email", "email")}
            <div className="grid grid-cols-2 gap-3">{field("phone", "Phone", "tel")}{field("mobile", "Mobile", "tel")}</div>
            {field("address", "Street Address")}
            <div className="grid grid-cols-3 gap-3">{field("city", "City")}{field("state", "State")}{field("zip", "ZIP")}</div>
            {field("referralSource", "Referral Source")}

            {dups.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-1" data-testid="edit-dup-warning">
                <div className="font-semibold">These details match another customer</div>
                {dups.map((m) => (
                  <div key={m.id} className="text-xs">{m.name} ({m.customerNumber}): {m.reasons.join(", ")}</div>
                ))}
                {onMergeRequest && <Button size="sm" variant="outline" className="mt-1" onClick={() => { onOpenChange(false); onMergeRequest(); }}>Merge accounts instead</Button>}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          {diffs ? (
            <>
              <Button variant="outline" onClick={() => setDiffs(null)}>Back</Button>
              <Button onClick={() => save(true)} disabled={busy || !allAnswered(diffs, answers)} data-testid="button-edit-confirm">
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => save(false)} disabled={busy} data-testid="button-edit-save">
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
