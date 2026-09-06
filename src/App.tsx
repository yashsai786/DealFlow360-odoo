import React, { useState, useEffect } from "react";
import { AppShell, type NavTab } from "./components/layout/AppShell";
import { DashboardView } from "./features/dashboard/DashboardView";
import { QuotationsListView } from "./features/quotations/QuotationsListView";
import { QuotationBuilderView } from "./features/quotations/QuotationBuilderView";
import { ApprovalsView } from "./features/approvals/ApprovalsView";
import { FulfillmentView } from "./features/fulfillment/FulfillmentView";
import { SubscriptionsView } from "./features/subscriptions/SubscriptionsView";
import { InvoicesView } from "./features/invoices/InvoicesView";
import { DealHealthView } from "./features/intelligence/DealHealthView";
import { ReportingView } from "./features/reporting/ReportingView";
import { AdminConfigView } from "./features/admin/AdminConfigView";
import { CustomerPortalView } from "./features/portal/CustomerPortalView";
import { ProfileView } from "./features/profile/ProfileView";
import { AuthView } from "./features/auth/AuthView";
import { Toaster } from "./components/ui/sonner";
import { Button } from "./components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAppState, identityActions } from "./infrastructure/store";
import { canAccessPage } from "./modules/identity/permissions";

function getInitialNav(role?: string) {
  const isCustomer = role === "CUSTOMER";
  const defaultTab: NavTab = isCustomer ? "portal" : "dashboard";
  if (typeof window === "undefined") {
    return { tab: defaultTab, quoteId: undefined, approvalId: undefined };
  }

  const params = new URLSearchParams(window.location.search);
  const rawTab = (params.get("tab") as NavTab) || (sessionStorage.getItem("df360_active_tab") as NavTab);
  const rawQuoteId = params.get("quoteId") || params.get("id") || sessionStorage.getItem("df360_quote_id");
  const rawApprovalId = params.get("approvalId") || sessionStorage.getItem("df360_approval_id");

  // STRICT RBAC CHECK: Validate tab against user's role permissions
  let safeTab: NavTab = defaultTab;
  if (rawTab && canAccessPage(role, rawTab)) {
    safeTab = rawTab;
  }

  const shouldHaveQuoteId = safeTab === "quotation-builder" || safeTab === "portal";
  const shouldHaveApprovalId = safeTab === "approvals";

  return {
    tab: safeTab,
    quoteId: shouldHaveQuoteId ? (rawQuoteId || undefined) : undefined,
    approvalId: shouldHaveApprovalId ? (rawApprovalId || undefined) : undefined,
  };
}

export default function App() {
  const state = useAppState();
  const session = state.session;
  const isCustomer = session?.role === "CUSTOMER";

  // Hydrate DB state on startup
  useEffect(() => {
    identityActions.syncWithDatabase();
  }, []);

  const initialNav = getInitialNav(session?.role);
  const [currentTab, setCurrentTab] = useState<NavTab>(initialNav.tab);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | undefined>(
    initialNav.quoteId,
  );
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | undefined>(
    initialNav.approvalId,
  );

  const syncUrlAndStorage = (tab: NavTab, quoteId?: string, approvalId?: string) => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams();
      params.set("tab", tab);

      // Only attach quoteId if on quotation-builder or portal
      const shouldHaveQuote = (tab === "quotation-builder" || tab === "portal") && Boolean(quoteId);
      if (shouldHaveQuote && quoteId) {
        params.set("quoteId", quoteId);
      }

      // Only attach approvalId if on approvals
      const shouldHaveApproval = tab === "approvals" && Boolean(approvalId);
      if (shouldHaveApproval && approvalId) {
        params.set("approvalId", approvalId);
      }

      // Only attach subtab if on admin
      if (tab === "admin") {
        const subtab = new URLSearchParams(window.location.search).get("subtab") || sessionStorage.getItem("df360_admin_subtab");
        if (subtab) {
          params.set("subtab", subtab);
        }
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);

      sessionStorage.setItem("df360_active_tab", tab);
      if (shouldHaveQuote && quoteId) {
        sessionStorage.setItem("df360_quote_id", quoteId);
      } else {
        sessionStorage.removeItem("df360_quote_id");
      }
      if (shouldHaveApproval && approvalId) {
        sessionStorage.setItem("df360_approval_id", approvalId);
      } else {
        sessionStorage.removeItem("df360_approval_id");
      }
    } catch {
      // ignore
    }
  };

  // Enforce authorized tab whenever session role changes or mounts
  useEffect(() => {
    if (session) {
      if (!canAccessPage(session.role, currentTab)) {
        const fallback = isCustomer ? "portal" : "dashboard";
        setCurrentTab(fallback);
        syncUrlAndStorage(fallback, selectedQuotationId, selectedApprovalId);
      } else {
        syncUrlAndStorage(currentTab, selectedQuotationId, selectedApprovalId);
      }
    }
  }, [session?.role]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const nav = getInitialNav(session?.role);
      setCurrentTab(nav.tab);
      setSelectedQuotationId(nav.quoteId);
      setSelectedApprovalId(nav.approvalId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [session?.role]);

  const handleNavigate = (tab: NavTab, extraId?: string) => {
    // STRICT RBAC CHECK: Prevent unauthorized tab navigation
    if (!canAccessPage(session?.role, tab)) {
      tab = isCustomer ? "portal" : "dashboard";
    }

    let nextQuoteId = selectedQuotationId;
    let nextApprovalId = selectedApprovalId;

    if (extraId) {
      if (tab === "approvals") {
        nextApprovalId = extraId;
        setSelectedApprovalId(extraId);
      } else {
        nextQuoteId = extraId;
        setSelectedQuotationId(extraId);
      }
    } else {
      if (tab !== "quotation-builder" && tab !== "portal") {
        nextQuoteId = undefined;
        setSelectedQuotationId(undefined);
      }
      if (tab !== "approvals") {
        nextApprovalId = undefined;
        setSelectedApprovalId(undefined);
      }
    }
    setCurrentTab(tab);
    syncUrlAndStorage(tab, nextQuoteId, nextApprovalId);

    window.scrollTo({ top: 0, behavior: "smooth" });
    const mainEl = document.getElementById("main-content");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isAuthorized = canAccessPage(session?.role, currentTab);

  return (
    <>
      {!session ? (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-center">
          <AuthView
            onSuccess={(user) => {
              if (user.role === "CUSTOMER") {
                handleNavigate("portal");
              } else {
                handleNavigate("dashboard");
              }
            }}
          />
        </div>
      ) : (
        <AppShell
          currentTab={currentTab}
          onSelectTab={handleNavigate}
          selectedQuotationId={selectedQuotationId}
        >
          {!isAuthorized ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
              <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4">
                <ShieldAlert className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Access Restricted</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Your role ({session?.role}) is not authorized to access this module.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => handleNavigate(isCustomer ? "portal" : "dashboard")}
              >
                Return to {isCustomer ? "Portal" : "Dashboard"}
              </Button>
            </div>
          ) : (
            <>
              {currentTab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}

              {currentTab === "quotations" && (
                <QuotationsListView
                  initialView="list"
                  onSelectQuote={(id) => handleNavigate("quotation-builder", id)}
                  onCreateNew={() => {
                    setSelectedQuotationId(undefined);
                    handleNavigate("quotation-builder");
                  }}
                />
              )}

              {currentTab === "pipeline" && (
                <QuotationsListView
                  initialView="pipeline"
                  onSelectQuote={(id) => handleNavigate("quotation-builder", id)}
                  onCreateNew={() => {
                    setSelectedQuotationId(undefined);
                    handleNavigate("quotation-builder");
                  }}
                />
              )}

              {currentTab === "quotation-builder" && (
                <QuotationBuilderView
                  quotationId={selectedQuotationId}
                  onBack={() => handleNavigate("quotations")}
                  onNavigateToApproval={() => handleNavigate("approvals")}
                />
              )}

              {currentTab === "approvals" && (
                <ApprovalsView
                  onOpenQuote={(quoteId) => handleNavigate("quotation-builder", quoteId)}
                  initialApprovalId={selectedApprovalId}
                />
              )}

              {currentTab === "fulfillment" && <FulfillmentView />}

              {currentTab === "subscriptions" && <SubscriptionsView />}

              {currentTab === "invoices" && <InvoicesView />}

              {currentTab === "deal-health" && (
                <DealHealthView
                  onOpenQuote={(quoteId) => handleNavigate("quotation-builder", quoteId)}
                />
              )}

              {currentTab === "reports" && <ReportingView />}

              {currentTab === "governance" && <AdminConfigView initialTab="governance" />}

              {currentTab === "warehouses" && <AdminConfigView initialTab="warehouses" />}

              {currentTab === "admin" && <AdminConfigView />}

              {currentTab === "portal" && (
                <CustomerPortalView initialQuoteId={selectedQuotationId} />
              )}

              {currentTab === "profile" && <ProfileView onNavigate={handleNavigate} />}
            </>
          )}
        </AppShell>
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}
