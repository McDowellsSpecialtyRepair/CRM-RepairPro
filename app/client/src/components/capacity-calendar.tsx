import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import {
  DEPARTMENTS,
  localToday,
  addDays,
  timeMinutes,
} from "@shared/operations";
import {
  Field,
  SelectField,
  Check,
  Notice,
  refreshOperations,
} from "@/pages/operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export default function CapacityCalendar() {
  const { can } = useAuth();
  const [from, setFrom] = useState(localToday()),
    [minutes, setMinutes] = useState("60"),
    [department, setDepartment] = useState(""),
    [resource, setResource] = useState("");
  const [profile, setProfile] = useState<any>(null),
    [booking, setBooking] = useState<any>(null),
    [leave, setLeave] = useState<any>(null),
    [newResource, setNewResource] = useState({
      name: "",
      department: DEPARTMENTS[0] as string,
    });
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useQuery<any>({
    queryKey: ["/api/capacity", from, minutes, department, resource],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/capacity?${new URLSearchParams({ from, minutes, department, ...(resource ? { resourceId: resource } : {}) })}`,
      ),
    enabled: !!from && Number(minutes) >= 15 && Number(minutes) <= 720,
  });
  const jobs = useQuery<any[]>({ queryKey: ["/api/jobs"] });
  const d = data.data;
  const dates = Array.from({ length: 7 }, (_, i) =>
    addDays(from || localToday(), i),
  );
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/schedule-slots"] });
    await refreshOperations();
  };
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
      setNotice("Saved. Availability recalculated.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          McDowells · Capacity
        </p>
        <h1 className="text-xl font-bold mt-1 flex gap-2 items-center">
          <CalendarDays className="h-6 w-6" />
          Department & technician calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Next fitting opening for the requested duration, using confirmed
          hours, appointments and leave. All times are Boise local time.
        </p>
      </header>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SelectField
          label="Calendar department"
          value={department}
          onChange={setDepartment}
          options={[{ value: "", label: "All departments" }, ...DEPARTMENTS]}
        />
        <Field
          label="Search from date"
          type="date"
          value={from}
          onChange={setFrom}
        />
        <Field
          label="Required appointment minutes"
          type="number"
          min="15"
          max="720"
          step="15"
          value={minutes}
          onChange={setMinutes}
        />
        <SelectField
          label="Shared bay / equipment"
          value={resource}
          onChange={setResource}
          options={[
            { value: "", label: "No shared resource selected" },
            ...(d?.resources || []).map((r: any) => ({
              value: r.id,
              label: `${r.name} · ${r.department}`,
            })),
          ]}
        />
      </div>
      <Notice error={error || data.error?.message} notice={notice} />
      {(Number(minutes) < 15 || Number(minutes) > 720) && (
        <p role="alert">Enter a duration from 15 to 720 minutes.</p>
      )}
      {d && (
        <>
          <div className="rounded-lg border bg-card p-4 text-sm">
            {d.note}{" "}
            <strong>
              No openings are promised for unconfirmed working hours.
            </strong>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {d.technicians.map((t: any) => (
              <Card key={t.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <h2 className="font-semibold">{t.name}</h2>
                    <span className="text-xs text-muted-foreground">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.profile.department || "Department not assigned"} ·{" "}
                    {t.technicianType === "mobile" ? "Mobile" : "In-shop"}
                  </p>
                  <p className="text-sm">
                    {t.next ? (
                      <>
                        <strong>{t.next.date}</strong> · {t.next.startTime}–
                        {t.next.endTime}
                      </>
                    ) : (
                      t.reason
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Skills:{" "}
                    {t.skillAreas.replace(/_/g, " ").replace(/,/g, ", ")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {t.next && can("schedule.write") && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setBooking({
                            technician: t,
                            jobId: "",
                            ...t.next,
                            resourceId: resource,
                            readinessConfirmed: false,
                            retryKey: crypto.randomUUID(),
                          })
                        }
                      >
                        Reserve opening <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                    {can("settings.manage") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setProfile(t)}
                      >
                        Working hours
                      </Button>
                    )}
                    {can("schedule.write") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setLeave({
                            technicianId: t.id,
                            name: t.name,
                            date: from,
                            startTime: "08:00",
                            endTime: "17:00",
                            reason: "",
                          })
                        }
                      >
                        Add leave
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {profile && (
            <ProfileEditor
              key={`${profile.id}-${profile.profile.version}`}
              technician={profile}
              close={() => setProfile(null)}
              refresh={refresh}
            />
          )}
          {booking && (
            <Card className="border-primary">
              <CardContent className="pt-5 space-y-3">
                <h2 className="font-semibold">
                  Reserve {booking.technician.name} · {booking.date}{" "}
                  {booking.startTime}–{booking.endTime}
                </h2>
                <p className="text-sm text-muted-foreground">
                  The server checks this opening again when you save.
                  Parts-ready and hold checks apply to tracked production.
                </p>
                <SelectField
                  label="Work order to schedule"
                  value={booking.jobId}
                  onChange={(v: string) => setBooking({ ...booking, jobId: v })}
                  options={[
                    { value: "", label: "Choose open work order" },
                    ...(jobs.data || [])
                      .filter(
                        (j) => !["completed", "cancelled"].includes(j.status),
                      )
                      .map((j) => ({
                        value: j.id,
                        label: `${j.jobNumber} · ${j.title}`,
                      })),
                  ]}
                />
                <Check
                  label="I verified technician skills, customer authorization and parts/material readiness"
                  value={booking.readinessConfirmed}
                  onChange={(v: boolean) =>
                    setBooking({ ...booking, readinessConfirmed: v })
                  }
                />
                <Notice error={error} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      busy || !booking.jobId || !booking.readinessConfirmed
                    }
                    onClick={() =>
                      void action(async () => {
                        await apiRequest("POST", "/api/capacity/reserve", {
                          technicianId: booking.technician.id,
                          jobId: Number(booking.jobId),
                          date: booking.date,
                          startTime: booking.startTime,
                          endTime: booking.endTime,
                          resourceId: booking.resourceId
                            ? Number(booking.resourceId)
                            : null,
                          readinessConfirmed: booking.readinessConfirmed,
                          retryKey: booking.retryKey,
                        });
                        setBooking(null);
                      })
                    }
                  >
                    Confirm reservation
                  </Button>
                  <Button variant="outline" onClick={() => setBooking(null)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {leave && (
            <Card className="border-primary">
              <CardContent className="pt-5 space-y-3">
                <h2 className="font-semibold">
                  Unavailable time · {leave.name}
                </h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field
                    label="Leave date"
                    type="date"
                    value={leave.date}
                    onChange={(v: string) => setLeave({ ...leave, date: v })}
                  />
                  <Field
                    label="Leave start"
                    type="time"
                    value={leave.startTime}
                    onChange={(v: string) =>
                      setLeave({ ...leave, startTime: v })
                    }
                  />
                  <Field
                    label="Leave end"
                    type="time"
                    value={leave.endTime}
                    onChange={(v: string) => setLeave({ ...leave, endTime: v })}
                  />
                </div>
                <Field
                  label="Leave / closure reason"
                  value={leave.reason}
                  onChange={(v: string) => setLeave({ ...leave, reason: v })}
                />
                <Notice error={error} />
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const { name, ...payload } = leave;
                        await apiRequest(
                          "POST",
                          "/api/capacity/absences",
                          payload,
                        );
                        setLeave(null);
                      })
                    }
                  >
                    Save unavailable time
                  </Button>
                  <Button variant="outline" onClick={() => setLeave(null)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Seven-day department board</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                aria-label="Previous seven days"
                onClick={() => setFrom(addDays(from, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setFrom(localToday())}>
                Today
              </Button>
              <Button
                variant="outline"
                aria-label="Next seven days"
                onClick={() => setFrom(addDays(from, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Scroll horizontally on a phone. Calendar rows are grouped by
            department; openings above are sorted by earliest available time.
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[1060px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 w-44">Technician</th>
                  {dates.map((date) => (
                    <th key={date} className="p-3 text-left min-w-32">
                      {new Date(date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...DEPARTMENTS, "Unassigned"].map((dep) =>
                  d.technicians
                    .filter(
                      (t: any) =>
                        (t.profile.department || "Unassigned") === dep,
                    )
                    .map((t: any, i: number) => (
                      <CalendarRow
                        key={t.id}
                        technician={t}
                        department={dep}
                        first={i === 0}
                        dates={dates}
                        data={d}
                        jobs={jobs.data || []}
                        canEdit={can("schedule.write")}
                        action={action}
                      />
                    )),
                )}
              </tbody>
            </table>
          </div>
          {can("settings.manage") && (
            <details className="rounded-lg border p-4">
              <summary className="font-semibold cursor-pointer">
                Register a shared bay or piece of equipment
              </summary>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <Field
                  label="Resource name"
                  value={newResource.name}
                  onChange={(v: string) =>
                    setNewResource({ ...newResource, name: v })
                  }
                />
                <SelectField
                  label="Resource department"
                  value={newResource.department}
                  onChange={(v: string) =>
                    setNewResource({ ...newResource, department: v })
                  }
                  options={DEPARTMENTS}
                />
                <Button
                  className="self-end h-11"
                  disabled={busy || !newResource.name.trim()}
                  onClick={() =>
                    void action(async () => {
                      await apiRequest(
                        "POST",
                        "/api/capacity/resources",
                        newResource,
                      );
                      setNewResource({ ...newResource, name: "" });
                    })
                  }
                >
                  Add resource
                </Button>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
function CalendarRow({
  technician: t,
  department,
  first,
  dates,
  data,
  jobs,
  canEdit,
  action,
}: any) {
  return (
    <>
      {first && (
        <tr>
          <th
            colSpan={8}
            className="bg-muted/50 text-left px-3 py-2 text-xs uppercase tracking-wider"
          >
            {department}
          </th>
        </tr>
      )}
      <tr className="border-t align-top">
        <th className="text-left font-medium p-3">
          {t.name}
          <p className="text-xs text-muted-foreground font-normal mt-1">
            {t.profile.confirmed ? "Confirmed hours" : "Hours not confirmed"}
          </p>
        </th>
        {dates.map((date: string) => {
          const slots = data.slots.filter(
              (s: any) => s.technicianId === t.id && s.date === date,
            ),
            absence = data.absences.filter(
              (s: any) => s.technician_id === t.id && s.date === date,
            );
          const wd = new Date(date + "T12:00:00Z").getUTCDay(),
            windows = t.profile.windows.filter((w: any) => w.day === wd),
            capacity = windows.reduce(
              (sum: number, w: any) =>
                sum + timeMinutes(w.end) - timeMinutes(w.start),
              0,
            );
          const unavailable = absence.reduce(
            (sum: number, l: any) =>
              sum +
              windows.reduce(
                (n: number, w: any) =>
                  n +
                  Math.max(
                    0,
                    Math.min(timeMinutes(l.end_time), timeMinutes(w.end)) -
                      Math.max(timeMinutes(l.start_time), timeMinutes(w.start)),
                  ),
                0,
              ),
            0,
          );
          const booked = slots
            .filter((s: any) => s.status !== "cancelled")
            .reduce(
              (sum: number, s: any) =>
                sum + timeMinutes(s.endTime) - timeMinutes(s.startTime),
              0,
            );
          return (
            <td key={date} className="border-l p-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {(booked / 60).toFixed(1)}h booked /{" "}
                {t.profile.confirmed
                  ? `${(Math.max(0, capacity - unavailable) / 60).toFixed(1)}h capacity`
                  : "unconfirmed"}
              </p>
              {slots.map((s: any) => (
                <div
                  key={s.id}
                  className={`border rounded p-2 text-xs ${s.status === "cancelled" ? "opacity-50" : "bg-primary/5 border-primary/20"}`}
                >
                  <strong>
                    {s.startTime}–{s.endTime}
                  </strong>
                  <p className="mt-1">
                    {s.jobId ? <Link href={`/jobs/${s.jobId}`} className="underline">{jobs.find((j: any) => j.id === s.jobId)?.jobNumber || "Open work order"}</Link> : s.slotType}
                  </p>
                  <p>{s.status.replace("_", " ")}</p>
                  {canEdit &&
                    !["cancelled", "completed"].includes(s.status) && (
                      <button
                        className="underline mt-2"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Cancel ${s.startTime}–${s.endTime} on ${s.date}? This releases the reservation.`,
                            )
                          )
                            void action(() =>
                              apiRequest(
                                "PATCH",
                                `/api/schedule-slots/${s.id}`,
                                { status: "cancelled" },
                              ),
                            );
                        }}
                      >
                        Cancel reservation
                      </button>
                    )}
                </div>
              ))}
              {absence.map((a: any) => (
                <div key={a.id} className="border rounded p-2 bg-muted text-xs">
                  <strong>
                    Unavailable {a.start_time}–{a.end_time}
                  </strong>
                  <p>{a.reason}</p>
                  {canEdit && (
                    <button
                      className="underline mt-1"
                      onClick={() => {
                        if (
                          window.confirm("Remove this unavailable-time block?")
                        )
                          void action(() =>
                            apiRequest(
                              "DELETE",
                              `/api/capacity/absences/${a.id}`,
                            ),
                          );
                      }}
                    >
                      Remove block
                    </button>
                  )}
                </div>
              ))}
            </td>
          );
        })}
      </tr>
    </>
  );
}
function ProfileEditor({ technician: t, close, refresh }: any) {
  const [department, setDepartment] = useState(
      t.profile.department || DEPARTMENTS[0],
    ),
    [windows, setWindows] = useState<any[]>(t.profile.windows),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Card className="border-primary">
      <CardContent className="pt-5 space-y-4">
        <h2 className="font-semibold">Working hours · {t.name}</h2>
        <p className="text-sm text-muted-foreground">
          These are local Boise times. Review the suggested weekday template;
          leave days with no windows closed. Existing appointments must fit
          before changes can be saved.
        </p>
        <SelectField
          label="Technician department"
          value={department}
          onChange={setDepartment}
          options={DEPARTMENTS}
        />
        {windows.map((w, i) => (
          <div
            key={i}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end"
          >
            <SelectField
              label={`Window ${i + 1} day`}
              value={String(w.day)}
              onChange={(v: string) =>
                setWindows(
                  windows.map((a, j) =>
                    i === j ? { ...a, day: Number(v) } : a,
                  ),
                )
              }
              options={days.map((day, i) => ({ value: i, label: day }))}
            />
            <Field
              label={`Window ${i + 1} start`}
              type="time"
              value={w.start}
              onChange={(v: string) =>
                setWindows(
                  windows.map((a, j) => (i === j ? { ...a, start: v } : a)),
                )
              }
            />
            <Field
              label={`Window ${i + 1} end`}
              type="time"
              value={w.end}
              onChange={(v: string) =>
                setWindows(
                  windows.map((a, j) => (i === j ? { ...a, end: v } : a)),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() => setWindows(windows.filter((_, j) => j !== i))}
            >
              Remove window
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setWindows([...windows, { day: 1, start: "08:00", end: "17:00" }])
            }
          >
            Add working window
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setWindows(
                [1, 2, 3, 4, 5].flatMap((day) => [
                  { day, start: "08:00", end: "12:00" },
                  { day, start: "13:00", end: "17:00" },
                ]),
              )
            }
          >
            Weekday template
          </Button>
          <Button variant="outline" onClick={() => setWindows([])}>
            Clear all hours
          </Button>
        </div>
        <Check
          label="I reviewed these hours and department; use them for availability"
          value={confirmed}
          onChange={setConfirmed}
        />
        <Notice error={error} />
        <div className="flex gap-2">
          <Button
            disabled={!confirmed || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await apiRequest("PUT", `/api/capacity/profiles/${t.id}`, {
                  version: t.profile.version,
                  department,
                  windows,
                  confirmed: true,
                });
                await refresh();
                close();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save confirmed hours
          </Button>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
