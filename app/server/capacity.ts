import type { Express } from "express";
import { sqlite } from "./storage-db";
import { storage } from "./storage";
import { fail } from "./billing";
import { validDate, integer } from "./operations";
import {
  DEPARTMENTS,
  localToday,
  addDays,
  timeMinutes,
  minuteString,
} from "../shared/operations";
const all = (sql: string, ...p: any[]) =>
  sqlite.prepare(sql).all(...p) as any[];
const one = (sql: string, ...p: any[]) => sqlite.prepare(sql).get(...p) as any;
const run = (sql: string, ...p: any[]) => sqlite.prepare(sql).run(...p);
const defaults = [1, 2, 3, 4, 5].flatMap((day) => [
  { day, start: "08:00", end: "12:00" },
  { day, start: "13:00", end: "17:00" },
]);
function clock(s: any) {
  if (typeof s !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    fail("Time must be HH:MM in shop local time.");
  return timeMinutes(s);
}
function interval(start: any, end: any) {
  const s = clock(start),
    e = clock(end);
  if (e <= s) fail("End time must be after start time, on the same day.");
  return [s, e];
}
const overlap = (s: number, e: number, a: number, b: number) => s < b && e > a;
export function migrateCapacity() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ops_profiles (
      id INTEGER PRIMARY KEY,technician_id INTEGER NOT NULL UNIQUE REFERENCES technicians(id),
      department TEXT NOT NULL,windows TEXT NOT NULL CHECK(json_valid(windows)),confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN(0,1)),
      version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS ops_absences (
      id INTEGER PRIMARY KEY,technician_id INTEGER NOT NULL REFERENCES technicians(id),
      date TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,reason TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ops_resources (
      id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,department TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ops_reservations (
      id INTEGER PRIMARY KEY,slot_id INTEGER NOT NULL UNIQUE REFERENCES schedule_slots(id) ON DELETE CASCADE,
      resource_id INTEGER REFERENCES ops_resources(id),retry_key TEXT NOT NULL UNIQUE,
      request_json TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS ops_slot_overlap_insert BEFORE INSERT ON schedule_slots WHEN NEW.status!='cancelled' AND NEW.technician_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM schedule_slots s WHERE s.technician_id=NEW.technician_id AND s.date=NEW.date AND s.status!='cancelled' AND NEW.start_time<s.end_time AND NEW.end_time>s.start_time)
      BEGIN SELECT RAISE(ABORT,'Technician already booked in this time interval'); END;
    CREATE TRIGGER IF NOT EXISTS ops_slot_overlap_update BEFORE UPDATE OF technician_id,date,start_time,end_time,status ON schedule_slots WHEN NEW.status!='cancelled' AND NEW.technician_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM schedule_slots s WHERE s.id!=OLD.id AND s.technician_id=NEW.technician_id AND s.date=NEW.date AND s.status!='cancelled' AND NEW.start_time<s.end_time AND NEW.end_time>s.start_time)
      BEGIN SELECT RAISE(ABORT,'Technician already booked in this time interval'); END;
    CREATE TRIGGER IF NOT EXISTS ops_reserved_slot_edit BEFORE UPDATE OF technician_id,date,start_time,end_time ON schedule_slots WHEN EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancel this reservation and rebook to change its time or resource'); END;
    CREATE TRIGGER IF NOT EXISTS ops_reserved_slot_no_reactivate BEFORE UPDATE OF status ON schedule_slots
      WHEN OLD.status='cancelled' AND NEW.status!='cancelled' AND EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancelled reservations must be rebooked with fresh availability checks'); END;
    CREATE TRIGGER IF NOT EXISTS ops_reserved_slot_no_delete BEFORE DELETE ON schedule_slots
      WHEN EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancel reservations instead of deleting their retry and audit history'); END;
  `);
}
const profile = (t: any) => {
  const p = one("SELECT * FROM ops_profiles WHERE technician_id=?", t.id);
  return {
    ...t,
    profile: p
      ? { ...p, windows: JSON.parse(p.windows) }
      : { version: 0, department: "", confirmed: 0, windows: defaults },
  };
};
function availableWindows(t: any, date: string) {
  if (t.status !== "active" || !t.profile.confirmed) return [];
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  return t.profile.windows
    .filter((w: any) => w.day === weekday)
    .map((w: any) => [clock(w.start), clock(w.end)])
    .sort((a: any, b: any) => a[0] - b[0]);
}
function busy(techId: number, date: string, ignoreId = 0, resourceId?: number) {
  const records = all(
    "SELECT start_time,end_time FROM schedule_slots WHERE technician_id=? AND date=? AND status!='cancelled' AND id!=?",
    techId,
    date,
    ignoreId,
  );
  records.push(
    ...all(
      "SELECT start_time,end_time FROM ops_absences WHERE technician_id=? AND date=?",
      techId,
      date,
    ),
  );
  if (resourceId)
    records.push(
      ...all(
        "SELECT s.start_time,s.end_time FROM schedule_slots s JOIN ops_reservations r ON r.slot_id=s.id WHERE r.resource_id=? AND s.date=? AND s.status!='cancelled' AND s.id!=?",
        resourceId,
        date,
        ignoreId,
      ),
    );
  // Unknown legacy intervals must not be treated as free capacity.
  if (
    records.some(
      (s) =>
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time) ||
        s.end_time <= s.start_time,
    )
  )
    return [[0, 1440]];
  return records
    .filter(
      (s) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time),
    )
    .map((s) => [timeMinutes(s.start_time), timeMinutes(s.end_time)]);
}
export function validateSlot(body: any, id = 0) {
  const merged = id ? { ...storage.getScheduleSlot(id), ...body } : body;
  if (
    !["scheduled", "in_progress", "completed", "cancelled"].includes(
      merged.status || "scheduled",
    )
  )
    fail("Invalid appointment status.");
  const date = validDate(merged.date)!;
  const [s, e] = interval(merged.startTime, merged.endTime);
  if (merged.status === "cancelled")
    return { ...body, durationHours: (e - s) / 60 };
  const tech = storage.getTechnician(Number(merged.technicianId));
  if (!tech) fail("Choose a technician.");
  const t = profile(tech);
  if (!availableWindows(t, date).some(([a, b]: number[]) => s >= a && e <= b))
    fail("This slot does not fit confirmed technician working hours.");
  if (busy(tech.id, date, id).some(([a, b]) => overlap(s, e, a, b)))
    fail("Technician is booked or unavailable.", 409);
  return { ...body, durationHours: (e - s) / 60 };
}
export function capacity(
  from: string,
  duration: number,
  department: string,
  resourceId?: number,
) {
  const start = validDate(from)!;
  integer(duration, 15, 720, "Appointment minutes");
  if (department && !DEPARTMENTS.includes(department as any))
    fail("Choose a valid department.");
  if (resourceId && !one("SELECT id FROM ops_resources WHERE id=?", resourceId))
    fail("Resource not found.");
  const today = localToday(),
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Boise",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .split(":")
      .map(Number);
  const current = parts[0] * 60 + parts[1];
  const techs = storage
    .getTechnicians()
    .map(profile)
    .filter((t) => !department || t.profile.department === department);
  return {
    from: start,
    timezone: "America/Boise",
    durationMinutes: duration,
    resources: all("SELECT * FROM ops_resources ORDER BY name"),
    technicians: techs
      .map((t) => {
        let next: any = null;
        for (let d = 0; d < 60 && !next; d++) {
          const date = addDays(start, d);
          if (date < today) continue;
          const occupied = busy(t.id, date, 0, resourceId);
          for (const [a, b] of availableWindows(t, date)) {
            for (
              let minute = Math.max(
                a,
                date === today ? Math.ceil((current + 1) / 15) * 15 : 0,
              );
              minute + duration <= b;
              minute += 15
            ) {
              if (
                !occupied.some(([x, y]) =>
                  overlap(minute, minute + duration, x, y),
                )
              ) {
                next = {
                  date,
                  startTime: minuteString(minute),
                  endTime: minuteString(minute + duration),
                };
                break;
              }
            }
            if (next) break;
          }
        }
        return {
          ...t,
          next,
          reason:
            t.status !== "active"
              ? "Technician not active"
              : !t.profile.confirmed
                ? "Confirm working hours"
                : !next
                  ? "No fitting opening in 60 days"
                  : null,
        };
      })
      .sort((a, b) =>
        (a.next ? `${a.next.date} ${a.next.startTime}` : "9999").localeCompare(
          b.next ? `${b.next.date} ${b.next.startTime}` : "9999",
        ),
      ),
    slots: storage
      .getScheduleSlots()
      .filter((s) => s.date >= start && s.date < addDays(start, 7)),
    absences: all(
      "SELECT * FROM ops_absences WHERE date>=? AND date<? ORDER BY date,start_time",
      start,
      addDays(start, 7),
    ),
    note: "Capacity only: verify job skills, parts, customer approval and any equipment not registered here. Search horizon: 60 days. Working hours are never assumed confirmed.",
  };
}
export function registerCapacity(app: Express) {
  app.get("/api/capacity", (req, res) =>
    res.json(
      sqlite.transaction(() =>
        capacity(
          String(req.query.from || localToday()),
          Number(req.query.minutes || 60),
          String(req.query.department || ""),
          req.query.resourceId ? Number(req.query.resourceId) : undefined,
        ),
      )(),
    ),
  );
  app.put("/api/capacity/profiles/:id", (req, res) => {
    const b = req.body,
      id = Number(req.params.id);
    if (!storage.getTechnician(id)) fail("Technician not found.", 404);
    if (
      !DEPARTMENTS.includes(b.department) ||
      b.confirmed !== true ||
      !Array.isArray(b.windows) ||
      b.windows.length > 28
    )
      fail("Choose department and confirm working-hour windows.");
    for (const w of b.windows) {
      integer(w.day, 0, 6, "Weekday");
      interval(w.start, w.end);
    }
    for (let i = 0; i < b.windows.length; i++)
      for (let j = i + 1; j < b.windows.length; j++) {
        const a = b.windows[i],
          c = b.windows[j];
        if (
          a.day === c.day &&
          overlap(clock(a.start), clock(a.end), clock(c.start), clock(c.end))
        )
          fail("Working windows overlap.");
      }
    sqlite
      .transaction(() => {
        const old = one("SELECT * FROM ops_profiles WHERE technician_id=?", id);
        if ((old?.version || 0) !== b.version)
          fail("Working hours changed. Refresh before saving.", 409);
        const future = storage
          .getScheduleSlots()
          .filter(
            (s) =>
              s.technicianId === id &&
              s.date >= localToday() &&
              s.status !== "cancelled",
          );
        for (const s of future) {
          const wd = new Date(s.date + "T12:00:00Z").getUTCDay();
          if (
            !b.windows.some(
              (w: any) =>
                w.day === wd &&
                clock(s.startTime) >= clock(w.start) &&
                clock(s.endTime) <= clock(w.end),
            )
          )
            fail(
              `New hours conflict with appointment on ${s.date}. Reschedule it first.`,
              409,
            );
        }
        run(
          "INSERT INTO ops_profiles(technician_id,department,windows,confirmed) VALUES(?,?,?,1) ON CONFLICT(technician_id) DO UPDATE SET department=excluded.department,windows=excluded.windows,confirmed=1,version=version+1",
          id,
          b.department,
          JSON.stringify(b.windows),
        );
      })
      .immediate();
    res.json(profile(storage.getTechnician(id)));
  });
  app.post("/api/capacity/absences", (req, res) => {
    const b = req.body;
    validDate(b.date);
    if (!storage.getTechnician(b.technicianId)) fail("Technician not found.");
    const [s, e] = interval(b.startTime, b.endTime);
    if (
      typeof b.reason !== "string" ||
      !b.reason.trim() ||
      b.reason.length > 250
    )
      fail("Reason required.");
    const id = sqlite
      .transaction(() => {
        if (busy(b.technicianId, b.date).some(([a, z]) => overlap(s, e, a, z)))
          fail("Move overlapping appointments or leave first.", 409);
        return run(
          "INSERT INTO ops_absences(technician_id,date,start_time,end_time,reason) VALUES(?,?,?,?,?)",
          b.technicianId,
          b.date,
          b.startTime,
          b.endTime,
          b.reason.trim(),
        ).lastInsertRowid;
      })
      .immediate();
    res.status(201).json(one("SELECT * FROM ops_absences WHERE id=?", id));
  });
  app.delete("/api/capacity/absences/:id", (req, res) => {
    run("DELETE FROM ops_absences WHERE id=?", Number(req.params.id));
    res.json({ success: true });
  });
  app.post("/api/capacity/resources", (req, res) => {
    const b = req.body;
    if (
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 100 ||
      !DEPARTMENTS.includes(b.department)
    )
      fail("Enter resource name and department.");
    const id = run(
      "INSERT INTO ops_resources(name,department) VALUES(?,?)",
      b.name.trim(),
      b.department,
    ).lastInsertRowid;
    res.status(201).json(one("SELECT * FROM ops_resources WHERE id=?", id));
  });
  app.post("/api/capacity/reserve", (req, res) => {
    const b = req.body;
    if (b.readinessConfirmed !== true)
      fail("Confirm that approval, skills and parts have been checked.");
    if (
      typeof b.retryKey !== "string" ||
      !b.retryKey ||
      b.retryKey.length > 128
    )
      fail("Retry key required.");
    const payload = {
      technicianId: b.technicianId,
      jobId: b.jobId,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      resourceId: b.resourceId || null,
    };
    const out = sqlite
      .transaction(() => {
        const old = one(
          "SELECT * FROM ops_reservations WHERE retry_key=?",
          b.retryKey,
        );
        if (old) {
          if (old.request_json !== JSON.stringify(payload))
            fail("Retry key belongs to another appointment.", 409);
          return storage.getScheduleSlot(old.slot_id);
        }
        validDate(b.date);
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Boise",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());
        if (
          b.date < localToday() ||
          (b.date === localToday() && b.startTime <= currentTime)
        )
          fail("Choose a future opening.");
        const job = storage.getJob(b.jobId);
        if (!job || ["completed", "cancelled"].includes(job.status))
          fail("Choose an open work order.");
        const c = one("SELECT * FROM ops_cases WHERE job_id=?", job.id);
        if (c && (c.hold_reason || !c.parts_ready))
          fail(
            "Release this production hold and confirm parts/materials ready first.",
            409,
          );
        const tech = storage.getTechnician(b.technicianId);
        if (
          !tech ||
          !tech.skillAreas
            .split(",")
            .map((s) => s.trim())
            .includes(job.serviceType)
        )
          fail("Technician skills must include this job's service type.");
        const slot = validateSlot({
          ...payload,
          status: "scheduled",
          slotType: "work",
          customerId: job.customerId,
        });
        if (b.resourceId) {
          if (!one("SELECT id FROM ops_resources WHERE id=?", b.resourceId))
            fail("Resource not found.");
          const [s, e] = interval(b.startTime, b.endTime);
          if (
            busy(b.technicianId, b.date, 0, b.resourceId).some(([a, z]) =>
              overlap(s, e, a, z),
            )
          )
            fail("Technician or resource already reserved.", 409);
        }
        const created = storage.createScheduleSlot({
          technicianId: b.technicianId,
          jobId: job.id,
          customerId: job.customerId,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          durationHours: slot.durationHours,
          slotType: "work",
          status: "scheduled",
          notes:
            "Department capacity reservation; readiness confirmed by advisor.",
        });
        run(
          "INSERT INTO ops_reservations(slot_id,resource_id,retry_key,request_json,created_at) VALUES(?,?,?,?,?)",
          created.id,
          b.resourceId || null,
          b.retryKey,
          JSON.stringify(payload),
          new Date().toISOString(),
        );
        storage.updateJob(job.id, {
          assignedTechId: tech.id,
          assignedTech: tech.name,
          scheduledDate: b.date,
          ...(job.status === "pending" ? { status: "scheduled" } : {}),
        });
        return created;
      })
      .immediate();
    res.status(201).json(out);
  });
}
