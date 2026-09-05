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

export default function App() {
  const state = useAppState();
  const session = state.session;
  const isCustomer = session?.role === "CUSTOMER";

  // Hydrate DB state on startup
  useEffect(() => {
    identityActions.syncWithDatabase();
  }, []);

  const [currentTab, setCurrentTab] = useState<NavTab>(
    isCustomer ? "portal" : "dashboard",
  );
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | undefined>(
    "q-1041",
  );

  // Auto-switch to authorized tab if user switches role
  useEffect(() => {
    if (session) {
      if (!canAccessPage(session.role, currentTab)) {
        setCurrentTab(isCustomer ? "portal" : "dashboard");
      }
    }
  }, [session?.role, isCustomer, currentTab]);

  const handleNavigate = (tab: NavTab, extraId?: string) => {
    if (extraId) {
      setSelectedQuotationId(extraId);
    }
    setCurrentTab(tab);
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

              {currentTab === "portal" && <CustomerPortalView />}

              {currentTab === "profile" && <ProfileView onNavigate={handleNavigate} />}
            </>
          )}
        </AppShell>
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}
