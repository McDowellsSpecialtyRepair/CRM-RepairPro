import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, Phone, Building2, User, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { CustomerLookup, DuplicateWarning } from "@/components/customer-lookup";
import { NewEstimateDialog } from "@/components/new-estimate-dialog";
import { ContactChangeQuestions, allAnswered, type ContactAnswer } from "@/components/contact-change-questions";

const customerTypeColors: Record<string, string> = {
  retail: "bg-chart-1/15 text-chart-1",
  dealership: "bg-chart-2/15 text-chart-2",
  insurance: "bg-chart-3/15 text-chart-3",
  fleet: "bg-chart-4/15 text-chart-4",
  commercial: "bg-chart-5/15 text-chart-5",
};

export default function Customers() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  // Quick start from lookup / duplicate warning
  const [startFor, setStartFor] = useState<{ id: number; mode: "estimate" | "workorder" } | null>(null);

  // Duplicate detection while typing
  const [dupMatches, setDupMatches] = useState<any[]>([]);
  const [confirmNew, setConfirmNew] = useState(false);
  const [createError, setCreateError] = useState("");

  const createCustomer = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customers", data),
    onError: (e: any) => {
      const msg = String(e.message || "");
      const jsonStart = msg.indexOf("{");
      try {
        const body = JSON.parse(msg.slice(jsonStart));
        if (body.duplicate) { setDupMatches(body.matches || []); setCreateError("Likely duplicate: confirm this is a different customer to continue."); return; }
        setCreateError(body.message || msg);
      } catch { setCreateError(msg); }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setCreatedId(data.id);
      setTimeout(() => {
        setDialogOpen(false);
        setCreatedId(null);
        navigate(`/customers/${data.id}`);
      }, 1000);
    },
  });

  const [form, setForm] = useState({
    customerType: "retail",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "service@mcdowellsrepair.com",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const hasInput = [form.firstName, form.lastName, form.companyName, form.email, form.phone, form.address].some((v) => v.trim().length >= 2);
    if (!hasInput) { setDupMatches([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiRequest("POST", "/api/customers/check-duplicates", form);
        setDupMatches(r.matches || []);
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [form.firstName, form.lastName, form.companyName, form.email, form.phone, form.address, form.zip, dialogOpen]);

  const likelyDup = dupMatches.some((m) => m.level === "likely");

  const handleSubmit = () => {
    setCreateError("");
    createCustomer.mutate({ ...form, status: "active", confirmDuplicate: confirmNew });
  };

  const [review, setReview] = useState<{ c: any; action: "open" | "estimate"; diffs: any[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, ContactAnswer | undefined>>({});
  const [savingReview, setSavingReview] = useState(false);

  const proceed = (c: any, action: "open" | "estimate") => {
    setDialogOpen(false); setReview(null); setAnswers({});
    if (action === "open") navigate(`/customers/${c.id}`);
    else setStartFor({ id: c.id, mode: "estimate" });
  };

  const useExisting = async (c: any, action: "open" | "estimate") => {
    try {
      const r = await apiRequest("POST", `/api/customers/${c.id}/contact-diffs`, form);
      if (r.diffs?.length) { setAnswers({}); setReview({ c, action, diffs: r.diffs }); return; }
    } catch { /* fall through */ }
    proceed(c, action);
  };

  const saveReview = async () => {
    if (!review) return;
    setSavingReview(true);
    try {
      await apiRequest("POST", `/api/customers/${review.c.id}/contact-update`, {
        context: "Returning customer check-in",
        answers: review.diffs.map((d) => ({ key: d.key, current: d.current, incoming: d.incoming, answer: answers[d.key] })),
      });
      queryClient.invalidateQueries();
      proceed(review.c, review.action);
    } finally { setSavingReview(false); }
  };

  const filtered = (customers || []).filter((c: any) => {
    if (filter !== "all" && c.customerType !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = c.companyName || `${c.firstName} ${c.lastName}`;
      const qd = q.replace(/\D/g, "");
      return name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (qd.length >= 3 && (c.phone || "").replace(/\D/g, "").includes(qd));
    }
    return true;
  });

  const types = ["all", "retail", "dealership", "insurance", "fleet", "commercial"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">{customers?.length || 0} total customers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setDupMatches([]); setConfirmNew(false); setCreateError(""); setReview(null); setAnswers({}); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-customer">
              <Plus className="h-4 w-4 mr-1" /> New Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
            </DialogHeader>
            {review ? (
              <div className="space-y-3" data-testid="contact-review">
                <p className="text-sm">
                  <b>{review.c.name}</b> ({review.c.customerNumber}) is already on file, but some details you entered are different. Ask the customer:
                </p>
                <ContactChangeQuestions diffs={review.diffs} answers={answers} onChange={(k, a) => setAnswers({ ...answers, [k]: a })} />
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setReview(null)}>Back</Button>
                  <Button variant="ghost" onClick={() => proceed(review.c, review.action)} data-testid="button-review-skip">Skip, don't update</Button>
                  <Button onClick={saveReview} disabled={savingReview || !allAnswered(review.diffs, answers)} data-testid="button-review-save">
                    {savingReview ? "Saving..." : review.action === "estimate" ? "Update & start estimate" : "Update & open profile"}
                  </Button>
                </DialogFooter>
              </div>
            ) : createdId ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-chart-3 mb-2" />
                <p className="text-sm font-medium">Customer created successfully</p>
                <p className="text-xs text-muted-foreground mt-1">Opening customer profile...</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Customer Type</Label>
                    <Select value={form.customerType} onValueChange={(v) => setForm({ ...form, customerType: v })}>
                      <SelectTrigger className="mt-1" data-testid="select-customer-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="dealership">Dealership</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="fleet">Fleet</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.customerType === "retail" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">First Name</Label>
                        <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} data-testid="input-first-name" />
                      </div>
                      <div>
                        <Label className="text-xs">Last Name</Label>
                        <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} data-testid="input-last-name" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Company Name</Label>
                      <Input className="mt-1" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} data-testid="input-company-name" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-address" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">State</Label>
                      <Input className="mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">ZIP</Label>
                      <Input className="mt-1" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <DuplicateWarning matches={dupMatches} onUse={useExisting} />
                {likelyDup && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={confirmNew} onChange={(e) => setConfirmNew(e.target.checked)} data-testid="checkbox-confirm-new" />
                    <span>I checked. This is a different customer; create a new account anyway.</span>
                  </label>
                )}
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSubmit} disabled={createCustomer.isPending || (likelyDup && !confirmNew)} data-testid="button-save-customer">
                    {createCustomer.isPending ? "Creating..." : "Create Customer"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <NewEstimateDialog open={!!startFor} onOpenChange={(o) => { if (!o) setStartFor(null); }} customerId={startFor?.id} mode={startFor?.mode} key={startFor ? `${startFor.id}-${startFor.mode}` : "none"} />

      <Card>
        <CardContent className="p-4 space-y-2">
          <div>
            <div className="text-sm font-semibold">Customer lookup</div>
            <p className="text-xs text-muted-foreground">Find a repeat customer by name, phone (any format), email, VIN/HIN, plate, vehicle, customer #, or estimate/work order/invoice #.</p>
          </div>
          <CustomerLookup onNewEstimate={(id) => setStartFor({ id, mode: "estimate" })} onNewWorkOrder={(id) => setStartFor({ id, mode: "workorder" })} />
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            data-testid={`button-filter-${t}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <input
          type="text"
          placeholder="Filter list..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-64"
          data-testid="input-customer-search"
        />
      </div>

      {/* Customer grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-24 rounded bg-muted mb-2"></div>
                <div className="h-3 w-32 rounded bg-muted"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => {
            const name = c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
            const initials = c.companyName
              ? c.companyName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
              : `${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase();
            return (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                data-testid={`link-customer-${c.id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{name}</span>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] ${customerTypeColors[c.customerType] || ""}`}>
                          {c.customerType}
                        </Badge>
                        <div className="mt-2 space-y-1">
                          {c.companyName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" /> {c.companyName}
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" /> {c.email}
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No customers found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
