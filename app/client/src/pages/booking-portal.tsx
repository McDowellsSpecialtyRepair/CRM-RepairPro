import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Calendar, Clock, CheckCircle2, Wrench, FileText, Shield, Star, Phone, Mail, MapPin, ChevronRight } from "lucide-react";
import { useState } from "react";

const serviceOptions = [
  { value: "pdr", label: "Paintless Dent Repair", icon: "🔧", desc: "Door dings, hail damage, minor dents" },
  { value: "hail", label: "Hail Damage Repair", icon: "🌨️", desc: "Insurance hail claim repairs" },
  { value: "interior_repair", label: "Interior Repair", icon: "🪑", desc: "Vinyl, plastic, fabric, leather repair" },
  { value: "upholstery", label: "Upholstery", icon: "🧵", desc: "Custom upholstery for auto, RV, marine, home" },
  { value: "window_tint", label: "Window Tint", icon: "🕶️", desc: "Auto, RV, and marine window tinting" },
];

const bookingTypes = [
  { value: "estimate", label: "Get an Estimate", icon: FileText, desc: "Schedule a time for us to assess damage and provide a quote" },
  { value: "work", label: "Schedule Work", icon: Wrench, desc: "Book a service appointment for repairs" },
];

const features = [
  { icon: Shield, title: "Insurance Approved", desc: "We work with all major insurance companies" },
  { icon: Star, title: "20+ Years Experience", desc: "Trusted by dealerships and fleets across Idaho" },
  { icon: Car, title: "Mobile & In-Shop", desc: "We come to you or service at our shop" },
  { icon: Clock, title: "Fast Turnaround", desc: "Most repairs completed same or next day" },
];

export default function BookingPortal() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [bookingType, setBookingType] = useState("");
  const [serviceType, setServiceType] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    vehicleInfo: "",
    preferredDate: "",
    preferredTime: "",
    description: "",
  });

  const createBooking = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bookings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    const bookingNumber = `BK-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
    createBooking.mutate({
      ...form,
      bookingNumber,
      bookingType,
      serviceType,
      status: "pending",
    });
  };

  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-chart-3/15 mb-4">
              <CheckCircle2 className="h-8 w-8 text-chart-3" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>Request Submitted!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Thank you, {form.customerName}. We've received your {bookingType === "estimate" ? "estimate" : "service"} request and will contact you within 24 hours to confirm your appointment.
            </p>
            <div className="rounded-lg bg-muted/50 p-4 text-left mb-6">
              <div className="flex items-center gap-2 text-xs mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Preferred: {form.preferredDate ? new Date(form.preferredDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Anytime"} at {form.preferredTime || "Anytime"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>{form.vehicleInfo || "Vehicle info TBD"}</span>
              </div>
            </div>
            <Button onClick={() => { setSubmitted(false); setStep(1); setBookingType(""); setServiceType(""); setForm({ customerName: "", customerEmail: "", customerPhone: "", vehicleInfo: "", preferredDate: "", preferredTime: "", description: "" }); }} className="w-full">
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Hero Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M9 22 L9 10 L13 10 L19 17 L19 10 L23 10 L23 22 L19 22 L13 15 L13 22 Z" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>RepairPro CRM</h1>
              <p className="text-sm text-primary-foreground/70">Specialty Repair & Upholstery</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Schedule Your Service
          </h2>
          <p className="text-primary-foreground/80 max-w-2xl">
            Book an estimate or service appointment online. Choose your preferred time and we'll confirm within 24 hours.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {features.map((f) => (
            <Card key={f.title} className="text-center">
              <CardContent className="p-4">
                <f.icon className="h-6 w-6 mx-auto text-primary mb-2" />
                <div className="text-xs font-semibold">{f.title}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{f.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s}
              </div>
              {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Booking type & service */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: "'Satoshi', sans-serif" }}>What do you need?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-semibold mb-3 block">Booking Type</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bookingTypes.map((bt) => (
                    <button
                      key={bt.value}
                      onClick={() => setBookingType(bt.value)}
                      data-testid={`button-booking-type-${bt.value}`}
                      className={`rounded-lg border p-4 text-left transition-all ${bookingType === bt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                    >
                      <bt.icon className="h-5 w-5 mb-2 text-primary" />
                      <div className="text-sm font-semibold">{bt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{bt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              {bookingType && (
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Service Type</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {serviceOptions.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setServiceType(s.value)}
                        data-testid={`button-service-${s.value}`}
                        className={`rounded-lg border p-4 text-left transition-all ${serviceType === s.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{s.icon}</span>
                          <span className="text-sm font-semibold">{s.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!bookingType || !serviceType} data-testid="button-step1-next">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Schedule preferences */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: "'Satoshi', sans-serif" }}>When works for you?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Preferred Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    min={today}
                    max={maxDate}
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                    data-testid="input-preferred-date"
                  />
                </div>
                <div>
                  <Label className="text-xs">Preferred Time</Label>
                  <Select value={form.preferredTime} onValueChange={(v) => setForm({ ...form, preferredTime: v })}>
                    <SelectTrigger className="mt-1" data-testid="select-preferred-time">
                      <SelectValue placeholder="Anytime" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((t) => (
                        <SelectItem key={t} value={t}>
                          {parseInt(t) < 12 ? `${t} AM` : `${parseInt(t) - 12}:00 PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Vehicle / Asset Info</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. 2023 Ford Edge, 2019 Jayco RV, Boat name, etc."
                  value={form.vehicleInfo}
                  onChange={(e) => setForm({ ...form, vehicleInfo: e.target.value })}
                  data-testid="input-vehicle-info"
                />
              </div>
              <div>
                <Label className="text-xs">Describe the work needed</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Driver side door dent, leather seat cracking, full window tint..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  data-testid="input-description"
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!form.preferredDate} data-testid="button-step2-next">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Contact info */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: "'Satoshi', sans-serif" }}>Your contact information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input className="mt-1" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} data-testid="input-customer-name" />
                </div>
                <div>
                  <Label className="text-xs">Phone *</Label>
                  <Input className="mt-1" type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} data-testid="input-customer-phone" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input className="mt-1" type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} data-testid="input-customer-email" />
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Booking Summary</div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="text-[10px]">{bookingType === "estimate" ? "Estimate" : "Work"}</Badge>
                  <Badge variant="outline" className="text-[10px]">{serviceOptions.find(s => s.value === serviceType)?.label}</Badge>
                </div>
                {form.preferredDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(form.preferredDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    {form.preferredTime && ` at ${parseInt(form.preferredTime) < 12 ? `${form.preferredTime} AM` : `${parseInt(form.preferredTime) - 12}:00 PM`}`}
                  </div>
                )}
                {form.vehicleInfo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Car className="h-3 w-3" /> {form.vehicleInfo}
                  </div>
                )}
                {form.description && (
                  <div className="text-xs text-muted-foreground">{form.description}</div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleSubmit} disabled={!form.customerName || !form.customerPhone || createBooking.isPending} data-testid="button-submit-booking">
                  {createBooking.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Call Us</div>
              <div className="text-xs text-muted-foreground">(208) 555-0100</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Email</div>
              <div className="text-xs text-muted-foreground">service@repairco.com</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Visit</div>
              <div className="text-xs text-muted-foreground">Boise, Idaho</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
