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

  // Automatically enforce the effective authorized tab without showing restricted barrier
  const safeTab: NavTab = canAccessPage(session?.role, currentTab)
    ? currentTab
    : (isCustomer ? "portal" : "dashboard");

  // Keep state, URL, and storage in sync whenever safeTab differs from currentTab
  useEffect(() => {
    if (session && currentTab !== safeTab) {
      setCurrentTab(safeTab);
      syncUrlAndStorage(safeTab, selectedQuotationId, selectedApprovalId);
    }
  }, [session, currentTab, safeTab, selectedQuotationId, selectedApprovalId]);

  return (
    <>
      {!session ? (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-center">
          <AuthView
            onSuccess={(user) => {
              const target = user.role === "CUSTOMER" ? "portal" : "dashboard";
              handleNavigate(target);
            }}
          />
        </div>
      ) : (
        <AppShell
          currentTab={safeTab}
          onSelectTab={handleNavigate}
          selectedQuotationId={selectedQuotationId}
        >
          {safeTab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}

          {safeTab === "quotations" && (
            <QuotationsListView
              initialView="list"
              onSelectQuote={(id) => handleNavigate("quotation-builder", id)}
              onCreateNew={() => {
                setSelectedQuotationId(undefined);
                handleNavigate("quotation-builder");
              }}
            />
          )}

          {safeTab === "pipeline" && (
            <QuotationsListView
              initialView="pipeline"
              onSelectQuote={(id) => handleNavigate("quotation-builder", id)}
              onCreateNew={() => {
                setSelectedQuotationId(undefined);
                handleNavigate("quotation-builder");
              }}
            />
          )}

          {safeTab === "quotation-builder" && (
            <QuotationBuilderView
              quotationId={selectedQuotationId}
              onBack={() => handleNavigate("quotations")}
              onNavigateToApproval={() => handleNavigate("approvals")}
            />
          )}

          {safeTab === "approvals" && (
            <ApprovalsView
              onOpenQuote={(quoteId) => handleNavigate("quotation-builder", quoteId)}
              initialApprovalId={selectedApprovalId}
            />
          )}

          {safeTab === "fulfillment" && <FulfillmentView />}

          {safeTab === "subscriptions" && <SubscriptionsView />}

          {safeTab === "invoices" && <InvoicesView />}

          {safeTab === "deal-health" && (
            <DealHealthView
              onOpenQuote={(quoteId) => handleNavigate("quotation-builder", quoteId)}
            />
          )}

          {safeTab === "reports" && <ReportingView />}

          {safeTab === "governance" && <AdminConfigView initialTab="governance" />}

          {safeTab === "warehouses" && <AdminConfigView initialTab="warehouses" />}

          {safeTab === "admin" && <AdminConfigView />}

          {safeTab === "portal" && (
            <CustomerPortalView initialQuoteId={selectedQuotationId} />
          )}

          {safeTab === "profile" && <ProfileView onNavigate={handleNavigate} />}
        </AppShell>
      )}
      <Toaster richColors position="top-right" />
    </>
  );
}
