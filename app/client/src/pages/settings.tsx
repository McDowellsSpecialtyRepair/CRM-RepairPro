import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CreditCard, Bell, Shield, Database, Users } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">System configuration and preferences</p>
      </div>

      <p className="rounded-md border p-3 text-sm">Business, service-area and tax settings below are preview placeholders, not saved configuration. Users &amp; Roles is functional. Confirm actual business details and configure production settings before issuing customer documents.</p>
      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="business" data-testid="tab-business">Business</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax">Tax & Billing</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users & Roles</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Business Name</Label>
                  <Input defaultValue="RepairPro LLC" className="mt-1" data-testid="input-business-name" />
                </div>
                <div>
                  <Label className="text-xs">DBA Name</Label>
                  <Input defaultValue="RepairPro Specialty Services" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Input defaultValue="1425 W Industrial Way" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">City, State, ZIP</Label>
                  <Input defaultValue="Boise, ID 83709" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input defaultValue="(208) 555-0100" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input defaultValue="info@repairpro.com" className="mt-1" />
                </div>
              </div>
              <Button disabled data-testid="button-save-business">Business settings persistence not configured</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Service Area Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Primary Service Area</Label>
                  <Select defaultValue="boise">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boise">Boise Metro Area</SelectItem>
                      <SelectItem value="treasure">Treasure Valley</SelectItem>
                      <SelectItem value="idaho">Statewide Idaho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Travel Radius (miles)</Label>
                  <Input type="number" defaultValue="75" className="mt-1" />
                </div>
              </div>
              <div className="space-y-2">
                {["Paintless Dent Repair", "Hail Repair", "Interior Vinyl/Fabric Repair", "Upholstery", "Window Tint"].map((service) => (
                  <div key={service} className="flex items-center justify-between rounded-md border border-border p-2.5">
                    <span className="text-sm">{service}</span>
                    <Badge variant="secondary" className="text-[10px] text-chart-3">Active</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Tax Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Sales Tax Rate (%)</Label>
                  <Input type="number" step="0.01" defaultValue="6.00" className="mt-1" data-testid="input-tax-rate" />
                </div>
                <div>
                  <Label className="text-xs">Tax ID / EIN</Label>
                  <Input defaultValue="XX-XXXXXXX" className="mt-1" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <span className="text-sm">Tax-exempt customers</span>
                  <Badge variant="secondary" className="text-[10px]">Auto-detect from customer profile</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <span className="text-sm">Default payment terms</span>
                  <Badge variant="secondary" className="text-[10px]">Net 30</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <span className="text-sm">Late payment reminder</span>
                  <Badge variant="secondary" className="text-[10px] text-chart-4">Not configured</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <StaffAccess />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" /> QuickBooks Enterprise Desktop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/15">
                    <Shield className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Not connected</div>
                    <div className="text-xs text-muted-foreground">Desktop version and company file must be confirmed. No transfer is enabled.</div>
                  </div>
                </div>
                <Button disabled variant="outline" size="sm" data-testid="button-configure-qb">Setup required</Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sync Direction</span><span>Not configured</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Auto Sync</span><span>Disabled</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Verified Successful Sync</span><span>None</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">QB Web Connector</span><span>Not verified</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legacy System Migration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">MobileTechRX</div>
                  <div className="text-xs text-muted-foreground">PDR estimating data migration not verified</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Review required</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">RoadFS Zenware</div>
                  <div className="text-xs text-muted-foreground">Customer database migration not verified</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Review required</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import StaffAccess from "@/pages/staff";
