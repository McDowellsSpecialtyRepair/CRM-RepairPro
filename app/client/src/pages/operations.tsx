import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEPARTMENTS,
  HOLD_REASONS,
  departmentFor,
  localToday,
} from "@shared/operations";
import {
  ArrowUpRight,
  RefreshCw,
  CalendarDays,
  ClipboardList,
  Phone,
  AlertTriangle,
} from "lucide-react";
export const cash = (c: number | null | undefined) =>
  c == null
    ? "Not recorded"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(c / 100);
export const selectClass =
  "h-11 w-full rounded-md border bg-background px-3 text-sm min-w-0";
export function SelectField({ label, value, onChange, options }: any) {
  return (
    <label className="block text-sm space-y-1">
      <span>{label}</span>
      <select
        aria-label={label}
        className={selectClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o: any) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Field({
  label,
  value,
  onChange,
  type = "text",
  ...props
}: any) {
  return (
    <label className="block text-sm space-y-1">
      <span>{label}</span>
      <Input
        aria-label={label}
        className="h-11"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
export function Check({ label, value, onChange }: any) {
  return (
    <label className="flex items-start gap-2 text-sm py-2">
      <input
        className="mt-1"
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function Notice({ error, notice }: any) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="border border-destructive/30 rounded-lg p-3 text-destructive text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {notice}
        </p>
      )}
    </>
  );
}
export async function refreshOperations() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/operations"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/estimates"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/capacity"] }),
  ]);
}
const emptyText =
  "Nothing in this queue. Other queues and records needing review may still contain work.";

export default function OperationsDashboard() {
  const { can } = useAuth();
  const [department, setDepartment] = useState(""),
    [tab, setTab] = useState("today"),
    [queue, setQueue] = useState("all"),
    [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useQuery<any>({
    queryKey: ["/api/operations", department],
    refetchOnWindowFocus: true,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/operations?department=${encodeURIComponent(department)}`,
      ),
  });
  const owners = useQuery<any[]>({ queryKey: ["/api/operations/owners"] });
  const d = data.data,
    m = d?.metrics;
  const cards = d
    ? [
        {
          label: "Follow-up due",
          value: m.followupsDue,
          sub: `${m.needsFollowup} need a follow-up date`,
          action: () => {
            setTab("followups");
            setQueue("due");
          },
        },
        {
          label: "Sold, unfinished",
          value: cash(m.remainingCents),
          sub: `Tracked production only · ${d.notTracked.length} need review`,
          action: () => {
            setTab("production");
            setQueue("unfinished");
          },
        },
        {
          label: "Sold, unscheduled",
          value: m.unscheduled,
          sub: "Ready for scheduling review",
          action: () => {
            setTab("production");
            setQueue("unscheduled");
          },
        },
        {
          label: "Work in progress",
          value: m.inProgress,
          sub: "Active production records",
          action: () => {
            setTab("production");
            setQueue("in_progress");
          },
        },
        {
          label: "Blocked / on hold",
          value: m.onHold,
          sub: `${m.overdue} past promised date`,
          action: () => {
            setTab("production");
            setQueue("on_hold");
          },
        },
        {
          label: "Completed, unbilled",
          value: m.completedUnbilled,
          sub: "Finish billing, not more production",
          action: () => {
            setTab("production");
            setQueue("unbilled");
          },
        },
        {
          label: "Billed, unpaid",
          value: cash(m.unpaidCents),
          sub: "Recorded invoice balances",
          action: () => setTab("collections"),
        },
        {
          label: "Untracked approvals",
          value: d.notTracked.length,
          sub: "Excluded from unfinished value",
          action: () => {
            setTab("review");
            setQueue("all");
          },
        },
      ]
    : [];
  const matches = (r: any) =>
    !search ||
    JSON.stringify([
      r.customer,
      r.estimateNumber,
      r.job_number,
      r.assigned_tech,
      r.technicianNames,
      r.technician,
      r.jobNumber,
      r.invoiceNumber,
    ])
      .toLowerCase()
      .includes(search.toLowerCase());
  const production = (d?.cases || [])
    .filter(matches)
    .filter(
      (r: any) =>
        queue === "all" ||
        (queue === "unfinished" && r.stage !== "completed") ||
        queue === r.stage ||
        (queue === "late" && r.late) ||
        (queue === "unbilled" && r.stage === "completed" && !r.invoiceId),
    );
  const open = (d?.open || [])
    .filter(matches)
    .filter((r: any) => queue !== "due" || r.due);
  async function start(e: any) {
    setBusy(true);
    setError("");
    try {
      const c = await apiRequest("POST", "/api/operations/start", {
        estimateId: e.id,
        department: department || departmentFor(e.serviceType || ""),
      });
      await refreshOperations();
      window.location.hash = `/operations/${c.id}`;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            McDowells · Daily operations
          </p>
          <h1 className="text-xl font-bold">Know what needs attention.</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Follow-up, production, capacity and collections. Open a daily
            summary card to see its records.
          </p>
        </div>
        <div className="flex gap-2 items-start">
          <Link href="/scheduling">
            <Button variant="outline">
              <CalendarDays className="h-4 w-4" />
              Capacity calendar
            </Button>
          </Link>
          <Button
            aria-label="Refresh operations"
            variant="outline"
            onClick={() => void data.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <SelectField
          label="Department"
          value={department}
          onChange={setDepartment}
          options={[{ value: "", label: "All departments" }, ...DEPARTMENTS]}
        />
        <Field
          label="Find customer, estimate or technician"
          value={search}
          onChange={setSearch}
        />
        <p className="text-xs text-muted-foreground self-end py-2">
          {d
            ? `As of ${d.today} · Boise time. Current queues, not a monthly sales report.`
            : "Loading current operations…"}
        </p>
      </div>
      <Notice error={error || data.error?.message} />
      {data.isLoading && (
        <div className="rounded-lg border p-6 animate-pulse">
          Loading business records…
        </div>
      )}
      {d && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map((c) => (
              <button
                key={c.label}
                onClick={c.action}
                className="text-left rounded-xl border bg-card p-4 hover:border-primary/60 focus-visible:outline-primary"
              >
                <div className="flex gap-2 justify-between text-sm text-muted-foreground">
                  {c.label}
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </div>
                <div className="text-xl font-bold tabular-nums mt-3">
                  {c.value}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{c.sub}</p>
              </button>
            ))}
          </div>
          {d.notTracked.length > 0 && (
            <div className="flex gap-3 p-4 rounded-lg border border-amber-600/30 bg-amber-500/5 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <strong>Coverage warning:</strong> {d.notTracked.length}{" "}
                authorized or historical records have no verified production
                tracking. Their completion is unknown; the unfinished-work
                amount is not a full-company total.{" "}
                <button className="underline" onClick={() => setTab("review")}>
                  Review records
                </button>
              </div>
            </div>
          )}
          <nav aria-label="Operations views" className="flex flex-wrap gap-2">
            {[
              ["today", "Today"],
              ["followups", "Estimate follow-up"],
              ["production", "Production"],
              ["collections", "Collections"],
              ["performance", "Performance"],
              ["review", "Data review"],
            ].map(([v, l]) => (
              <Button
                key={v}
                variant={tab === v ? "default" : "outline"}
                onClick={() => {
                  setTab(v);
                  setQueue("all");
                }}
              >
                {l}
              </Button>
            ))}
          </nav>
          {tab === "today" && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <h2 className="font-semibold flex gap-2 items-center">
                    <Phone className="h-4 w-4" />
                    Who needs a follow-up?
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Internal reminders only. No messages are sent automatically.
                  </p>
                  {d.open
                    .filter((r: any) => r.due || r.needsFollowup)
                    .filter(matches)
                    .slice(0, 8)
                    .map((r: any) => (
                      <button
                        key={r.id}
                        className="text-left w-full border-t py-3 text-sm flex justify-between gap-3"
                        onClick={() => {
                          setTab("followups");
                          setEditing(r);
                        }}
                      >
                        <span className="min-w-0">
                          <strong>{r.customer}</strong>
                          <span className="block text-xs text-muted-foreground">
                            {r.estimateNumber} ·{" "}
                            {r.followup?.owner || "Unassigned advisor"}
                          </span>
                        </span>
                        <span className="text-xs">
                          {r.followup?.next_date || "Set follow-up"}
                        </span>
                      </button>
                    ))}
                  {!d.open.some((r: any) => r.due || r.needsFollowup) && (
                    <p className="text-sm py-4">{emptyText}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <h2 className="font-semibold flex gap-2 items-center">
                    <ClipboardList className="h-4 w-4" />
                    Production exceptions
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Holds, missed promises and finished work awaiting billing.
                  </p>
                  {d.cases
                    .filter(
                      (r: any) =>
                        r.hold_reason ||
                        r.late ||
                        (r.stage === "completed" && !r.invoiceId),
                    )
                    .filter(matches)
                    .slice(0, 8)
                    .map((r: any) => (
                      <Link
                        key={r.id}
                        href={`/operations/${r.id}`}
                        className="block border-t py-3 text-sm"
                      >
                        <strong>{r.customer}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {r.job_number} ·{" "}
                          {r.hold_reason ||
                            (r.late
                              ? "Past promised date"
                              : "Ready to invoice")}{" "}
                          · {r.department}
                        </span>
                      </Link>
                    ))}
                  {!d.cases.length && (
                    <p className="text-sm py-4">
                      Start production tracking from a reviewed approved
                      estimate.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          {tab === "followups" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Quoted net sales exclude tax. Drafts and undelivered estimates
                are not counted as delivered offers.
              </p>
              {editing && (
                <FollowupEditor
                  key={`${editing.id}-${editing.followup?.version || 0}`}
                  estimate={editing}
                  owners={owners.data || []}
                  onClose={() => setEditing(null)}
                  canEdit={can("operations.write")}
                />
              )}
              {open.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="pt-4 flex flex-wrap justify-between gap-3">
                    <div>
                      <Link
                        className="font-semibold underline text-sm"
                        href={`/estimates/${r.id}`}
                      >
                        {r.estimateNumber} · {r.customer}
                      </Link>
                      <p className="text-sm mt-1">
                        {cash(r.netCents)} · {r.status} · {r.ageDays} days old
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.followup?.owner || "Advisor unassigned"} · Next:{" "}
                        {r.followup?.next_date || "Not scheduled"} ·{" "}
                        {r.followup?.state || "open"}
                        {r.due ? " · DUE" : ""}
                      </p>
                      <p className="text-xs mt-1">{r.followup?.note}</p>
                    </div>
                    <Button variant="outline" onClick={() => setEditing(r)}>
                      {can("operations.write")
                        ? "Manage follow-up"
                        : "View follow-up"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {!open.length && <p>{emptyText}</p>}
            </div>
          )}
          {tab === "production" && (
            <div className="space-y-3">
              <details className="rounded-lg border bg-card p-4">
                <summary className="font-semibold cursor-pointer">
                  Unfinished labor by technician
                </summary>
                <p className="text-sm text-muted-foreground my-3">
                  Each share follows the approved labor split. This is
                  unfinished authorized labor sales, not wages or invoiced labor
                  credits.
                </p>
                {(d.technicianWork || []).filter(matches).length === 0 && (
                  <p className="text-sm">
                    No unfinished allocated labor in this view.
                  </p>
                )}
                {Array.from(
                  new Set<number>(
                    (d.technicianWork || [])
                      .filter(matches)
                      .map((r: any) => r.technicianId),
                  ),
                ).map((id) => {
                  const rows = d.technicianWork.filter(
                    (r: any) => r.technicianId === id && matches(r),
                  );
                  return (
                    <div key={id} className="border-t py-3">
                      <h3 className="font-semibold text-sm">
                        {rows[0].technician} ·{" "}
                        {cash(
                          rows.reduce(
                            (s: number, r: any) => s + r.remainingLaborCents,
                            0,
                          ),
                        )}
                      </h3>
                      {rows.map((r: any, i: number) => (
                        <Link
                          key={i}
                          className="block text-sm underline py-2"
                          href={`/operations/${r.caseId}`}
                        >
                          {r.jobNumber} · {r.customer} · {r.task} ·{" "}
                          {cash(r.remainingLaborCents)}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </details>
              <SelectField
                label="Production queue"
                value={queue}
                onChange={setQueue}
                options={[
                  { value: "all", label: "All tracked production" },
                  { value: "unfinished", label: "Unfinished work" },
                  { value: "unscheduled", label: "Sold, unscheduled" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "in_progress", label: "In progress" },
                  { value: "on_hold", label: "On hold" },
                  { value: "late", label: "Past promised date" },
                  { value: "unbilled", label: "Completed, unbilled" },
                  { value: "completed", label: "Completed" },
                ]}
              />
              {production.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="pt-4 flex flex-wrap gap-4 justify-between">
                    <div>
                      <Link
                        className="font-semibold underline"
                        href={`/operations/${r.id}`}
                      >
                        {r.job_number} · {r.customer}
                      </Link>
                      <Link className="block text-sm underline mt-2" href={`/jobs/${r.job_id}`}>Open work order & assignments</Link>
                      <p className="text-sm mt-1">
                        {r.department} ·{" "}
                        {r.technicianNames ||
                          r.assigned_tech ||
                          "Technician unassigned"}{" "}
                        · {r.stage.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Promise: {r.promised_date || "Not set"} ·{" "}
                        {r.totalTasks - r.incompleteTasks}/{r.totalTasks} tasks
                        complete{r.late ? " · LATE" : ""}
                      </p>
                      {r.hold_reason && (
                        <p className="text-sm mt-1">Hold: {r.hold_reason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{cash(r.remainingCents)}</p>
                      <p className="text-xs text-muted-foreground">
                        unfinished net sales
                      </p>
                      <p className="text-xs mt-1">
                        {r.remainingMinutes == null
                          ? "Remaining time not fully estimated"
                          : `${(r.remainingMinutes / 60).toFixed(1)} estimated hours remaining`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!production.length && <p>{emptyText}</p>}
            </div>
          )}
          {tab === "collections" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Balances are separate from unfinished production. A deposit or
                payment does not mark a task complete.
              </p>
              {d.unpaid.filter(matches).map((r: any) => (
                <Link
                  key={r.id}
                  href={`/invoices/${r.id}`}
                  className="block rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-wrap gap-2 justify-between">
                    <span className="font-semibold">
                      {r.invoiceNumber} · {r.customer}
                    </span>
                    <strong>{cash(Math.round(r.balanceDue * 100))}</strong>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Due {r.dueDate || "not set"} ·{" "}
                    {r.overdue
                      ? "Overdue"
                      : r.status === "sent"
                        ? "Issued"
                        : r.status}
                  </p>
                </Link>
              ))}
            </div>
          )}
          {tab === "performance" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {d.period.label}. Do not use the full-history approval rate as a
                monthly advisor score.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  [
                    "Presented estimate conversion",
                    m.presentedApprovalRate == null
                      ? "Not recorded"
                      : `${m.presentedApprovalRate.toFixed(1)}%`,
                    `${m.presentedCount} estimates with manually recorded presentation dates; full-estimate approvals only`,
                  ],
                  [
                    "Presented value conversion",
                    m.presentedValueRate == null
                      ? "Not recorded"
                      : `${m.presentedValueRate.toFixed(1)}%`,
                    "Approved net quoted value / presented net quoted value; excludes tax",
                  ],
                  [
                    "Measured labor efficiency",
                    m.efficiencyRate == null
                      ? "Not recorded"
                      : `${m.efficiencyRate.toFixed(1)}%`,
                    `${m.efficiencySample}/${m.completedLaborTasks} completed labor items have standard and actual productive time`,
                  ],
                  [
                    "Net invoiced sales",
                    cash(m.netInvoicedCents),
                    "All history; excludes tax, drafts and voids",
                  ],
                  [
                    "Estimate approval rate",
                    m.approvedRate == null
                      ? "Not available"
                      : `${m.approvedRate.toFixed(1)}%`,
                    `${m.approvedCount}/${m.estimateCount} estimates, including drafts`,
                  ],
                  [
                    "On-time completion",
                    m.onTimeRate == null
                      ? "Not recorded"
                      : `${m.onTimeRate.toFixed(1)}%`,
                    `${m.onTimeSample} tracked completions with promise dates`,
                  ],
                  [
                    "Production cycle",
                    m.cycleDays == null
                      ? "Not recorded"
                      : `${m.cycleDays.toFixed(1)} days`,
                    "Enrollment to completion; not keys-to-keys",
                  ],
                  [
                    "Actual productive time",
                    `${(m.productiveMinutes / 60).toFixed(1)} hours`,
                    "Manually logged, not inferred from invoices",
                  ],
                  [
                    "Rework time",
                    `${(m.reworkMinutes / 60).toFixed(1)} hours`,
                    "Only explicitly recorded rework",
                  ],
                  [
                    "Direct contribution",
                    can("costs.read")?cash(m.contributionCents):"Restricted",
                    can("costs.read")?`${m.costSample} completed jobs with costs finalized; not net profit`:"Owner, administrator, manager, accounting or auditor access required",
                  ],
                  [
                    "QC currently failed",
                    m.qcFailures,
                    "Current state; not historical first-time-fix rate",
                  ],
                  [
                    "Materials readiness",
                    m.partsBlocked,
                    "Open cases not confirmed parts/materials-ready",
                  ],
                ].map(([label, value, note]) => (
                  <Card key={String(label)}>
                    <CardContent className="pt-4">
                      <h2 className="text-sm text-muted-foreground">{label}</h2>
                      <p className="text-xl font-bold mt-2">{value}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {note}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <h2 className="font-semibold">
                  Measures that need more source data
                </h2>
                <p>
                  Payroll commissions, utilization against actual attendance,
                  marketing ROI, customer first-response time and historical
                  first-time-fix rates are not guessed. Continue using the
                  dedicated reports for recorded customer sales, technician
                  labor credits and campaign activity.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/reports">
                    <Button variant="outline">Report Studio</Button>
                  </Link>
                  {can("reports.read") && (
                    <Link href="/reports/technician-labor">
                      <Button variant="outline">Technician labor sales</Button>
                    </Link>
                  )}
                  {can("marketing.read") && (
                    <Link href="/marketing">
                      <Button variant="outline">Marketing records</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
          {tab === "review" && (
            <div className="space-y-3">
              <p className="text-sm">
                These records are not included in unfinished-work totals. Start
                tracking only after reviewing the approved lines and assigning
                labor shares; existing historical invoices are preserved.
              </p>
              {d.notTracked.filter(matches).map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="pt-4 flex flex-wrap gap-3 justify-between">
                    <div>
                      <Link
                        href={`/estimates/${r.id}`}
                        className="underline font-semibold"
                      >
                        {r.estimateNumber} · {r.customer}
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">
                        {r.reason} · {cash(r.netCents)}
                      </p>
                    </div>
                    {r.status === "approved" && can("operations.write") && (
                      <Button disabled={busy} onClick={() => void start(r)}>
                        Start production record
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {!d.notTracked.length && <p>No untracked authorized records.</p>}
              <div className="border rounded-lg p-4">
                <h2 className="font-semibold mb-2">Definitions & coverage</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {d.limitations.map((l: string) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function FollowupEditor({ estimate: e, owners, onClose, canEdit }: any) {
  const f = e.followup;
  const [draft, setDraft] = useState({
    version: f?.version || 0,
    ownerId: f?.owner_id || "",
    nextDate: f?.next_date || "",
    state: f?.state || "open",
    reason: f?.reason || "",
    note: f?.note || "",
    contacted: false,
    presentedDate: f?.presented_date || "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Card className="border-primary">
      <CardContent className="pt-5 space-y-3">
        <h2 className="font-semibold">Follow-up · {e.estimateNumber}</h2>
        <Link className="text-sm underline" href={`/estimates/${e.id}`}>Open full estimate & assignments</Link>
        <fieldset
          disabled={!canEdit || busy}
          className="grid sm:grid-cols-2 gap-3"
        >
          <SelectField
            label="Responsible advisor"
            value={draft.ownerId}
            onChange={(v: string) => setDraft({ ...draft, ownerId: v })}
            options={[
              { value: "", label: "Unassigned" },
              ...owners.map((o: any) => ({ value: o.id, label: o.name })),
            ]}
          />
          <Field
            label="Next follow-up date"
            type="date"
            value={draft.nextDate}
            onChange={(v: string) => setDraft({ ...draft, nextDate: v })}
          />
          <SelectField
            label="Follow-up state"
            value={draft.state}
            onChange={(v: string) => setDraft({ ...draft, state: v })}
            options={["open", "deferred", "lost", "closed"]}
          />
          <Field
            label="Reason / outcome"
            value={draft.reason}
            onChange={(v: string) => setDraft({ ...draft, reason: v })}
          />
          <Field
            label="Presented to customer date (optional)"
            type="date"
            value={draft.presentedDate}
            onChange={(v: string) => setDraft({ ...draft, presentedDate: v })}
          />
          <Field
            label="Next action / contact notes"
            value={draft.note}
            onChange={(v: string) => setDraft({ ...draft, note: v })}
          />
          <Check
            label="I actually contacted the customer; record contact now"
            value={draft.contacted}
            onChange={(v: boolean) => setDraft({ ...draft, contacted: v })}
          />
        </fieldset>
        <Notice error={error} />
        <div className="flex gap-2">
          {canEdit && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiRequest("PUT", `/api/operations/followups/${e.id}`, {
                    ...draft,
                    ownerId: draft.ownerId ? Number(draft.ownerId) : null,
                  });
                  await refreshOperations();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save follow-up
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This saves an internal task and contact record. It does not send
          email, text or WhatsApp.
        </p>
      </CardContent>
    </Card>
  );
}
export function ProductionDetail() {
  const [, params] = useRoute("/operations/:id");
  const id = params?.id;
  const data = useQuery<any>({
    queryKey: ["/api/operations", "case", id],
    queryFn: () => apiRequest("GET", `/api/operations/cases/${id}`),
  });
  if (data.isError) return <Notice error={data.error.message} />;
  if (!data.data) return <p>Loading production record…</p>;
  return (
    <ProductionEditor
      key={`${id}-${data.data.version}`}
      record={data.data}
      refresh={() => {
        void data.refetch();
        void refreshOperations();
      }}
    />
  );
}
function ProductionEditor({ record: c, refresh }: any) {
  const { can } = useAuth();
  const edit = can("operations.write");
  const [draft, setDraft] = useState({
    version: c.version,
    department: c.department,
    promisedDate: c.promised_date || "",
    forecastDate: c.forecast_date || "",
    holdReason: c.hold_reason,
    partsReady: !!c.parts_ready,
    qc: c.qc,
    costComplete: !!c.cost_complete,
    notes: c.notes,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const techs = useQuery<any[]>({ queryKey: ["/api/technicians"] });
  const [time, setTime] = useState({
    taskId: String(c.tasks[0]?.id || ""),
    technicianId: String(c.assigned_tech_id || ""),
    workDate: localToday(),
    minutes: "60",
    kind: "productive",
    note: "",
    retryKey: crypto.randomUUID(),
  });
  const [cost, setCost] = useState({
    kind: "parts",
    amount: "",
    note: "",
    retryKey: crypto.randomUUID(),
  });
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
      setNotice("Saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const save = (actionName: string) =>
    action(() =>
      apiRequest("PATCH", `/api/operations/cases/${c.id}`, {
        ...draft,
        action: actionName,
      }),
    );
  const total = c.tasks.reduce((s: number, t: any) => s + t.net_cents, 0),
    remaining = c.tasks
      .filter((t: any) => !t.completed_at)
      .reduce((s: number, t: any) => s + t.net_cents, 0);
  return (
    <div className="space-y-5">
      <Link className="text-sm underline" href="/operations">
        Back to operations
      </Link>
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            <Link className="underline" href={`/jobs/${c.job_id}`}>{c.job_number}</Link> · {c.customer}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {c.department} · {c.status} ·{" "}
            <Link className="underline" href={`/estimates/${c.estimate_id}`}>
              {c.estimateNumber}
            </Link>
          </p>
        </div>
        <div>
          <p className="text-xl font-bold">{cash(remaining)}</p>
          <p className="text-xs text-muted-foreground">
            unfinished of {cash(total)} authorized net sales
          </p>
        </div>
      </header>
      <Notice error={error} notice={notice} />
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-semibold">Production, readiness & promise</h2>
          <fieldset
            disabled={!edit || busy}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <SelectField
              label="Production department"
              value={draft.department}
              onChange={(v: string) => setDraft({ ...draft, department: v })}
              options={DEPARTMENTS}
            />
            <Field
              label="Promised completion date"
              type="date"
              value={draft.promisedDate}
              onChange={(v: string) => setDraft({ ...draft, promisedDate: v })}
            />
            <Field
              label="Forecast completion date"
              type="date"
              value={draft.forecastDate}
              onChange={(v: string) => setDraft({ ...draft, forecastDate: v })}
            />
            <SelectField
              label="Hold reason"
              value={draft.holdReason}
              onChange={(v: string) => setDraft({ ...draft, holdReason: v })}
              options={[
                { value: "", label: "No hold" },
                ...HOLD_REASONS.filter(Boolean),
              ]}
            />
            <SelectField
              label="Quality check"
              value={draft.qc}
              onChange={(v: string) => setDraft({ ...draft, qc: v })}
              options={["pending", "pass", "fail"]}
            />
            <Field
              label="Production notes / hold detail"
              value={draft.notes}
              onChange={(v: string) => setDraft({ ...draft, notes: v })}
            />
            <Check
              label="Parts/materials ready, or no parts needed"
              value={draft.partsReady}
              onChange={(v: boolean) => setDraft({ ...draft, partsReady: v })}
            />
            {can("costs.write")&&<Check
              label="All direct costs recorded and reviewed"
              value={draft.costComplete}
              onChange={(v: boolean) => setDraft({ ...draft, costComplete: v })}
            />}
          </fieldset>
          {edit && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void save("save")}>
                Save production details
              </Button>
              {c.status !== "completed" && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save("start")}
                  >
                    Start work
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save("complete")}
                  >
                    Complete work & QC
                  </Button>
                </>
              )}
              {c.status === "completed" && !c.delivered_at && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void save("deliver")}
                >
                  Mark delivered
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/scheduling">
              <Button variant="outline">Schedule technician</Button>
            </Link>
            {c.invoiceId ? (
              <Link href={`/invoices/${c.invoiceId}`}>
                <Button variant="outline">Open invoice</Button>
              </Link>
            ) : (
              c.status === "completed" &&
              can("billing.write") && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const invoice = await apiRequest(
                        "POST",
                        `/api/estimates/${c.estimate_id}/convert-invoice`,
                        {},
                      );
                      window.location.hash = `/invoices/${invoice.id}`;
                    })
                  }
                >
                  Create invoice
                </Button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Completion requires every priced task finished and QC passed. Labor
            credit splits were frozen at production enrollment; refunds,
            cancellation and repricing require a separate adjustment workflow.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <h2 className="font-semibold">Authorized work items</h2>
          {(c.laborAssignments || []).map((a: any) => (
            <p
              key={`${a.task_id}-${a.technician_id}`}
              className="text-sm text-muted-foreground"
            >
              {a.description}: {a.name} · {(a.share_bps / 100).toFixed(1)}% of
              net labor
            </p>
          ))}
          <p className="text-sm text-muted-foreground">
            Mark completion only when the full priced item is done. Remaining
            value is not an estimated percentage; split large jobs into separate
            priced items before enrollment.
          </p>
          {c.tasks.map((t: any) => (
            <TaskEditor
              key={`${t.id}-${t.version}`}
              task={t}
              disabled={!edit || c.status === "completed"}
              refresh={refresh}
            />
          ))}
        </CardContent>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-semibold">Actual technician time</h2>
            <p className="text-xs text-muted-foreground">
              Manual work evidence, not a time clock or payroll approval.
              Entries cannot be silently edited or deleted.
            </p>
            {edit && (
              <fieldset disabled={busy} className="space-y-3">
                <SelectField
                  label="Time entry task"
                  value={time.taskId}
                  onChange={(v: string) => setTime({ ...time, taskId: v })}
                  options={c.tasks.map((t: any) => ({
                    value: t.id,
                    label: t.description,
                  }))}
                />
                <SelectField
                  label="Time entry technician"
                  value={time.technicianId}
                  onChange={(v: string) =>
                    setTime({ ...time, technicianId: v })
                  }
                  options={[
                    { value: "", label: "Choose technician" },
                    ...(techs.data || [])
                      .filter((t) => t.status === "active")
                      .map((t) => ({ value: t.id, label: t.name })),
                  ]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Work date"
                    type="date"
                    value={time.workDate}
                    onChange={(v: string) => setTime({ ...time, workDate: v })}
                  />
                  <Field
                    label="Actual minutes"
                    type="number"
                    min="1"
                    max="1440"
                    value={time.minutes}
                    onChange={(v: string) => setTime({ ...time, minutes: v })}
                  />
                </div>
                <SelectField
                  label="Time category"
                  value={time.kind}
                  onChange={(v: string) => setTime({ ...time, kind: v })}
                  options={["productive", "rework", "travel"]}
                />
                <Field
                  label="Time entry note"
                  value={time.note}
                  onChange={(v: string) => setTime({ ...time, note: v })}
                />
                <Button
                  onClick={() =>
                    void action(async () => {
                      await apiRequest("POST", "/api/operations/time", {
                        ...time,
                        taskId: Number(time.taskId),
                        technicianId: Number(time.technicianId),
                        minutes: Number(time.minutes),
                      });
                      setTime({
                        ...time,
                        note: "",
                        retryKey: crypto.randomUUID(),
                      });
                    })
                  }
                >
                  Record actual time
                </Button>
              </fieldset>
            )}
            {c.time.map((t: any) => (
              <div key={t.id} className="border-t pt-2 text-sm">
                {t.technician} · {t.minutes} min · {t.kind}
                <p className="text-xs text-muted-foreground">
                  {t.work_date} · {t.note}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-semibold">Direct job costs</h2>
            {!can("costs.read")&&<p className="text-sm">Your role cannot view compensation or other direct costs.</p>}
            <p className="text-xs text-muted-foreground">
              Record actual parts cost, technician compensation and subcontract
              cost. Contribution appears only after completion and cost review;
              it is not net profit.
            </p>
            {can("costs.write") && !c.cost_complete && (
              <fieldset disabled={busy} className="space-y-3">
                <SelectField
                  label="Cost category"
                  value={cost.kind}
                  onChange={(v: string) => setCost({ ...cost, kind: v })}
                  options={["parts", "technician_pay", "subcontract", "other"]}
                />
                <Field
                  label="Cost amount ($)"
                  type="number"
                  min=".01"
                  step=".01"
                  value={cost.amount}
                  onChange={(v: string) => setCost({ ...cost, amount: v })}
                />
                <Field
                  label="Cost description / reference"
                  value={cost.note}
                  onChange={(v: string) => setCost({ ...cost, note: v })}
                />
                <Button
                  onClick={() =>
                    void action(async () => {
                      await apiRequest("POST", "/api/operations/costs", {
                        caseId: c.id,
                        kind: cost.kind,
                        amountCents: Math.round(Number(cost.amount) * 100),
                        note: cost.note,
                        retryKey: cost.retryKey,
                      });
                      setCost({
                        ...cost,
                        amount: "",
                        note: "",
                        retryKey: crypto.randomUUID(),
                      });
                    })
                  }
                >
                  Record actual cost
                </Button>
              </fieldset>
            )}
            {c.costs.map((r: any) => (
              <div key={r.id} className="border-t pt-2 text-sm">
                {r.kind.replace("_", " ")} · {cash(r.amount_cents)}
                <p className="text-xs text-muted-foreground">{r.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function TaskEditor({ task: t, disabled, refresh }: any) {
  const [minutes, setMinutes] = useState(t.estimated_minutes ?? ""),
    [standard, setStandard] = useState(t.standard_minutes ?? ""),
    [done, setDone] = useState(!!t.completed_at),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <fieldset
      disabled={disabled || busy}
      className="border rounded-lg p-4 space-y-3"
    >
      <div className="flex flex-wrap gap-2 justify-between">
        <div>
          <h3 className="font-medium">{t.description}</h3>
          <p className="text-xs text-muted-foreground">
            {t.line_type} · {cash(t.net_cents)} · {t.actual_minutes} actual
            productive min logged
          </p>
        </div>
        <span className="text-xs">
          {t.completed_at ? "Completed" : "Unfinished"}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label={`Estimated minutes: ${t.description}`}
          type="number"
          min="0"
          value={minutes}
          onChange={setMinutes}
        />
        {t.line_type === "labor" && (
          <Field
            label={`Standard labor minutes: ${t.description}`}
            type="number"
            min="0"
            value={standard}
            onChange={setStandard}
          />
        )}
      </div>
      <Check
        label={`Entire priced item completed: ${t.description}`}
        value={done}
        onChange={setDone}
      />
      <Notice error={error} />
      {!disabled && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await apiRequest("PATCH", `/api/operations/tasks/${t.id}`, {
                version: t.version,
                estimatedMinutes: minutes === "" ? null : Number(minutes),
                standardMinutes: standard === "" ? null : Number(standard),
                completed: done,
              });
              refresh();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save work item
        </Button>
      )}
    </fieldset>
  );
}
