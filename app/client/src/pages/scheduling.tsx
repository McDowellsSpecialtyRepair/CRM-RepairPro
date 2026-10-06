import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight, MapPin, Car, Wrench, CheckCircle2, Bell, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import CapacityCalendar from "@/components/capacity-calendar";
import { Link } from "wouter";

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const formatDateLong = (s: string) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

const slotTypeColors: Record<string, string> = {
  estimate: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  work: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  travel: "bg-muted text-muted-foreground border-border",
};

const bookingStatusColors: Record<string, string> = {
  pending: "bg-chart-4/15 text-chart-4",
  confirmed: "bg-chart-3/15 text-chart-3",
  declined: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

const techTypeColors: Record<string, string> = {
  mobile: "bg-chart-1/15 text-chart-1",
  in_shop: "bg-chart-3/15 text-chart-3",
};

const techStatusColors: Record<string, string> = {
  active: "bg-chart-3/15 text-chart-3",
  on_leave: "bg-chart-4/15 text-chart-4",
  inactive: "bg-muted text-muted-foreground",
};

function getWeekDates(startDate: Date) {
  const dates: Date[] = [];
  const day = startDate.getDay();
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() - day + (day === 0 ? -6 : 1));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function toDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function Scheduling(){return <div className="space-y-8"><CapacityCalendar/><details className="border rounded-lg p-4"><summary className="font-semibold cursor-pointer">Legacy calendar & booking requests</summary><div className="mt-5"><LegacyScheduling/></div></details></div>;}
function LegacyScheduling() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"week" | "tech">("week");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slotCreated, setSlotCreated] = useState(false);

  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: () => apiRequest("GET", "/api/technicians"),
  });
  const { data: slots } = useQuery({
    queryKey: ["/api/schedule-slots"],
    queryFn: () => apiRequest("GET", "/api/schedule-slots"),
  });
  const { data: bookings } = useQuery({
    queryKey: ["/api/bookings"],
    queryFn: () => apiRequest("GET", "/api/bookings"),
  });
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs"),
  });

  const createSlot = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/schedule-slots", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-slots"] });
      setSlotCreated(true);
      setTimeout(() => { setDialogOpen(false); setSlotCreated(false); }, 1000);
    },
  });

  const updateBooking = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/bookings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const [slotForm, setSlotForm] = useState({
    technicianId: "",
    date: "",
    startTime: "",
    endTime: "",
    slotType: "work",
    notes: "",
    jobId: "",
  });

  const handleCreateSlot = () => {
    const start = parseInt(slotForm.startTime.split(":")[0]);
    const end = parseInt(slotForm.endTime.split(":")[0]);
    const duration = end - start;
    createSlot.mutate({
      ...slotForm,
      technicianId: parseInt(slotForm.technicianId),
      jobId: slotForm.jobId ? parseInt(slotForm.jobId) : undefined,
      durationHours: duration > 0 ? duration : 2,
      status: "scheduled",
    });
  };

  const handleConfirmBooking = (booking: any) => {
    const slot = slots?.find((s: any) => s.id === booking.scheduledSlotId);
    updateBooking.mutate({
      id: booking.id,
      data: {
        status: "confirmed",
        confirmedDate: booking.preferredDate,
        confirmedTime: booking.preferredTime,
        assignedTechnicianId: booking.assignedTechnicianId || technicians?.[0]?.id,
      },
    });
  };

  const handleDeclineBooking = (bookingId: number) => {
    updateBooking.mutate({ id: bookingId, data: { status: "declined" } });
  };

  const today = new Date();
  today.setDate(today.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(today);

  const slotsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (slots || []).forEach((s: any) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [slots]);

  const slotsByTech = useMemo(() => {
    const map: Record<number, any[]> = {};
    (slots || []).forEach((s: any) => {
      if (!map[s.technicianId]) map[s.technicianId] = [];
      map[s.technicianId].push(s);
    });
    return map;
  }, [slots]);

  const pendingBookings = (bookings || []).filter((b: any) => b.status === "pending");
  const confirmedBookings = (bookings || []).filter((b: any) => b.status === "confirmed");

  const techName = (id: number) => technicians?.find((t: any) => t.id === id)?.name || "Unassigned";
  const techColor = (id: number) => technicians?.find((t: any) => t.id === id)?.color || "#20808D";
  const jobTitle = (id: number | undefined) => {
    if (!id) return "";
    const j = jobs?.find((j: any) => j.id === id);
    return j?.title || "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Scheduling
          </h1>
          <p className="text-sm text-muted-foreground">Dispatch board, technician scheduling & booking requests</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-slot">
              <Plus className="h-4 w-4 mr-1" /> Schedule Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Slot</DialogTitle>
            </DialogHeader>
            {slotCreated ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-chart-3 mb-2" />
                <p className="text-sm font-medium">Slot scheduled successfully</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Technician</Label>
                    <Select value={slotForm.technicianId} onValueChange={(v) => setSlotForm({ ...slotForm, technicianId: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {(technicians || []).filter((t: any) => t.status === "active").map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name} ({t.technicianType === "mobile" ? "Mobile" : "In-Shop"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input className="mt-1" type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Slot Type</Label>
                      <Select value={slotForm.slotType} onValueChange={(v) => setSlotForm({ ...slotForm, slotType: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="estimate">Estimate</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input className="mt-1" type="time" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input className="mt-1" type="time" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Link to Job (optional)</Label>
                    <Select value={slotForm.jobId} onValueChange={(v) => setSlotForm({ ...slotForm, jobId: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {(jobs || []).map((j: any) => (
                          <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input className="mt-1" value={slotForm.notes} onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleCreateSlot} disabled={createSlot.isPending || !slotForm.technicianId || !slotForm.date} data-testid="button-save-slot">
                    {createSlot.isPending ? "Scheduling..." : "Schedule Slot"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Booking Alert Banner */}
      {pendingBookings.length > 0 && (
        <Card className="border-chart-4/30 bg-chart-4/5" data-testid="card-booking-alerts">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-chart-4" />
              <span className="text-sm font-semibold">{pendingBookings.length} New Booking Request{pendingBookings.length > 1 ? "s" : ""} Need Confirmation</span>
            </div>
            <div className="space-y-2">
              {pendingBookings.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3" data-testid={`card-booking-${b.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{b.customerName}</span>
                      <Badge variant="secondary" className={`text-[10px] ${bookingStatusColors[b.status]}`}>{b.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{serviceLabels[b.serviceType] || b.serviceType}</Badge>
                      <Badge variant="outline" className="text-[10px]">{b.bookingType === "estimate" ? "Estimate" : "Work"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{b.description}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                      {b.vehicleInfo && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{b.vehicleInfo}</span>}
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(b.preferredDate)} {b.preferredTime}</span>
                      {b.customerPhone && <span className="flex items-center gap-1"><User className="h-3 w-3" />{b.customerPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Button size="sm" onClick={() => handleConfirmBooking(b)} data-testid={`button-confirm-booking-${b.id}`} className="h-8">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeclineBooking(b.id)} data-testid={`button-decline-booking-${b.id}`} className="h-8 text-destructive">
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technician roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Technician Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(technicians || []).map((t: any) => {
              const techSlots = (slots || []).filter((s: any) => s.technicianId === t.id);
              const todaySlots = techSlots.filter((s: any) => s.date === toDateString(new Date()));
              return (
                <div key={t.id} className="rounded-lg border border-border p-3" data-testid={`card-tech-${t.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: t.color + "20", color: t.color }}>
                      {t.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{t.name}</div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className={`text-[9px] ${techTypeColors[t.technicianType]}`}>{t.technicianType === "mobile" ? "Mobile" : "In-Shop"}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {t.skillAreas.split(",").map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[9px]">{serviceLabels[s] || s}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{todaySlots.length} today</span>
                    <Badge variant="secondary" className={`text-[9px] ${techStatusColors[t.status]}`}>{t.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "week" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Week View
          </button>
          <button
            onClick={() => setViewMode("tech")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "tech" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            By Technician
          </button>
        </div>
        {viewMode === "week" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {formatDate(toDateString(weekDates[0]))} - {formatDate(toDateString(weekDates[6]))}
            </span>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs text-primary ml-2">Today</button>
            )}
          </div>
        )}
      </div>

      {/* Week View */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDates.map((d) => {
            const dateStr = toDateString(d);
            const daySlots = (slotsByDate[dateStr] || []).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
            const isToday = dateStr === toDateString(new Date());
            return (
              <div key={dateStr} className={`rounded-lg border ${isToday ? "border-primary/40 bg-primary/5" : "border-border"} min-h-[200px]`}>
                <div className={`px-3 py-2 border-b ${isToday ? "border-primary/30" : "border-border"}`}>
                  <div className="text-xs font-semibold">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className={`text-lg ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{d.getDate()}</div>
                </div>
                <div className="p-2 space-y-2">
                  {daySlots.map((slot: any) => (
                    <div
                      key={slot.id}
                      className={`rounded-md border p-2 text-xs ${slotTypeColors[slot.slotType] || "bg-muted"}`}
                      data-testid={`card-slot-${slot.id}`}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        {slot.startTime} - {slot.endTime}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: techColor(slot.technicianId) }} />
                        <span className="truncate">{techName(slot.technicianId)}</span>
                      </div>
                      {jobTitle(slot.jobId) && (
                        <Link href={`/jobs/${slot.jobId}`} className="mt-1 block text-xs underline">{jobTitle(slot.jobId)} · Open work order</Link>
                      )}
                      {slot.notes && (
                        <div className="mt-1 text-[10px] opacity-60 truncate">{slot.notes}</div>
                      )}
                      <Badge variant="outline" className="text-[9px] mt-1">
                        {slot.status === "in_progress" ? "In Progress" : slot.status}
                      </Badge>
                    </div>
                  ))}
                  {daySlots.length === 0 && (
                    <div className="text-center text-[10px] text-muted-foreground py-4">No jobs</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Technician View */}
      {viewMode === "tech" && (
        <div className="space-y-4">
          {(technicians || []).filter((t: any) => t.status !== "inactive").map((t: any) => {
            const techSlots = (slotsByTech[t.id] || []).sort((a: any, b: any) => b.date.localeCompare(a.date));
            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: t.color + "20", color: t.color }}>
                        {t.name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div>
                        <CardTitle className="text-sm">{t.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="secondary" className={`text-[9px] ${techTypeColors[t.technicianType]}`}>{t.technicianType === "mobile" ? "Mobile" : "In-Shop"}</Badge>
                          <Badge variant="secondary" className={`text-[9px] ${techStatusColors[t.status]}`}>{t.status}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{techSlots.length} scheduled slot{techSlots.length !== 1 ? "s" : ""}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  {techSlots.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4">No scheduled slots</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {techSlots.map((slot: any) => (
                        <div key={slot.id} className={`rounded-md border p-3 text-xs ${slotTypeColors[slot.slotType] || "bg-muted"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{formatDate(slot.date)}
                            </span>
                            <Badge variant="outline" className="text-[9px]">
                              {slot.status === "in_progress" ? "In Progress" : slot.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3" />{slot.startTime} - {slot.endTime}
                            <span className="text-muted-foreground ml-1">({slot.durationHours}h)</span>
                          </div>
                          {jobTitle(slot.jobId) && (
                            <Link href={`/jobs/${slot.jobId}`} className="text-xs underline">{jobTitle(slot.jobId)} · Open work order</Link>
                          )}
                          {slot.notes && (
                            <div className="text-[10px] opacity-60 mt-1">{slot.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
