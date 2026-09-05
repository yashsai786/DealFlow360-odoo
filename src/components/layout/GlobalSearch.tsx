import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useAppState,
  customerMap,
  totalsOf,
} from "../../infrastructure/store";
import { type NavTab, canAccessPage } from "../../modules/identity/permissions";
import {
  Search,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Clock,
  X,
  Building2,
  CornerDownLeft,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "../ui/badge";

interface GlobalSearchProps {
  onSelectTab: (tab: NavTab, extraId?: string) => void;
}

export function GlobalSearch({ onSelectTab }: GlobalSearchProps) {
  const state = useAppState();
  const session = state.session;
  const isCustomer = session?.role === "CUSTOMER";
  const isSalesRep = session?.role === "SALES_REP";
  const customers = customerMap(state);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "quotations" | "approvals">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Quotations based on role and query
  const matchingQuotations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = state.quotations.filter((item) => {
      if (isCustomer) return item.customerId === session?.customerId;
      if (isSalesRep) return item.ownerId === session?.id;
      return true;
    });

    if (!q) {
      // Return top 4 recent quotes if no query
      return base.slice(0, 4);
    }

    return base.filter((item) => {
      const cust = customers[item.customerId];
      const matchNumber = item.number.toLowerCase().includes(q);
      const matchCustomer = cust?.name.toLowerCase().includes(q);
      const matchStage = item.stage.toLowerCase().includes(q);
      const matchLines = item.lines.some((l) => l.productId.toLowerCase().includes(q));
      return matchNumber || matchCustomer || matchStage || matchLines;
    }).slice(0, 6);
  }, [state.quotations, query, isCustomer, isSalesRep, session, customers]);

  // Filter Approvals based on role and query
  const matchingApprovals = useMemo(() => {
    // Customers cannot access internal approvals
    if (isCustomer) return [];

    const q = query.trim().toLowerCase();
    const base = state.approvals.filter((app) => {
      if (isSalesRep) {
        const quote = state.quotations.find((x) => x.id === app.quotationId);
        return quote?.ownerId === session?.id;
      }
      return true;
    });

    if (!q) {
      // Return pending approvals first, up to 4
      return base
        .sort((a, b) => (a.status === "PENDING" ? -1 : 1))
        .slice(0, 4);
    }

    return base.filter((app) => {
      const quote = state.quotations.find((x) => x.id === app.quotationId);
      const cust = quote ? customers[quote.customerId] : null;
      const matchQuote = quote?.number.toLowerCase().includes(q);
      const matchCust = cust?.name.toLowerCase().includes(q);
      const matchRisk = app.riskLevel.toLowerCase().includes(q);
      const matchStatus = app.status.toLowerCase().includes(q);
      const matchId = app.id.toLowerCase().includes(q);
      const matchSteps = app.steps.some((s) => s.role.toLowerCase().includes(q));
      return matchQuote || matchCust || matchRisk || matchStatus || matchId || matchSteps;
    }).slice(0, 6);
  }, [state.approvals, state.quotations, query, isCustomer, isSalesRep, session, customers]);

  const displayedQuotations = activeFilter === "approvals" ? [] : matchingQuotations;
  const displayedApprovals = activeFilter === "quotations" ? [] : matchingApprovals;

  const totalResultsCount = displayedQuotations.length + displayedApprovals.length;

  // Handle Selection
  const handleSelectQuotation = (quoteId: string) => {
    if (isCustomer) {
      onSelectTab("portal", quoteId);
    } else {
      onSelectTab("quotation-builder", quoteId);
    }
    setIsOpen(false);
    setQuery("");
  };

  const handleSelectApproval = (approvalId: string) => {
    onSelectTab("approvals", approvalId);
    setIsOpen(false);
    setQuery("");
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const allItems: Array<{ type: "quote" | "approval"; id: string }> = [
      ...displayedQuotations.map((q) => ({ type: "quote" as const, id: q.id })),
      ...displayedApprovals.map((a) => ({ type: "approval" as const, id: a.id })),
    ];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(allItems.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(allItems.length, 1));
    } else if (e.key === "Enter" && allItems.length > 0) {
      e.preventDefault();
      const target = allItems[selectedIndex];
      if (target) {
        if (target.type === "quote") handleSelectQuotation(target.id);
        else handleSelectApproval(target.id);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            isCustomer
              ? "Search your quotations..."
              : "Search quotations, approvals... (⌘K)"
          }
          className="h-8 w-full rounded-md border border-input bg-background/80 px-8 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors shadow-xs"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <div className="absolute right-2 hidden sm:flex items-center gap-0.5 pointer-events-none">
            <kbd className="inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-90">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          </div>
        )}
      </div>

      {/* Live Search Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header filter pills */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 text-[11px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  activeFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("quotations")}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  activeFilter === "quotations"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                Quotations ({matchingQuotations.length})
              </button>
              {!isCustomer && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("approvals")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    activeFilter === "approvals"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Approvals ({matchingApprovals.length})
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
              Press <kbd className="font-mono bg-muted px-1 rounded border border-border">ESC</kbd> to exit
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5 space-y-3">
            {/* Quotations Section */}
            {displayedQuotations.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-primary" />
                    Quotations
                  </span>
                  <span className="text-[9px] font-normal lowercase">{displayedQuotations.length} items</span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {displayedQuotations.map((quote) => {
                    const cust = customers[quote.customerId];
                    const totals = totalsOf(state, quote);
                    return (
                      <div
                        key={quote.id}
                        onClick={() => handleSelectQuotation(quote.id)}
                        className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/70 cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                            Q
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
                                {quote.number}
                              </span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal uppercase">
                                {quote.stage.replace("_", " ")}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <Building2 className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{cust?.name ?? "Unknown Customer"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="font-semibold text-foreground font-mono text-[11px]">
                            ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Approvals Section */}
            {displayedApprovals.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between border-t border-border pt-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3 text-amber-500" />
                    Approvals & Governance
                  </span>
                  <span className="text-[9px] font-normal lowercase">{displayedApprovals.length} items</span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {displayedApprovals.map((app) => {
                    const quote = state.quotations.find((x) => x.id === app.quotationId);
                    const cust = quote ? customers[quote.customerId] : null;
                    const nextStep = app.steps.find((s) => s.status === "PENDING");

                    return (
                      <div
                        key={app.id}
                        onClick={() => handleSelectApproval(app.id)}
                        className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/70 cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-7 w-7 rounded flex items-center justify-center shrink-0 ${
                              app.status === "APPROVED"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : app.status === "REJECTED"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {app.status === "APPROVED" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : app.status === "REJECTED" ? (
                              <XCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
                                {quote?.number ?? app.id}
                              </span>
                              <Badge
                                variant={app.riskLevel === "HIGH" ? "destructive" : "secondary"}
                                className="text-[9px] py-0 px-1 font-mono uppercase"
                              >
                                {app.riskLevel} Risk
                              </Badge>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal uppercase">
                                {app.status}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {cust?.name ?? "Customer Account"} • Next: {nextStep?.role.replace("_", " ") ?? "Complete"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(app.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalResultsCount === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                <Search className="h-6 w-6 mx-auto opacity-30 mb-1" />
                <p className="font-medium text-foreground">No matching results found</p>
                <p className="text-[11px]">
                  No quotations or approvals matched &ldquo;{query}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Quick Navigation Footer */}
          <div className="border-t border-border bg-muted/20 px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-2.5 w-2.5" /> to open
              </span>
              <span>•</span>
              <span>↑↓ to navigate</span>
            </div>
            {canAccessPage(session?.role, "quotations") && (
              <button
                type="button"
                onClick={() => {
                  onSelectTab("quotations");
                  setIsOpen(false);
                }}
                className="hover:text-primary transition-colors font-medium"
              >
                View all quotations →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
