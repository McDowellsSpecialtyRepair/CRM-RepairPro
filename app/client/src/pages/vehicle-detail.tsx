import { useQuery } from "@tanstack/react-query";
import { RelatedWork } from "@/components/related-work";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car, ArrowLeft, Shield, Clock, Wrench, User, MapPin, Factory,
  Fuel, Gauge, Calendar, CheckCircle2, FileText, Receipt
} from "lucide-react";
import { Link, useRoute } from "wouter";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const serviceTypeLabel: Record<string, string> = {
  pdr: "Paintless Dent Repair",
  hail: "Hail Repair",
  interior_repair: "Interior Repair",
  upholstery: "Upholstery",
  window_tint: "Window Tint",
};

const vehicleTypeLabel: Record<string, string> = {
  auto: "Automobile",
  truck: "Truck",
  rv: "RV",
  marine: "Marine",
  motorcycle: "Motorcycle",
  other: "Other",
};

const warrantyBadge = (status: string) => {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Under Warranty</Badge>;
  if (status === "expired") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Warranty Expired</Badge>;
  return <Badge variant="secondary" className="text-[10px]">No Warranty</Badge>;
};

export default function VehicleDetail() {
  const [match, params] = useRoute("/vehicles/:id");
  const id = params?.id;

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["/api/vehicles", id],
    queryFn: () => apiRequest("GET", `/api/vehicles/${id}`),
    enabled: !!id,
  });

  if (isLoading || !vehicle) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const history = vehicle.serviceHistory || [];
  const activeWarranties = history.filter((h: any) => h.warrantyStatus === "active").length;
  const totalServices = history.length;
  const totalCost = history.reduce((sum: number, h: any) => sum + (h.cost || 0), 0);

  return (
    <div className="space-y-6">
      <Link href={`/customers/${vehicle.customerId}`} className="text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3 inline mr-1" /> Back to Customer
      </Link>

      {/* Vehicle Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted shrink-0">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                {vehicle.trim && <Badge variant="secondary" className="text-[10px]">{vehicle.trim}</Badge>}
                <Badge variant="outline" className="text-[10px]">{vehicleTypeLabel[vehicle.vehicleType] || vehicle.vehicleType}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-mono"><Car className="h-3.5 w-3.5" /> VIN: {vehicle.vin}</span>
                {vehicle.licensePlate && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Plate: {vehicle.licensePlate}</span>
                )}
                {vehicle.color && (
                  <span className="flex items-center gap-1.5">Color: {vehicle.color}</span>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Wrench className="h-3.5 w-3.5" /> {totalServices} Services</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3.5 w-3.5 text-green-600" /> {activeWarranties} Active Warranties</span>
                <span className="flex items-center gap-1 text-muted-foreground">Total Service Cost: {formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Specs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {vehicle.bodyClass && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Car className="h-4 w-4" /><span className="text-[10px] uppercase">Body Class</span></div><p className="text-sm font-medium">{vehicle.bodyClass}</p></CardContent></Card>
        )}
        {vehicle.engineInfo && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Gauge className="h-4 w-4" /><span className="text-[10px] uppercase">Engine</span></div><p className="text-sm font-medium">{vehicle.engineInfo}</p></CardContent></Card>
        )}
        {vehicle.fuelType && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Fuel className="h-4 w-4" /><span className="text-[10px] uppercase">Fuel Type</span></div><p className="text-sm font-medium">{vehicle.fuelType}</p></CardContent></Card>
        )}
        {vehicle.gvwr && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Gauge className="h-4 w-4" /><span className="text-[10px] uppercase">GVWR</span></div><p className="text-sm font-medium text-xs">{vehicle.gvwr}</p></CardContent></Card>
        )}
        {vehicle.plantCountry && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Factory className="h-4 w-4" /><span className="text-[10px] uppercase">Plant Country</span></div><p className="text-sm font-medium">{vehicle.plantCountry}</p></CardContent></Card>
        )}
        {vehicle.plantCity && (
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><MapPin className="h-4 w-4" /><span className="text-[10px] uppercase">Plant City</span></div><p className="text-sm font-medium">{vehicle.plantCity}</p></CardContent></Card>
        )}
      </div>

      <RelatedWork vehicleId={vehicle.id} estimates />
      {/* Service History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Service History Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              {history.map((h: any, idx: number) => {
                const today = new Date();
                const expiry = h.warrantyExpiry ? new Date(h.warrantyExpiry) : null;
                const daysLeft = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isCompleted = h.status === "completed";
                const dotColor = isCompleted ? "bg-green-500" : h.status === "in_progress" ? "bg-blue-500" : "bg-gray-400";
                return (
                  <div key={h.id} className="relative flex gap-4 pl-6" data-testid={`div-vehicle-history-${h.id}`}>
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ${dotColor} ring-2 ring-background z-10`} />
                    <div className="flex-1 min-w-0">
                      <div className="rounded-lg border border-border p-3 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">{serviceTypeLabel[h.serviceType] || h.serviceType}</Badge>
                            <Badge variant={isCompleted ? "default" : "secondary"} className="text-[10px]">{h.status}</Badge>
                            {warrantyBadge(h.warrantyStatus)}
                          </div>
                          {h.cost > 0 && <span className="text-sm font-medium">{formatCurrency(h.cost)}</span>}
                        </div>
                        <p className="text-sm font-medium mt-2">{h.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(h.serviceDate)}</span>
                          {h.technician && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {h.technician}</span>}
                          {h.jobId && <Link href={`/jobs/${h.jobId}`} className="flex items-center gap-1 underline"><FileText className="h-3 w-3" /> Open work order #{h.jobId}</Link>}
                          {h.invoiceId && <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Invoice #{h.invoiceId}</span>}
                        </div>
                        {h.warrantyExpiry && (
                          <div className="mt-2 flex items-center gap-2 text-[10px]">
                            <Shield className="h-3 w-3" />
                            <span className="text-muted-foreground">
                              {h.warrantyMonths}-month warranty • Expires {formatDate(h.warrantyExpiry)}
                            </span>
                            {daysLeft !== null && daysLeft > 0 && h.warrantyStatus === "active" && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] ml-auto">
                                {daysLeft} days left
                              </Badge>
                            )}
                            {daysLeft !== null && daysLeft <= 0 && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] ml-auto">
                                Expired {Math.abs(daysLeft)}d ago
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No service history for this vehicle</p>
              <p className="text-xs text-muted-foreground mt-1">Service entries are created when jobs are completed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
