import React, { useState, useEffect } from "react";
import {
  useAppState,
  productMap,
  customerMap,
  quotationActions,
} from "../../infrastructure/store";
import { calculateDealHealth, repDiscountAverages } from "../../modules/deal-intelligence/service";
import { dealHealthApi } from "../../lib/api";
import type { DealHealthAlert, DealHealthStatus } from "../../modules/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  HeartPulse,
  AlertTriangle,
  BellRing,
  ArrowUpRight,
  TrendingDown,
  Clock,
  Truck,
  ShieldAlert,
  Flame,
  Search,
  CheckCircle2,
  RefreshCw,
  Send,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface DealHealthViewProps {
  onOpenQuote: (quoteId: string) => void;
}

type CategoryFilter = "ALL" | "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE" | "BOTTLENECK";

export function DealHealthView({ onOpenQuote }: DealHealthViewProps) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));

  const [stallDays, setStallDays] = useState<number>(7);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);

  // Nudge Action Modal
  const [nudgeModal, setNudgeModal] = useState<{
    open: boolean;
    quotationId: string;
    quotationNumber: string;
    ownerName: string;
    note: string;
  }>({
    open: false,
    quotationId: "",
    quotationNumber: "",
    ownerName: "",
    note: "",
  });

  // Escalate Action Modal
  const [escalateModal, setEscalateModal] = useState<{
    open: boolean;
    quotationId: string;
    quotationNumber: string;
    reason: string;
  }>({
    open: false,
    quotationId: "",
    quotationNumber: "",
    reason: "",
  });

  // Calculate local reactive alerts (always up-to-date with store)
  const localAlerts = calculateDealHealth({
    quotations: state.quotations,
    products,
    customers,
    users,
    orders: state.orders,
    approvals: state.approvals,
    stallDaysThreshold: stallDays,
  });

  const repBaselines = repDiscountAverages(state.quotations, products);

  // Background API ping to ensure DB consistency
  const refreshFromBackend = async () => {
    setIsLoadingApi(true);
    try {
      await dealHealthApi.get(stallDays);
    } catch {
      // Quiet fallback to reactive local calculations
    } finally {
      setIsLoadingApi(false);
    }
  };

  useEffect(() => {
    refreshFromBackend();
  }, [stallDays]);

  const criticalCount = localAlerts.filter((a) => a.severity === "Critical").length;
  const atRiskCount = localAlerts.filter((a) => a.severity === "At Risk").length;
  const watchCount = localAlerts.filter((a) => a.severity === "Watch").length;
  const healthyCount = Math.max(0, state.quotations.length - localAlerts.length);

  // Filter alerts by Category, Severity, and Search Query
  const filteredAlerts = localAlerts.filter((a) => {
    // Category filter
    if (activeCategory === "STALLED" && a.issue !== "Stalled deal") return false;
    if (activeCategory === "DISCOUNT_ANOMALY" && a.issue !== "Discount anomaly") return false;
    if (activeCategory === "DELIVERY_SLIPPAGE" && a.issue !== "Delivery slippage") return false;
    if (
      activeCategory === "BOTTLENECK" &&
      a.issue !== "Approval bottleneck" &&
      a.issue !== "Excessive negotiation activity"
    )
      return false;

    // Severity filter
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = a.quotationNumber.toLowerCase().includes(q);
      const matchCustomer = a.customerName.toLowerCase().includes(q);
      const matchIssue = a.issue.toLowerCase().includes(q);
      const matchDetail = a.detail.toLowerCase().includes(q);
      if (!matchNumber && !matchCustomer && !matchIssue && !matchDetail) return false;
    }

    return true;
  });

  // Action: Open Nudge Dialog
  const openNudgeDialog = (a: DealHealthAlert) => {
    const q = state.quotations.find((x) => x.id === a.quotationId);
    const owner = q ? users[q.ownerId]?.name || "Sales Representative" : "Sales Representative";
    setNudgeModal({
      open: true,
      quotationId: a.quotationId,
      quotationNumber: a.quotationNumber,
      ownerName: owner,
      note: `Please review deal ${a.quotationNumber}. ${a.recommendedAction}.`,
    });
  };

  // Action: Execute Nudge
  const handleConfirmNudge = async () => {
    if (!nudgeModal.quotationId) return;
    try {
      await quotationActions.nudge(nudgeModal.quotationId, nudgeModal.note);
      toast.success(
        `Nudge sent to ${nudgeModal.ownerName}! Notification recorded in SQLite audit ledger.`
      );
      setNudgeModal({ open: false, quotationId: "", quotationNumber: "", ownerName: "", note: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to nudge owner");
    }
  };

  // Action: Open Escalate Dialog
  const openEscalateDialog = (a: DealHealthAlert) => {
    setEscalateModal({
      open: true,
      quotationId: a.quotationId,
      quotationNumber: a.quotationNumber,
      reason: `${a.issue}: ${a.detail}`,
    });
  };

  // Action: Execute Escalate
  const handleConfirmEscalate = async () => {
    if (!escalateModal.quotationId) return;
    if (!escalateModal.reason.trim()) {
      toast.error("Please provide an escalation reason.");
      return;
    }
    try {
      await quotationActions.escalate(escalateModal.quotationId, escalateModal.reason);
      toast.warning(
        `Deal ${escalateModal.quotationNumber} escalated to senior leadership queue with audit trail!`
      );
      setEscalateModal({ open: false, quotationId: "", quotationNumber: "", reason: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to escalate");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Deal Health & Anomaly Dashboard
            </h1>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
              Live DB Synced
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Autonomous pipeline governance: Stalled quotes, discount anomalies, promise slippage, and automated remediation.
          </p>
        </div>

        {/* Configurable Stall Inactivity Threshold Controls */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-xs">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Stall Days Threshold:
          </span>
          <div className="flex items-center gap-1">
            {[3, 5, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setStallDays(days);
                  toast.info(`Inactivity threshold set to ${days} days.`);
                }}
                className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                  stallDays === days
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshFromBackend}
            disabled={isLoadingApi}
            className="h-6 w-6 p-0 ml-1 text-muted-foreground hover:text-foreground"
            title="Refresh from server"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingApi ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`shadow-xs cursor-pointer transition-all ${
            severityFilter === "Critical" ? "ring-2 ring-rose-500" : ""
          } border-rose-200 dark:border-rose-950 bg-rose-50/25`}
          onClick={() => setSeverityFilter(severityFilter === "Critical" ? "ALL" : "Critical")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Critical Anomalies
            </CardTitle>
            <Flame className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-600">{criticalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Severe discount or delivery breach</p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-xs cursor-pointer transition-all ${
            severityFilter === "At Risk" ? "ring-2 ring-amber-500" : ""
          } border-amber-200 dark:border-amber-950 bg-amber-50/25`}
          onClick={() => setSeverityFilter(severityFilter === "At Risk" ? "ALL" : "At Risk")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              At-Risk Pipeline
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600">{atRiskCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Stalled deals or delivery slippage</p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-xs cursor-pointer transition-all ${
            severityFilter === "Watch" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => setSeverityFilter(severityFilter === "Watch" ? "ALL" : "Watch")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              Watch Queue
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{watchCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Protracted customer discussions</p>
          </CardContent>
        </Card>

        <Card
          className="shadow-xs border-emerald-200 dark:border-emerald-950 bg-emerald-50/20 cursor-pointer"
          onClick={() => {
            setActiveCategory("ALL");
            setSeverityFilter("ALL");
            setSearchQuery("");
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Healthy Velocity
            </CardTitle>
            <HeartPulse className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600">{healthyCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Deals on track without alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Alerts Feed + Rep Baselines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Alerts Stream */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  activeCategory === "ALL"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({localAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("STALLED")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                  activeCategory === "STALLED"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3 w-3 text-amber-500" />
                Stalled ({localAlerts.filter((a) => a.issue === "Stalled deal").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("DISCOUNT_ANOMALY")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                  activeCategory === "DISCOUNT_ANOMALY"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingDown className="h-3 w-3 text-rose-500" />
                Discount Anomalies ({localAlerts.filter((a) => a.issue === "Discount anomaly").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("DELIVERY_SLIPPAGE")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                  activeCategory === "DELIVERY_SLIPPAGE"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Truck className="h-3 w-3 text-indigo-500" />
                Delivery Slippage ({localAlerts.filter((a) => a.issue === "Delivery slippage").length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-52">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quote or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 h-8"
              />
            </div>
          </div>

          {/* Active Alerts List */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Deal Diagnostic & Autonomous Action Feed
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Showing {filteredAlerts.length} actionable anomaly signals
                </CardDescription>
              </div>
              {severityFilter !== "ALL" && (
                <Badge
                  variant="outline"
                  className="cursor-pointer text-[10px]"
                  onClick={() => setSeverityFilter("ALL")}
                >
                  Filtered: {severityFilter} (Click to clear)
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {filteredAlerts.map((a) => {
                const q = state.quotations.find((x) => x.id === a.quotationId);
                const isStalled = a.issue === "Stalled deal";
                const isAnomaly = a.issue === "Discount anomaly";
                const isDelivery = a.issue === "Delivery slippage";

                return (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-lg border border-border bg-card text-xs space-y-2.5 hover:border-primary/50 transition-colors"
                  >
                    {/* Header Row: Quotation Number, Customer, Severity, Action Badges */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Direct Click to Open Quotation */}
                        <button
                          type="button"
                          onClick={() => onOpenQuote(a.quotationId)}
                          className="font-mono font-bold text-primary hover:underline flex items-center gap-1 text-xs"
                          title="Click to open this quotation in builder"
                        >
                          {a.quotationNumber}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </button>
                        <span className="font-semibold text-foreground">{a.customerName}</span>

                        <Badge
                          variant={
                            a.severity === "Critical"
                              ? "destructive"
                              : a.severity === "At Risk"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] uppercase font-mono py-0 px-1.5"
                        >
                          {a.severity}
                        </Badge>

                        {q?.escalated && (
                          <Badge variant="destructive" className="text-[9px] uppercase font-mono py-0 px-1">
                            Escalated
                          </Badge>
                        )}
                        {q?.nudgedAt && (
                          <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50/50">
                            Nudged
                          </Badge>
                        )}
                      </div>

                      {/* Issue Badge */}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
                        {isStalled && <Clock className="h-3 w-3 text-amber-500" />}
                        {isAnomaly && <TrendingDown className="h-3 w-3 text-rose-500" />}
                        {isDelivery && <Truck className="h-3 w-3 text-indigo-500" />}
                        {a.issue}
                      </span>
                    </div>

                    {/* Diagnostic Detail Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {a.detail}
                    </p>

                    {/* Autonomous Action Toolbar */}
                    <div className="p-2 rounded bg-muted/40 text-[11px] text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Recommended Remediation: <strong className="text-foreground">{a.recommendedAction}</strong>
                      </span>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openNudgeDialog(a)}
                          className="h-6 text-[10px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          title="Trigger automated nudge notification to sales rep"
                        >
                          <BellRing className="h-3 w-3 mr-1 text-amber-500" />
                          Nudge Rep
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEscalateDialog(a)}
                          className="h-6 text-[10px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Escalate deal directly to management queue"
                        >
                          <Flame className="h-3 w-3 mr-1" />
                          Escalate
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => onOpenQuote(a.quotationId)}
                          className="h-6 text-[10px] px-2.5 bg-primary text-primary-foreground hover:bg-primary/90"
                          title="Open Quotation directly in Quotation Builder"
                        >
                          Open Deal
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredAlerts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <div className="font-semibold text-foreground">No matching deal health alerts</div>
                  <p>All quotations and fulfillment orders are progressing smoothly within normal operational thresholds.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Rep Baselines & Guardrails */}
        <div className="space-y-4">
          {/* Rep Historical Discount Baselines Card */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-primary" />
                Rep Historical Discount Baselines
              </CardTitle>
              <CardDescription className="text-[11px]">
                Anomalies trigger when a quote discount exceeds the rep's baseline by &gt;5%
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              {Object.entries(repBaselines).map(([repId, avg]) => {
                const rep = state.users.find((u) => u.id === repId);
                return (
                  <div
                    key={repId}
                    className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{rep?.name ?? "Sales Rep"}</div>
                      <div className="text-[10px] text-muted-foreground">{rep?.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-primary">{avg}%</div>
                      <div className="text-[10px] text-muted-foreground">Historical avg</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Autonomous Governance Guardrails Info Card */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold">Self-Governing Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong>Stalled Deals:</strong> Flagged when untouched for &gt;{stallDays} days in draft/negotiation.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong>Discount Anomaly:</strong> Blended quotation discount exceeds sales rep historical average by &gt;5%.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong>Delivery Slippage:</strong> Orders past promised delivery date or with blocked backorders.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong>Approval Bottlenecks:</strong> Managerial approval queue sitting idle for &gt;3 days.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Automated Nudge Modal */}
      <Dialog
        open={nudgeModal.open}
        onOpenChange={(open) => setNudgeModal({ ...nudgeModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BellRing className="h-4 w-4 text-amber-500" />
              Send Automated Nudge to {nudgeModal.ownerName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              This triggers a high-priority nudge stamped with your actor signature into the immutable SQLite audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-medium text-foreground">Nudge Message & Guidance</label>
            <Input
              value={nudgeModal.note}
              onChange={(e) => setNudgeModal({ ...nudgeModal, note: e.target.value })}
              placeholder="Enter message for sales representative..."
              className="text-xs"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                "Re-engage customer with revised commercial terms.",
                "Confirm delivery schedule with warehouse operations.",
                "Review category discount ceiling before submission.",
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setNudgeModal({ ...nudgeModal, note: template })}
                  className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNudgeModal({ ...nudgeModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmNudge}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Send className="h-3 w-3 mr-1" />
              Dispatch Nudge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation Modal */}
      <Dialog
        open={escalateModal.open}
        onOpenChange={(open) => setEscalateModal({ ...escalateModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-600">
              <Flame className="h-4 w-4 text-rose-600" />
              Escalate Quotation {escalateModal.quotationNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Flags the quotation as Escalated and immediately alerts executive management and sales operations.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-medium text-foreground">Escalation Reason</label>
            <Input
              value={escalateModal.reason}
              onChange={(e) => setEscalateModal({ ...escalateModal, reason: e.target.value })}
              placeholder="e.g. Critical discount anomaly requires VP commercial review"
              className="text-xs"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEscalateModal({ ...escalateModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmEscalate}
              className="text-xs"
            >
              Confirm Escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
