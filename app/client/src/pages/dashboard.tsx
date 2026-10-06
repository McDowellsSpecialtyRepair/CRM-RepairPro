import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wrench, FileText, DollarSign, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import { Link } from "wouter";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export {default} from "./operations";
export function LegacyDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiRequest("GET", "/api/dashboard"),
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs"),
  });

  const { data: activities } = useQuery({
    queryKey: ["/api/activities"],
    queryFn: () => apiRequest("GET", "/api/activities"),
  });

  const { data: estimates } = useQuery({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates"),
  });

  const { data: bookings } = useQuery({
    queryKey: ["/api/bookings"],
    queryFn: () => apiRequest("GET", "/api/bookings"),
  });

  const kpiCards = [
    { label: "Total Customers", value: stats?.totalCustomers || 0, icon: Users, color: "text-primary" },
    { label: "Active Jobs", value: stats?.activeJobs || 0, icon: Wrench, color: "text-accent" },
    { label: "Pending Estimates", value: stats?.pendingEstimates || 0, icon: FileText, color: "text-chart-3" },
    { label: "Outstanding Invoices", value: stats?.outstandingInvoices || 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Monthly Revenue", value: formatCurrency(stats?.monthlyRevenue), icon: DollarSign, color: "text-chart-2" },
    { label: "Unpaid Balance", value: formatCurrency(stats?.unpaidBalance), icon: TrendingUp, color: "text-chart-4" },
    { label: "Completed Jobs", value: (jobs || []).filter((j: any) => j.status === "completed").length, icon: Wrench, color: "text-chart-1" },
    { label: "Booking Requests", value: (bookings || []).filter((b: any) => b.status === "pending").length, icon: Calendar, color: "text-chart-4" },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    scheduled: "bg-chart-4/15 text-chart-4",
    in_progress: "bg-chart-1/15 text-chart-1",
    completed: "bg-chart-3/15 text-chart-3",
    cancelled: "bg-destructive/15 text-destructive",
  };

  const recentJobs = jobs?.slice(-5).reverse() || [];
  const recentActivities = activities?.slice(-8).reverse() || [];
  const pendingEstimates = estimates?.filter((e: any) => e.status === "draft" || e.status === "sent").slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Overview of your repair business operations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-3 w-20 rounded bg-muted"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-7 w-16 rounded bg-muted"></div>
                </CardContent>
              </Card>
            ))
          : kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
                      <Icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold tabular-nums" data-testid={`text-${kpi.label.toLowerCase().replace(/\s/g, "-")}`}>
                      {kpi.value}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Jobs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Jobs</CardTitle>
            <Link href="/jobs" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentJobs.map((job: any) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{job.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {job.jobNumber} • {job.assignedTech || "Unassigned"}
                    </div>
                  </div>
                  <Badge variant="secondary" className={`ml-2 ${statusColors[job.status] || ""}`} data-testid={`badge-job-status-${job.id}`}>
                    {job.status.replace("_", " ")}
                  </Badge>
                </Link>
              ))}
              {recentJobs.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No jobs yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {recentActivities.map((act: any) => (
                <div key={act.id} className="flex gap-3" data-testid={`div-activity-${act.id}`}>
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed">{act.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {act.performedBy} • {formatDate(act.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No activity yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Estimates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Pending Estimates</CardTitle>
          <Link href="/estimates" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {pendingEstimates.map((est: any) => (
              <Link
                key={est.id}
                href={`/estimates/${est.id}`}
                className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors"
                data-testid={`link-estimate-${est.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{est.estimateNumber}</span>
                  <Badge variant={est.status === "sent" ? "default" : "secondary"} className="text-[10px]">
                    {est.status}
                  </Badge>
                </div>
                <div className="text-sm font-medium truncate">{est.notes || "No description"}</div>
                <div className="text-lg font-bold tabular-nums mt-1">{formatCurrency(est.total)}</div>
              </Link>
            ))}
            {pendingEstimates.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">No pending estimates</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Booking Requests */}
      {(bookings || []).filter((b: any) => b.status === "pending").length > 0 && (
        <Card className="border-chart-4/30 bg-chart-4/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-chart-4" />
              New Booking Requests
            </CardTitle>
            <Link href="/scheduling" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {(bookings || []).filter((b: any) => b.status === "pending").map((b: any) => (
                <Link key={b.id} href="/scheduling" className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{b.bookingNumber}</span>
                    <Badge variant="secondary" className="text-[10px] bg-chart-4/15 text-chart-4">{b.status}</Badge>
                  </div>
                  <div className="text-sm font-medium truncate">{b.customerName}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{b.description}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Pref: {formatDate(b.preferredDate)} {b.preferredTime}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
