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
import { useAppState } from "./infrastructure/store";

export default function App() {
  const state = useAppState();
  const session = state.session;
  const isCustomer = session?.role === "CUSTOMER";

  const [currentTab, setCurrentTab] = useState<NavTab>(
    isCustomer ? "portal" : "dashboard",
  );
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | undefined>(
    "q-1041",
  );

  // Auto-switch to customer portal if user switches to a customer role
  useEffect(() => {
    if (isCustomer && currentTab !== "portal" && currentTab !== "profile") {
      setCurrentTab("portal");
    } else if (!isCustomer && currentTab === "portal") {
      setCurrentTab("dashboard");
    }
  }, [isCustomer, currentTab]);

  const handleNavigate = (tab: NavTab, extraId?: string) => {
    if (extraId) {
      setSelectedQuotationId(extraId);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
          {currentTab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}

          {currentTab === "quotations" && (
            <QuotationsListView
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

          {currentTab === "admin" && <AdminConfigView />}

          {currentTab === "portal" && <CustomerPortalView />}

          {currentTab === "profile" && <ProfileView onNavigate={handleNavigate} />}
        </AppShell>
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}
