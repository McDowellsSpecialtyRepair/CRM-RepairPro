import { Switch, Route, Router, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import Staff, { MyAccount, MyWork } from "@/pages/staff";
import { PAGE_PERMISSIONS } from "@shared/security";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import VehicleDetail from "@/pages/vehicle-detail";
import Estimates from "@/pages/estimates";
import EstimateBuilder from "@/pages/estimate-builder";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import Scheduling from "@/pages/scheduling";
import BookingPortal from "@/pages/booking-portal";
import Splat from "@/pages/splat";
import PricingMatrix from "@/pages/pricing-matrix";
import Accounting from "@/pages/accounting";
import Marketing from "@/pages/marketing";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import TechnicianLaborReport from "@/components/labor-sales";
import OperationsDashboard, {ProductionDetail} from "@/pages/operations";

function AppRouter() {
  const { can } = useAuth();
  const [location] = useLocation();
  const section = location.split("/")[1];
  const allowed = section === "staff" ? can("staff.manage") || can("audit.read") : !PAGE_PERMISSIONS[section] || can(PAGE_PERMISSIONS[section]);
  if (!allowed) return <Layout><div className="p-6"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2">Your role does not permit this page. Ask an owner if your responsibilities have changed.</p></div></Layout>;
  return (
    <Layout>
      <Switch>
        <Route path="/">{can("dashboard.read") ? <Dashboard /> : can("mywork") ? <MyWork /> : can("operations.read") ? <OperationsDashboard/> : <div className="p-6"><h1 className="text-xl font-semibold">Your workspace</h1><p className="mt-2">Choose an available section from the menu to begin.</p></div>}</Route>
        <Route path="/operations/:id" component={ProductionDetail}/>
        <Route path="/operations" component={OperationsDashboard}/>
        <Route path="/staff" component={Staff} />
        <Route path="/account" component={MyAccount} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/vehicles/:id" component={VehicleDetail} />
        <Route path="/estimates" component={Estimates} />
        <Route path="/estimates/:id" component={EstimateBuilder} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/scheduling" component={Scheduling} />
        <Route path="/booking" component={BookingPortal} />
        <Route path="/splat" component={Splat} />
        <Route path="/pricing-matrix" component={PricingMatrix} />
        <Route path="/accounting" component={Accounting} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/reports/technician-labor" component={TechnicianLaborReport} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AuthProvider><AppRouter /></AuthProvider>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
