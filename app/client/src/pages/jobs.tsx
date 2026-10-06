import { NewEstimateDialog } from "@/components/new-estimate-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Wrench, Calendar, User, ChevronDown, CheckCircle2, MoreVertical } from "lucide-react";
import { useState } from "react";
import { sortWork, type WorkSort, type SortDirection } from "@shared/work-sort";
import { WorkSortControls } from "@/components/work-sort-controls";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { formatCalendarDate } from "@shared/calendar-date";

const formatDate = (s: string) => {
  if (!s) return "";
  return formatCalendarDate(s);
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-chart-4/15 text-chart-4",
  in_progress: "bg-chart-1/15 text-chart-1",
  completed: "bg-chart-3/15 text-chart-3",
  cancelled: "bg-destructive/15 text-destructive",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-chart-4",
  urgent: "text-destructive",
};

const serviceLabels: Record<string, string> = {
  pdr: "PDR",
  hail: "Hail Repair",
  window_tint: "Window Tint",
  interior_repair: "Auto Interior Repair",
  rv_interior: "RV Interior Repair",
  rv_upholstery: "RV Upholstery",
  marine_interior: "Marine Interior Repair",
  marine_upholstery: "Marine Upholstery",
  upholstery: "Furniture Upholstery",
};

const statusFlow = ["pending", "scheduled", "in_progress", "completed"];

export default function Jobs() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{field: WorkSort; direction: SortDirection}>({field:"number", direction:"asc"});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdJob, setCreatedJob] = useState(false);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    staleTime: 0, refetchOnWindowFocus: true,
    queryFn: () => apiRequest("GET", "/api/jobs"),
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const updateJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const createJob = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setCreatedJob(true);
      setTimeout(() => {
        setDialogOpen(false);
        setCreatedJob(false);
      }, 1000);
    },
  });

  const [form, setForm] = useState({
    customerId: "",
    serviceType: "pdr",
    title: "",
    description: "",
    priority: "normal",
    assignedTech: "",
    scheduledDate: "",
  });

  const handleSubmit = () => {
    const jobNumber = `JOB-2026-${String((jobs?.length || 0) + 10).padStart(3, "0")}`;
    createJob.mutate({
      ...form,
      jobNumber,
      customerId: parseInt(form.customerId) || 1,
      status: "pending",
    });
  };

  const handleStatusChange = (jobId: number, newStatus: string) => {
    const data: any = { status: newStatus };
    updateJob.mutate({ id: jobId, data });
  };

  const filtered = sortWork<any>((jobs || []).filter((j: any) => filter === "all" || j.status === filter), sort.field, sort.direction);
  const statuses = ["all", "pending", "scheduled", "in_progress", "completed", "cancelled"];

  const customerName = (id: number) => {
    const c = (customers || []).find((c: any) => c.id === id);
    return c ? (c.companyName || `${c.firstName} ${c.lastName}`) : "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Jobs
          </h1>
          <p className="text-sm text-muted-foreground">{jobs?.length || 0} total jobs</p>
        </div>
        {can("jobs.write") && <Button onClick={() => setDialogOpen(true)} data-testid="button-new-job">
          <Plus className="h-4 w-4 mr-1" /> New Work Order
        </Button>}
        <NewEstimateDialog open={dialogOpen} onOpenChange={setDialogOpen} mode="workorder" />
      </div>

      {updateJob.error && <p role="alert" className="text-sm text-destructive">{updateJob.error.message}</p>}
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
            {s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          </button>
        ))}
      </div>

      <WorkSortControls field={sort.field} direction={sort.direction} count={filtered.length} onChange={(field, direction) => setSort({field, direction})} />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-32 rounded bg-muted mb-2"></div>
                <div className="h-3 w-24 rounded bg-muted"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job: any) => (
            <Card key={job.id} className="relative hover:shadow-md hover:border-primary/50 transition-shadow" data-testid={`card-job-${job.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Link href={`/jobs/${job.id}`} className="min-w-0 after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid={`link-job-${job.id}`}>
                    <div className="text-xs text-muted-foreground">{job.jobNumber}</div>
                    <div className="text-sm font-medium truncate">{job.title}</div>
                    {job.customerId && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{customerName(job.customerId)}</div>
                    )}
                    <span className="text-xs text-primary underline block mt-1">Open work order</span>
                  </Link>
                  {can("jobs.write") && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label={`Change status for ${job.jobNumber}`} className="relative z-10 text-muted-foreground hover:text-foreground shrink-0 ml-2 p-2" data-testid={`button-status-menu-${job.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Change Status</div>
                      <DropdownMenuSeparator />
                      {statusFlow.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => handleStatusChange(job.id, s)}
                          className={job.status === s ? "bg-muted" : ""}
                          data-testid={`button-status-${job.id}-${s}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusColors[s]?.split(" ")[0] || "bg-muted"}`} />
                          {s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          {job.status === s && <CheckCircle2 className="h-3 w-3 ml-auto text-chart-3" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(job.id, "cancelled")}
                        className="text-destructive"
                      >
                        Cancel Job
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {serviceLabels[job.serviceType] || job.serviceType}
                  </Badge>
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[job.status] || ""}`} data-testid={`badge-job-status-${job.id}`}>
                    {job.status.replace(/_/g, " ")}
                  </Badge>
                  {job.assignedTech && (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{job.assignedTech}</span>
                  )}
                  {job.scheduledDate && (
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(job.scheduledDate)}</span>
                  )}
                  <span className={priorityColors[job.priority] || ""}>{job.priority}</span>
                </div>
                {job.insuranceClaim && (
                  <div className="mt-2 rounded-md bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
                    Insurance: {job.insuranceClaim} • {job.insuranceAdjuster}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No jobs found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
