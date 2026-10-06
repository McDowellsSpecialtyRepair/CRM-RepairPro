import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, printDocument } from "@/lib/queryClient";
import { InvoiceLabor, DeliveryStatus } from "@/components/labor-sales";
import {InvoiceCommercial} from "@/components/estimate-commercial";
import {customerLineLabel,documentBreakdown} from "@shared/estimate-rules";
import {DocumentBreakdown} from "@/components/document-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCircle, Printer, Plus, CreditCard } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import { localToday } from "@shared/operations";
import { formatCalendarDate } from "@shared/calendar-date";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  return formatCalendarDate(s, { month: "short", day: "numeric", year: "numeric" });
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-chart-4/15 text-chart-4",
  partial: "bg-chart-2/15 text-chart-2",
  paid: "bg-chart-3/15 text-chart-3",
  overdue: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
};

export default function InvoiceDetail() {
  const [match, params] = useRoute("/invoices/:id");
  const id = params?.id;
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["/api/invoices", id],
    queryFn: () => apiRequest("GET", `/api/invoices/${id}`),
    enabled: !!id,
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const [payment, setPayment] = useState({ amount: 0, paymentMethod: "cash", reference: "" });
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [tab, setTab] = useState("details");
  const [paymentError, setPaymentError] = useState("");

  const recordPayment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPaymentKey(crypto.randomUUID());
      setPaymentError("");
      setPayment({ amount: 0, paymentMethod: "cash", reference: "" });
    },
    onError: (error: Error) => setPaymentError(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/invoices/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] }),
  });

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const customer = (customers || []).find((c: any) => c.id === invoice.customerId);
  const customerName = customer?.companyName || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "Unknown";

  const lineItems = invoice.lineItems || [];
  const payments = invoice.payments || [];

  const handlePayment = () => {
    if (payment.amount <= 0 || payment.amount > invoice.balanceDue || invoice.status === "void") return;
    setPaymentError("");
    recordPayment.mutate({
      ...payment,
      amount: Number(payment.amount),
      idempotencyKey: paymentKey,
      invoiceId: Number(id),
      customerId: invoice.customerId,
      paymentDate: localToday(),
    });
  };

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to Invoices
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  {invoice.invoiceNumber}
                </h1>
                <Badge variant="secondary" className={statusColors[invoice.status] || ""}>
                  {invoice.status === "sent" ? "issued" : invoice.status}
                </Badge>
                {invoice.qbSynced ? (
                  <Badge variant="outline" className="text-[10px] text-chart-3">QB Synced: {invoice.qbTxnId}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-chart-4">Not Synced</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{customerName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Issued: {formatDate(invoice.issueDate)} • Due: {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div className="flex gap-2">
              {invoice.status === "draft" && (
                <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("sent")} data-testid="button-send-invoice">
                  <Send className="h-4 w-4 mr-1" /> Send
                </Button>
              )}
              {invoice.balanceDue > 0 && !["draft", "void"].includes(invoice.status) && (
                <Button size="sm" onClick={() => { setPayment({ ...payment, amount: invoice.balanceDue }); setTab("payments"); }} data-testid="button-mark-paid">
                  <CreditCard className="h-4 w-4 mr-1" /> Record payment
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => void printDocument(`/print/invoice/${id}`)} data-testid="button-print-invoice">
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeliveryStatus type="invoice" id={id!} />
      <InvoiceLabor id={id} lines={lineItems} />
      <InvoiceCommercial id={id}/>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details" data-testid="tab-details">Invoice Details</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium pb-2">Description</th>
                    <th className="text-right font-medium pb-2 pl-3">Qty</th>
                    <th className="text-right font-medium pb-2 pl-3">Unit Price</th>
                    <th className="text-right font-medium pb-2 pl-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/50" data-testid={`row-invoice-item-${item.id}`}>
                      <td className="py-2.5 text-sm">{item.description}<span className="block text-xs text-muted-foreground">{customerLineLabel(item)}</span></td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">{item.quantity} {item.unit}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No line items</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="ml-auto w-full max-w-sm">
            <CardContent className="p-4 space-y-2">
              <DocumentBreakdown lines={lineItems} subtotal={invoice.subtotal}/>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{documentBreakdown(lineItems,invoice.subtotal).taxLabel} ({invoice.taxRate}%)</span>
                <span className="tabular-nums whitespace-nowrap shrink-0">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-chart-3">
                <span>Paid</span>
                <span className="tabular-nums">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              {(
                <div className={`flex justify-between text-sm font-medium ${invoice.balanceDue > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  <span>Balance Due</span>
                  <span className="tabular-nums">{formatCurrency(invoice.balanceDue)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="payment-amount" className="text-xs text-muted-foreground mb-1 block">Amount</label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min="0.01" step="0.01" max={invoice.balanceDue}
                    placeholder="0.00"
                    value={payment.amount}
                    onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}
                    data-testid="input-payment-amount"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Method</label>
                  <Select value={payment.paymentMethod} onValueChange={(v) => setPayment({ ...payment, paymentMethod: v })}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="payment-reference" className="text-xs text-muted-foreground mb-1 block">Reference</label>
                  <Input
                    id="payment-reference"
                    placeholder="Check #, etc."
                    value={payment.reference}
                    onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handlePayment} disabled={payment.amount <= 0 || payment.amount > invoice.balanceDue || ["void", "draft"].includes(invoice.status) || recordPayment.isPending} className="w-full" data-testid="button-record-payment">
                    <CreditCard className="h-4 w-4 mr-1" /> Record
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Recording a payment updates the balance and status. This records money received; it does not charge a card.</p>
              {paymentError && <p role="alert" className="text-sm text-destructive mt-2">{paymentError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`div-payment-${p.id}`}>
                      <div className="min-w-0 pr-3">
                        <span className="text-sm font-medium break-all">{p.paymentNumber}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.paymentMethod} {p.reference && `• ${p.reference}`} • {formatDate(p.paymentDate)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col sm:flex-row items-end sm:items-center gap-2">
                        <span className="text-sm font-bold tabular-nums">{formatCurrency(p.amount)}</span>
                        {p.qbSynced ? (
                          <Badge variant="outline" className="text-[10px] text-chart-3">QB Synced</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-chart-4">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
