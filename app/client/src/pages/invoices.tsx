import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import { formatCalendarDate } from "@shared/calendar-date";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  return formatCalendarDate(s, { month: "short", day: "numeric" });
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-chart-4/15 text-chart-4",
  partial: "bg-chart-2/15 text-chart-2",
  paid: "bg-chart-3/15 text-chart-3",
  overdue: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
};

export default function Invoices() {
  const [filter, setFilter] = useState("all");
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: () => apiRequest("GET", "/api/invoices"),
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const customerMap = new Map((customers || []).map((c: any) => [c.id, c.companyName || `${c.firstName} ${c.lastName}`.trim()]));

  const filtered = (invoices || []).filter((i: any) => filter === "all" || i.status === filter);
  const statuses = ["all", "draft", "sent", "partial", "paid", "overdue"];

  const totalOutstanding = (invoices || [])
    .filter((i: any) => i.status !== "paid" && i.status !== "void")
    .reduce((sum: number, i: any) => sum + (i.balanceDue || 0), 0);

  const totalPaid = (invoices || [])
    .reduce((sum: number, i: any) => sum + (i.amountPaid || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground">{invoices?.length || 0} total invoices</p>
        </div>
        <Button data-testid="button-new-invoice">
          <Plus className="h-4 w-4 mr-1" /> New Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Collected</div>
            <div className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Outstanding Balance</div>
            <div className="text-lg font-bold tabular-nums mt-1 text-destructive">{formatCurrency(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Overdue Invoices</div>
            <div className="text-lg font-bold tabular-nums mt-1">
              {(invoices || []).filter((i: any) => i.status === "overdue").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            data-testid={`button-filter-${s}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-48 rounded bg-muted"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv: any) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`} data-testid={`link-invoice-${inv.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                      <Badge variant="secondary" className={`text-[10px] ${statusColors[inv.status] || ""}`}>
                        {inv.status === "sent" ? "issued" : inv.status}
                      </Badge>
                      {inv.qbSynced ? (
                        <Badge variant="outline" className="text-[10px] text-chart-3">QB Synced</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-chart-4">Not Synced</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customerMap.get(inv.customerId) || "Unknown"} • Issued {formatDate(inv.issueDate)}
                      {inv.dueDate && ` • Due ${formatDate(inv.dueDate)}`}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-base font-bold tabular-nums">{formatCurrency(inv.total)}</div>
                    {inv.balanceDue > 0 && (
                      <div className="text-[10px] text-destructive">Balance: {formatCurrency(inv.balanceDue)}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No invoices found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
