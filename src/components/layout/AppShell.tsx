import React, { useState } from "react";
import {
  useAppState,
  identityActions,
} from "../../infrastructure/store";
import type { Role, User } from "../../modules/shared/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  PackageCheck,
  Repeat,
  Receipt,
  HeartPulse,
  BarChart3,
  Settings,
  UserCheck,
  Bell,
  History,
  ShieldCheck,
  ChevronDown,
  Building2,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  MessageSquareQuote,
  RotateCw,
  Kanban,
} from "lucide-react";
import { toast } from "sonner";

import { type NavTab, canAccessPage } from "../../modules/identity/permissions";
export type { NavTab };

interface AppShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab, extraId?: string) => void;
  selectedQuotationId?: string | undefined;
  children: React.ReactNode;
}

export function AppShell({
  currentTab,
  onSelectTab,
  selectedQuotationId: _selectedQuotationId,
  children,
}: AppShellProps) {
  const state = useAppState();
  const session = state.session;
  const isCustomer = session?.role === "CUSTOMER";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Toggle dark mode
  const toggleDark = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Badge counts
  const pendingApprovalsCount = state.approvals.filter(
    (a) => a.status === "PENDING",
  ).length;
  const awaitingFulfillmentCount = state.orders.filter(
    (o) => o.status === "AWAITING" || o.status === "BACKORDERED",
  ).length;
  const unpaidInvoicesCount = state.invoices.filter(
    (i) => i.status === "UNPAID" || i.status === "PARTIALLY_PAID",
  ).length;
  const activeAlertsCount = state.quotations.filter(
    (q) => q.escalated || q.stage === "NEGOTIATION",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => onSelectTab(isCustomer ? "portal" : "dashboard")}
          >
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm tracking-wider">
              DF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight">DealFlow360</span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  B2B Operations
                </span>
              </div>
            </div>
          </div>

          {/* Top Menu: Sales Workspace Navigation */}
          {!isCustomer && (
            <div className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-border">
              {canAccessPage(session?.role, "quotations") && (
                <Button
                  variant={currentTab === "quotations" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => onSelectTab("quotations")}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Quotations
                </Button>
              )}
              {canAccessPage(session?.role, "pipeline") && (
                <Button
                  variant={currentTab === "pipeline" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => onSelectTab("pipeline")}
                >
                  <Kanban className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Pipeline
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Actions: Reload Data, Go to Back-end, Close Workspace */}
          {!isCustomer && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs items-center gap-1.5 hidden sm:flex"
                onClick={async () => {
                  try {
                    await identityActions.syncWithDatabase();
                    toast.success("Pricing, stock, and approval data reloaded from database");
                  } catch (err: any) {
                    toast.error("Failed to reload data");
                  }
                }}
                title="Refreshes pricing, stock, and approval data from the backend"
              >
                <RotateCw className="h-3.5 w-3.5 text-primary" />
                <span>Reload Data</span>
              </Button>

              {session?.role === "ADMIN" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs items-center gap-1.5 hidden md:flex"
                  onClick={() => onSelectTab("admin")}
                  title="Opens the configuration and settings screen"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Go to Back-end</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-destructive items-center gap-1.5 hidden lg:flex"
                onClick={() => {
                  identityActions.logout();
                  toast.info("Sales workspace session closed");
                }}
                title="Ends the current working session view"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Close Workspace</span>
              </Button>
            </>
          )}

          {/* Domain Events Drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
                {state.events.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[360px] sm:w-[440px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Domain Events Stream
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Reactive events dispatched across bounded contexts
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2.5">
                  {state.events.map((e) => (
                    <div
                      key={e.id}
                      className="p-2.5 rounded-lg border border-border bg-card text-card-foreground text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-semibold text-primary">{e.name}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-muted-foreground break-all">{e.payload}</p>
                    </div>
                  ))}
                  {state.events.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No events emitted yet.</p>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Audit Trail Drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <History className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[360px] sm:w-[440px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Audit Trail
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Immutable record of user actions and decisions
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2.5">
                  {state.audit.map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-lg border border-border bg-card text-card-foreground text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{a.action}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                          {a.entity}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                        <span>Actor: {a.actor}</span>
                        <span className="text-[10px]">
                          {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {a.reason && (
                        <p className="text-[11px] text-muted-foreground/90 italic bg-muted/50 p-1.5 rounded">
                          "{a.reason}"
                        </p>
                      )}
                    </div>
                  ))}
                  {state.audit.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No audit records.</p>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Dark / Light Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleDark} className="h-8 w-8 text-muted-foreground">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User Account Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 flex items-center gap-2 text-xs">
                <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                  {session?.name.charAt(0) ?? "?"}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none text-left">
                  <span className="font-medium text-xs truncate max-w-[110px]">{session?.name ?? "Account"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {session?.role.replace("_", " ")}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-semibold flex items-center justify-between">
                <span>Account</span>
                <span className="text-[10px] text-muted-foreground font-normal font-mono">
                  {session?.role.replace("_", " ")}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onSelectTab("profile")}
                className="text-xs font-medium flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>My Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => identityActions.logout()}
                className="text-xs text-destructive flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card/50 backdrop-blur lg:static lg:block transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex flex-col h-full py-4 px-3">
            {/* Context Header */}
            <div className="px-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                {isCustomer ? (
                  <>
                    <Building2 className="h-3 w-3 text-primary" />
                    Customer Portal
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    Sales Operations
                  </>
                )}
              </div>
              <div className="text-xs font-medium text-foreground mt-0.5">
                {isCustomer ? (
                  <span>Acme Corp Account</span>
                ) : (
                  <span>DealFlow Enterprise</span>
                )}
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1 flex-1">
              {!isCustomer ? (
                <>
                  {canAccessPage(session?.role, "dashboard") && (
                    <NavItem
                      icon={<LayoutDashboard className="h-4 w-4" />}
                      label="Dashboard"
                      active={currentTab === "dashboard"}
                      onClick={() => {
                        onSelectTab("dashboard");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "quotations") && (
                    <NavItem
                      icon={<FileText className="h-4 w-4" />}
                      label="Quotations"
                      active={currentTab === "quotations" || currentTab === "quotation-builder"}
                      count={state.quotations.length}
                      onClick={() => {
                        onSelectTab("quotations");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "pipeline") && (
                    <NavItem
                      icon={<Kanban className="h-4 w-4" />}
                      label="Pipeline"
                      active={currentTab === "pipeline"}
                      onClick={() => {
                        onSelectTab("pipeline");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "approvals") && (
                    <NavItem
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      label="Approvals"
                      active={currentTab === "approvals"}
                      count={pendingApprovalsCount}
                      badgeVariant={pendingApprovalsCount > 0 ? "destructive" : "secondary"}
                      onClick={() => {
                        onSelectTab("approvals");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "fulfillment") && (
                    <NavItem
                      icon={<PackageCheck className="h-4 w-4" />}
                      label="Fulfillment"
                      active={currentTab === "fulfillment"}
                      count={awaitingFulfillmentCount}
                      badgeVariant={awaitingFulfillmentCount > 0 ? "secondary" : undefined}
                      onClick={() => {
                        onSelectTab("fulfillment");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "subscriptions") && (
                    <NavItem
                      icon={<Repeat className="h-4 w-4" />}
                      label="Subscriptions"
                      active={currentTab === "subscriptions"}
                      count={state.subscriptions.length}
                      onClick={() => {
                        onSelectTab("subscriptions");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "invoices") && (
                    <NavItem
                      icon={<Receipt className="h-4 w-4" />}
                      label="Invoices"
                      active={currentTab === "invoices"}
                      count={unpaidInvoicesCount}
                      onClick={() => {
                        onSelectTab("invoices");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "deal-health") && (
                    <NavItem
                      icon={<HeartPulse className="h-4 w-4" />}
                      label="Deal Health"
                      active={currentTab === "deal-health"}
                      count={activeAlertsCount}
                      badgeVariant={activeAlertsCount > 0 ? "destructive" : "secondary"}
                      onClick={() => {
                        onSelectTab("deal-health");
                        setMobileOpen(false);
                      }}
                    />
                  )}
                  {canAccessPage(session?.role, "reports") && (
                    <NavItem
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="Reports"
                      active={currentTab === "reports"}
                      onClick={() => {
                        onSelectTab("reports");
                        setMobileOpen(false);
                      }}
                    />
                  )}

                  {canAccessPage(session?.role, "governance") && (
                    <>
                      <div className="pt-3 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Commercial Policy
                      </div>
                      <NavItem
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Discount Governance"
                        active={currentTab === "governance"}
                        onClick={() => {
                          onSelectTab("governance");
                          setMobileOpen(false);
                        }}
                      />
                    </>
                  )}

                  {canAccessPage(session?.role, "warehouses") && (
                    <>
                      <div className="pt-3 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Logistics Operations
                      </div>
                      <NavItem
                        icon={<Building2 className="h-4 w-4" />}
                        label="Warehouses & Inventory"
                        active={currentTab === "warehouses"}
                        onClick={() => {
                          onSelectTab("warehouses");
                          setMobileOpen(false);
                        }}
                      />
                    </>
                  )}

                  {canAccessPage(session?.role, "admin") && (
                    <>
                      <div className="pt-3 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Admin Settings
                      </div>
                      <NavItem
                        icon={<Settings className="h-4 w-4" />}
                        label="Configurations"
                        active={currentTab === "admin"}
                        onClick={() => {
                          onSelectTab("admin");
                          setMobileOpen(false);
                        }}
                      />
                    </>
                  )}

                  <div className="pt-3 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Account
                  </div>
                  <NavItem
                    icon={<UserCheck className="h-4 w-4" />}
                    label="My Profile"
                    active={currentTab === "profile"}
                    onClick={() => {
                      onSelectTab("profile");
                      setMobileOpen(false);
                    }}
                  />
                </>
              ) : (
                /* Customer Portal Navigation - Strictly Isolated */
                <>
                  <NavItem
                    icon={<FileText className="h-4 w-4" />}
                    label="My Quotations"
                    active={currentTab === "portal"}
                    onClick={() => {
                      onSelectTab("portal");
                      setMobileOpen(false);
                    }}
                  />
                  <NavItem
                    icon={<MessageSquareQuote className="h-4 w-4" />}
                    label="Negotiations"
                    active={currentTab === "portal"}
                    count={
                      state.quotations
                        .filter((q) => q.customerId === session?.customerId)
                        .reduce((sum, q) => sum + q.requests.length, 0)
                    }
                    onClick={() => {
                      onSelectTab("portal");
                      setMobileOpen(false);
                    }}
                  />
                  <NavItem
                    icon={<UserCheck className="h-4 w-4" />}
                    label="My Profile"
                    active={currentTab === "profile"}
                    onClick={() => {
                      onSelectTab("profile");
                      setMobileOpen(false);
                    }}
                  />
                </>
              )}
            </nav>

            {/* Sidebar Footer User Details */}
            <div className="pt-3 mt-auto border-t border-border px-2">
              <button
                type="button"
                onClick={() => {
                  onSelectTab("profile");
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/80 transition-colors text-left group"
                title="View & Edit Profile"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  {session?.name.charAt(0) ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {session?.name ?? "Sign In"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {session?.email ?? "Access Account"}
                  </p>
                </div>
                <Settings className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | undefined;
  onClick: () => void;
}

function NavItem({ icon, label, active, count, badgeVariant = "secondary", onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <Badge
          variant={active ? "outline" : badgeVariant}
          className={`text-[10px] h-4 px-1.5 py-0 font-mono ${
            active ? "border-primary-foreground text-primary-foreground" : ""
          }`}
        >
          {count}
        </Badge>
      )}
    </button>
  );
}
