import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Megaphone, Mail, Phone, Gift, Calendar, TrendingUp } from "lucide-react";

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-chart-3/15 text-chart-3",
  completed: "bg-chart-1/15 text-chart-1",
  paused: "bg-chart-4/15 text-chart-4",
};

const typeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
  follow_up: <Calendar className="h-4 w-4" />,
  referral: <Gift className="h-4 w-4" />,
  seasonal: <Calendar className="h-4 w-4" />,
};

export default function Marketing() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: () => apiRequest("GET", "/api/campaigns"),
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const activeCampaigns = (campaigns || []).filter((c: any) => c.status === "active").length;
  const totalSent = (campaigns || []).reduce((sum: number, c: any) => sum + (c.sentCount || 0), 0);
  const totalConversions = (campaigns || []).reduce((sum: number, c: any) => sum + (c.conversionCount || 0), 0);
  const conversionRate = totalSent > 0 ? ((totalConversions / totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Marketing
          </h1>
          <p className="text-sm text-muted-foreground">Campaigns, customer outreach, and referral tracking</p>
        </div>
        <Button disabled title="Campaign creation UI is not implemented yet" data-testid="button-new-campaign">
          <Plus className="h-4 w-4 mr-1" /> Campaign setup pending
        </Button>
      </div>
      <div className="rounded-md border p-3 text-sm">These are manually maintained campaign counters, not verified delivery or attribution. Budgets are planned, not actual spend. Email, text, WhatsApp delivery, attributed sales and ROI are not connected here.</div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Active Campaigns</div>
              <Megaphone className="h-4 w-4 text-chart-1" />
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">{activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Recorded sends</div>
              <Mail className="h-4 w-4 text-chart-2" />
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">{totalSent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Conversions</div>
              <TrendingUp className="h-4 w-4 text-chart-3" />
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">{totalConversions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Conversion Rate</div>
              <TrendingUp className="h-4 w-4 text-chart-4" />
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">{conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-32 rounded bg-muted mb-2"></div>
                <div className="h-3 w-48 rounded bg-muted"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(campaigns || []).map((c: any) => {
            const rate = c.sentCount > 0 ? ((c.conversionCount / c.sentCount) * 100).toFixed(1) : "0";
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow" data-testid={`card-campaign-${c.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`text-[10px] ${statusColors[c.status] || ""}`}>{c.status}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {typeIcons[c.campaignType]} {c.campaignType.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {c.notes && <p className="text-xs text-muted-foreground mb-3">{c.notes}</p>}

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <div className="text-sm font-bold tabular-nums">{c.sentCount || 0}</div>
                      <div className="text-[10px] text-muted-foreground">Sent</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <div className="text-sm font-bold tabular-nums">{c.responseCount || 0}</div>
                      <div className="text-[10px] text-muted-foreground">Responses</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <div className="text-sm font-bold tabular-nums text-chart-3">{c.conversionCount || 0}</div>
                      <div className="text-[10px] text-muted-foreground">Conversions</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Target: {c.targetSegment || "all"}</span>
                    <span>{formatDate(c.startDate)} → {formatDate(c.endDate)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-chart-3 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-[10px] font-medium tabular-nums">{rate}% conv.</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!campaigns || campaigns.length === 0) && (
            <div className="col-span-full py-12 text-center">
              <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No campaigns yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
