import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NewEstimateDialog } from "@/components/new-estimate-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { useState } from "react";
import { sortWork, type WorkSort, type SortDirection } from "@shared/work-sort";
import { WorkSortControls } from "@/components/work-sort-controls";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-chart-4/15 text-chart-4",
  approved: "bg-chart-3/15 text-chart-3",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-destructive/15 text-destructive",
  invoiced: "bg-chart-1/15 text-chart-1",
};

export default function Estimates() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{field: WorkSort; direction: SortDirection}>({field:"number", direction:"asc"});
  const [newOpen, setNewOpen] = useState(false);
  const { data: estimates, isLoading } = useQuery({
    queryKey: ["/api/estimates"],
    staleTime: 0, refetchOnWindowFocus: true,
    queryFn: () => apiRequest("GET", "/api/estimates"),
  });

  const createEstimate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/estimates", {
      customerId: 1,
      estimateNumber: `EST-2026-${String((estimates?.length || 0) + 10).padStart(3, "0")}`,
      serviceType: "pdr",
      status: "draft",
      subtotal: 0,
      taxRate: 6,
      taxAmount: 0,
      total: 0,
      notes: "",
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      navigate(`/estimates/${data.id}`);
    },
    onError: (error: any) => {
      console.error("Failed to create estimate:", error);
      alert("Failed to create estimate: " + (error.message || "Unknown error"));
    },
  });

  const filtered = sortWork<any>((estimates || []).filter((e: any) => filter === "all" || e.status === filter), sort.field, sort.direction);
  const statuses = ["all", "draft", "sent", "approved", "invoiced", "rejected", "expired"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Estimates
          </h1>
          <p className="text-sm text-muted-foreground">{estimates?.length || 0} total estimates</p>
        </div>
        <Button data-testid="button-new-estimate" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Estimate
        </Button>
        <NewEstimateDialog open={newOpen} onOpenChange={setNewOpen} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

      <WorkSortControls field={sort.field} direction={sort.direction} count={filtered.length} onChange={(field, direction) => setSort({field, direction})} />
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
          {filtered.map((est: any) => (
            <Link key={est.id} href={`/estimates/${est.id}`} data-testid={`link-estimate-${est.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{est.estimateNumber}</span>
                      <Badge variant="secondary" className={`text-[10px] ${statusColors[est.status] || ""}`}>
                        {est.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {est.notes || "No description"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 break-words">{est.priority || "normal"} urgency · {est.assignedTech || "Unassigned"} · {est.scheduledDate || "Date not planned"}</p>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Created {formatDate(est.createdAt)} • Valid until {formatDate(est.validUntil)}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-base font-bold tabular-nums">{formatCurrency(est.total)}</div>
                    <div className="text-[10px] text-muted-foreground">{est.serviceType.replace(/_/g, " ")}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No estimates found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
