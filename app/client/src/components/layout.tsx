import { useCustomerLookup } from "@/components/customer-lookup";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  Receipt,
  Calculator,
  Megaphone,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Search,
  Bell,
  Grid3x3,
  Menu,
  X,
  Car,
  Calendar,
  User,
  Briefcase,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { PAGE_PERMISSIONS, ROLES } from "@shared/security";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/estimates", label: "Estimates", icon: FileText },
  { path: "/jobs", label: "Jobs", icon: Wrench },
  { path: "/operations", label: "Operations", icon: ClipboardList },
  { path: "/invoices", label: "Invoices", icon: Receipt },
  { path: "/scheduling", label: "Scheduling", icon: Calendar },
  { path: "/splat", label: "Vehicle Splat", icon: Car },
  { path: "/pricing-matrix", label: "Pricing Matrix", icon: Grid3x3 },
  { path: "/accounting", label: "Accounting", icon: Calculator },
  { path: "/marketing", label: "Marketing", icon: Megaphone },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/reports/technician-labor", label: "Technician labor sales", icon: DollarSign },
  { path: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M9 22 L9 10 L13 10 L19 17 L19 10 L23 10 L23 22 L19 22 L13 15 L13 22 Z" fill="currentColor" className="text-primary-foreground"/>
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight text-sidebar-foreground" style={{ fontFamily: "'Satoshi', sans-serif" }}>
          RepairPro
        </div>
        <div className="text-[10px] text-sidebar-foreground/60">CRM & Billing</div>
      </div>
    </div>
  );
}

const formatDate = (s: string) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, can, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const visibleNav = [...navItems.filter(i => i.path === "/" || can(PAGE_PERMISSIONS[i.path.split("/")[1]])), ...(can("staff.manage") || can("audit.read") ? [{path:"/staff",label:"Staff access",icon:Users}] : []), {path:"/account",label:"My account",icon:User}];
  const [location] = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Fetch data for search
  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    enabled: can("customers.read"),
    queryFn: () => apiRequest("GET", "/api/customers"),
  });
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: can("jobs.read"),
    queryFn: () => apiRequest("GET", "/api/jobs"),
  });
  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: can("billing.read"),
    queryFn: () => apiRequest("GET", "/api/invoices"),
  });
  const { data: activities } = useQuery({
    queryKey: ["/api/activities"],
    enabled: can("activity.read"),
    queryFn: () => apiRequest("GET", "/api/activities"),
  });

  const { results: lookupResults } = useCustomerLookup(can("customers.read") ? searchQuery : "");
  // Search results
  const searchResults = (() => {
    if (!searchQuery.trim()) return { customers: [], jobs: [], invoices: [] };
    const q = searchQuery.toLowerCase();
    const custMatches = lookupResults.slice(0, 6);
    const jobMatches = (jobs || []).filter((j: any) =>
      j.title.toLowerCase().includes(q) || j.jobNumber.toLowerCase().includes(q)
    ).slice(0, 5);
    const invMatches = (invoices || []).filter((i: any) =>
      (i.invoiceNumber || "").toLowerCase().includes(q) || (i.notes || "").toLowerCase().includes(q)
    ).slice(0, 5);
    return { customers: custMatches, jobs: jobMatches, invoices: invMatches };
  })();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { setMobileNavOpen(false); }, [location]);

  const totalResults = searchResults.customers.length + searchResults.jobs.length + searchResults.invoices.length;
  const recentActivities = (activities || []).slice(-8).reverse();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          <Logo />
          <button className="md:hidden rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent/60" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 overscroll-contain">
          <div className="space-y-0.5">
            {visibleNav.map((item) => {
              const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path) && !visibleNav.some(other=>other.path!==item.path&&other.path.startsWith(item.path+"/")&&location.startsWith(other.path)));
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileNavOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.path === "/" && !can("dashboard.read") ? can("mywork") ? "My work" : "Workspace" : item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
              {user.fullName.split(" ").map(n => n[0]).slice(0,2).join("")}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-sidebar-foreground">{user.fullName}</div>
              <div className="text-xs text-sidebar-foreground/60">{ROLES[user.role].label}</div>
            </div>
          </div>
          <button className="text-sm px-2 py-2 underline text-sidebar-foreground" onClick={() => void logout().catch(e => setLogoutError(e.message))}>Sign out</button>
          {logoutError && <p role="alert" className="text-xs text-destructive">{logoutError}</p>}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-6">
          <button className="md:hidden rounded-md p-2 -ml-1 hover:bg-muted" onClick={() => setMobileNavOpen(true)} aria-label="Open menu" data-testid="button-mobile-menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0 max-w-md">
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, phone, VIN, plate, job, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-search"
              />
              {/* Search dropdown */}
              {searchFocused && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                  {totalResults === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No results for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.customers.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                            <User className="h-3 w-3" /> Customers ({searchResults.customers.length})
                          </div>
                          {searchResults.customers.map((c: any) => {
                            const name = c.name;
                            return (
                              <Link
                                key={c.id}
                                href={`/customers/${c.id}`}
                                onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm"
                              >
                                <span className="min-w-0">
                                  <span className="block font-medium truncate">{name}</span>
                                  <span className="block text-[11px] text-muted-foreground truncate">{[c.phone, c.vehicles?.[0]?.label].filter(Boolean).join(" · ")}</span>
                                </span>
                                <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{c.matchedOn?.[0]}</Badge>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      {searchResults.jobs.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                            <Briefcase className="h-3 w-3" /> Jobs ({searchResults.jobs.length})
                          </div>
                          {searchResults.jobs.map((j: any) => (
                            <Link
                              key={j.id}
                              href={`/jobs/${j.id}`}
                              onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm"
                            >
                              <span className="font-medium truncate">{j.title}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{j.jobNumber}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {searchResults.invoices.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3" /> Invoices ({searchResults.invoices.length})
                          </div>
                          {searchResults.invoices.map((i: any) => (
                            <Link
                              key={i.id}
                              href={`/invoices/${i.id}`}
                              onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm"
                            >
                              <span className="font-medium truncate">{i.invoiceNumber}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{i.status}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                data-testid="button-notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold border-b border-border bg-muted/50">
                    Recent Activity
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentActivities.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
                    ) : (
                      recentActivities.map((act: any) => (
                        <div key={act.id} className="px-3 py-2 border-b border-border/50 hover:bg-muted/30">
                          <p className="text-xs leading-relaxed">{act.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {act.performedBy} • {formatDate(act.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overscroll-contain bg-background p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
