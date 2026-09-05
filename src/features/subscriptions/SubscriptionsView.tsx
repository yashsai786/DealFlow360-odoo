import React, { useState } from "react";
import {
  useAppState,
  customerMap,
  billingActions,
} from "../../infrastructure/store";
import {
  calculateBillingSchedule,
  calculateProration,
  calculateCancellationRefund,
  classifyOrderLines,
  CYCLE_DAYS,
} from "../../modules/billing/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Repeat,
  Calendar,
  Layers,
  PauseCircle,
  PlayCircle,
  XCircle,
  TrendingUp,
  AlertCircle,
  PackageCheck,
  Receipt,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Clock,
  ShieldCheck,
  FileText,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { canPerformAction } from "../../modules/identity/permissions";

export function SubscriptionsView() {
  const state = useAppState();
  const customers = customerMap(state);
  const session = state.session;
  const canManageBilling = canPerformAction(session?.role, "billing.manage");

  const [selectedSubId, setSelectedSubId] = useState<string>(
    state.subscriptions[0]?.id ?? "",
  );
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  const selectedSub = state.subscriptions.find((s) => s.id === selectedSubId);
  const plan = selectedSub
    ? state.plans.find((p) => p.id === selectedSub.planId)
    : null;
  const customer = selectedSub ? customers[selectedSub.customerId] : null;

  // Proration simulator input
  const [newSeatCount, setNewSeatCount] = useState<number>(selectedSub?.qty ?? 1);

  // Sync newSeatCount when selected subscription changes
  React.useEffect(() => {
    if (selectedSub) {
      setNewSeatCount(selectedSub.qty);
      setShowCancelModal(false);
    }
  }, [selectedSub?.id]);

  const prorationPreview = selectedSub
    ? calculateProration(selectedSub, newSeatCount, selectedSub.unitPrice, plan)
    : null;

  const schedule = selectedSub ? calculateBillingSchedule(selectedSub, 6) : [];

  // Order breakdown (One-Time Lines vs Recurring Lines within the same order)
  const associatedQuotation = selectedSub
    ? state.quotations.find((q) => q.id === selectedSub.quotationId)
    : null;

  const orderClassification = associatedQuotation
    ? classifyOrderLines(associatedQuotation, state.products)
    : null;

  // Cancellation & Refund Calculation
  const cancelPreview = selectedSub
    ? calculateCancellationRefund(selectedSub, plan)
    : null;

  // Aggregate metrics
  const activeSubs = state.subscriptions.filter((s) => s.status === "ACTIVE");
  const totalMRR = activeSubs.reduce((sum, s) => {
    const monthlyRate = s.cycle === "Monthly" ? s.qty * s.unitPrice : (s.qty * s.unitPrice) / (s.cycle === "Quarterly" ? 3 : 12);
    return sum + monthlyRate;
  }, 0);
  const totalARR = totalMRR * 12;
  const totalCommittedSeats = activeSubs.reduce((sum, s) => sum + s.qty, 0);

  const handleModifySeats = async () => {
    if (!selectedSub) return;
    try {
      const res = await billingActions.modifySubscription(selectedSub.id, newSeatCount);
      if (res?.kind === "CHARGE") {
        toast.success(
          `Committed seats increased to ${newSeatCount}! Interim prorated charge of ₹${res.difference.toFixed(2)} applied.`,
        );
      } else if (res?.kind === "CREDIT") {
        toast.success(
          `Committed seats reduced to ${newSeatCount}! Automatic Credit Note of ₹${Math.abs(res.difference).toFixed(2)} issued to customer account.`,
        );
      } else {
        toast.info("Seat count updated. Modification will take effect on next billing cycle.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to modify subscription");
    }
  };

  const handleSetStatus = async (status: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    if (!selectedSub) return;
    try {
      if (status === "CANCELLED") {
        const refund = calculateCancellationRefund(selectedSub, plan);
        await billingActions.setSubscriptionStatus(selectedSub.id, status);
        setShowCancelModal(false);
        if (refund.isRefundable) {
          toast.success(
            `Contract cancelled. Automatic Credit Note of ₹${refund.refundAmount.toFixed(2)} issued (${refund.refundRatePct}% for ${refund.daysRemaining} remaining days).`,
          );
        } else {
          toast.success(`Subscription contract cancelled (${refund.policyNotes}).`);
        }
      } else {
        await billingActions.setSubscriptionStatus(selectedSub.id, status);
        toast.success(`Subscription marked as ${status}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Days calculations for visual cycle progress bar
  const daysInCycle = selectedSub ? CYCLE_DAYS[selectedSub.cycle] || 30 : 30;
  const daysRemaining = prorationPreview?.daysRemaining ?? 0;
  const daysElapsed = Math.max(0, daysInCycle - daysRemaining);
  const cyclePercent = Math.min(100, Math.max(0, Math.round((daysElapsed / daysInCycle) * 100)));

  return (
    <div className="space-y-6">
      {/* Header & Global KPIs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" />
            Subscriptions & Recurring Billing
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hybrid contracts, separate one-time vs recurring line billing, multi-cycle scheduling, mid-cycle seat proration, and policy-driven credit notes.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="px-3 py-2 rounded-lg border border-border bg-card">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Active Contracts</div>
            <div className="text-lg font-bold text-foreground font-mono">{activeSubs.length}</div>
          </div>
          <div className="px-3 py-2 rounded-lg border border-border bg-card">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Committed Seats</div>
            <div className="text-lg font-bold text-foreground font-mono">{totalCommittedSeats}</div>
          </div>
          <div className="px-3 py-2 rounded-lg border border-border bg-card">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Monthly MRR</div>
            <div className="text-lg font-bold text-primary font-mono">₹{Math.round(totalMRR).toLocaleString()}</div>
          </div>
          <div className="px-3 py-2 rounded-lg border border-border bg-card">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Annual ARR</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">₹{Math.round(totalARR).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Contracts List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Repeat className="h-4 w-4 text-primary" />
                  Subscription Contracts ({state.subscriptions.length})
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Live Sync
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              {state.subscriptions.map((s) => {
                const cust = customers[s.customerId];
                const p = state.plans.find((pl) => pl.id === s.planId);
                const active = s.id === selectedSubId;
                const mrr = s.cycle === "Monthly" ? s.qty * s.unitPrice : Math.round((s.qty * s.unitPrice) / 12);

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSubId(s.id);
                    }}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-sm font-bold text-foreground">{cust?.name ?? "Customer"}</span>
                      <Badge
                        variant={
                          s.status === "ACTIVE"
                            ? "secondary"
                            : s.status === "PAUSED"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-[9px] uppercase font-mono py-0.5 px-1.5"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                      <span>{p?.name ?? "Cloud Care"}</span>
                      <span className="font-medium text-foreground">{s.qty} seats</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] font-mono py-0 px-1">
                          {s.cycle}
                        </Badge>
                        <span className="font-mono font-medium text-foreground">
                          ₹{Math.round(mrr).toLocaleString()} / mo
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        Next: {new Date(s.nextBillDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Selected Contract Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSub && customer ? (
            <>
              {/* Contract Control Header Card */}
              <Card className="shadow-xs border-primary/20">
                <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg font-bold text-foreground">
                        {customer.name}
                      </CardTitle>
                      <Badge
                        variant={
                          selectedSub.status === "ACTIVE"
                            ? "secondary"
                            : selectedSub.status === "PAUSED"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-xs uppercase font-mono"
                      >
                        {selectedSub.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {selectedSub.cycle} Cadence
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        ID: {selectedSub.id}
                      </span>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Plan: <strong className="text-foreground">{plan?.name}</strong> · Rate:{" "}
                      <span className="font-mono font-medium text-foreground">
                        ₹{selectedSub.unitPrice} / seat / {selectedSub.cycle === "Monthly" ? "mo" : selectedSub.cycle === "Quarterly" ? "qtr" : "yr"}
                      </span>{" "}
                      · Next Renewal:{" "}
                      <strong className="text-foreground">{new Date(selectedSub.nextBillDate).toLocaleDateString()}</strong>
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageBilling ? (
                      <>
                        {selectedSub.status === "ACTIVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetStatus("PAUSED")}
                            className="h-8 text-xs gap-1.5"
                          >
                            <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Pause</span>
                          </Button>
                        )}
                        {selectedSub.status === "PAUSED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetStatus("ACTIVE")}
                            className="h-8 text-xs gap-1.5"
                          >
                            <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Resume</span>
                          </Button>
                        )}
                        {selectedSub.status === "CANCELLED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetStatus("ACTIVE")}
                            className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reactivate Contract</span>
                          </Button>
                        )}
                        {selectedSub.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCancelModal(!showCancelModal)}
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1.5"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Cancel Subscription</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Read-Only Contract
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* Inline Cancellation / Refund Confirmation Drawer */}
                {showCancelModal && selectedSub.status !== "CANCELLED" && cancelPreview && (
                  <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          Confirm Contract Cancellation & Automatic Refund / Credit Note
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Review policy terms and calculated credit note refund before terminating this active contract.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCancelModal(false)}
                        className="h-6 w-6 p-0 text-muted-foreground"
                      >
                        ✕
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-background border border-border text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Policy Terms</span>
                        <strong className="text-foreground text-[11px]">{plan?.cancellationPolicy ?? "Standard Proration"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Unearned Cycle Days</span>
                        <span className="font-mono text-foreground font-semibold">
                          {cancelPreview.daysRemaining} of {cancelPreview.daysInCycle} days remaining
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Credit Note Trigger</span>
                        <strong className="text-emerald-600 font-mono text-sm">
                          {cancelPreview.isRefundable
                            ? `₹${cancelPreview.refundAmount.toFixed(2)} (${cancelPreview.refundRatePct}% refund)`
                            : "₹0.00 (Non-refundable)"}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelModal(false)}
                        className="h-7 text-xs"
                      >
                        Keep Subscription
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleSetStatus("CANCELLED")}
                        className="h-7 text-xs gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Confirm & {cancelPreview.isRefundable ? "Issue Credit Note" : "Cancel"}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              {/* REQUIREMENT 1: Order Contract Breakdown (One-Time Lines vs Recurring Lines within the Same Order) */}
              <Card className="shadow-xs">
                <CardHeader className="p-4 pb-3 border-b border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Order Contract Breakdown (Hybrid Order Lines)
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Separation of one-time capital charges from recurring subscription schedules within Order{" "}
                        <strong className="text-foreground">{associatedQuotation?.number ?? selectedSub.quotationId}</strong>.
                      </CardDescription>
                    </div>

                    {associatedQuotation && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          Stage: {associatedQuotation.stage}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          Total Initial Value: ₹{orderClassification?.totalOrderInitialValue.toLocaleString() ?? "0"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-6">
                  {orderClassification ? (
                    <>
                      {/* One-Time Lines Panel */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                              One-Time Line Items (Hardware & Services)
                            </span>
                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 font-mono py-0 px-1.5">
                              Billed Once
                            </Badge>
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground">
                            Subtotal: ₹{orderClassification.oneTimeTotal.toLocaleString()}
                          </span>
                        </div>

                        {orderClassification.oneTimeLines.length > 0 ? (
                          <div className="rounded-md border border-border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-[11px] bg-muted/30">
                                  <TableHead>Product / Service Item</TableHead>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Discount</TableHead>
                                  <TableHead className="text-right">Tax</TableHead>
                                  <TableHead className="text-right">Line Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-xs">
                                {orderClassification.oneTimeLines.map((line) => (
                                  <TableRow key={line.id}>
                                    <TableCell className="font-medium text-foreground">
                                      {line.productName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-[9px] font-mono py-0 px-1">
                                        {line.category}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      ₹{line.unitPrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                      {line.qty} {line.unit}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">
                                      {line.discountPct > 0 ? `${line.discountPct}%` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">
                                      {line.taxPct}%
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-foreground">
                                      ₹{line.total.toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="p-3 rounded border border-dashed border-border text-center text-xs text-muted-foreground">
                            No one-time hardware or service items in this order.
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground italic">
                          * Billed and fulfilled once upon initial delivery and order checkout.
                        </p>
                      </div>

                      {/* Recurring Lines Panel */}
                      <div className="space-y-3 pt-2 border-t border-border/70">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Repeat className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                              Recurring Subscription Lines (Automated Renewal)
                            </span>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-mono py-0 px-1.5">
                              Cadence Scheduled
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              ARR: ₹{orderClassification.totalAnnualRecurringRunRate.toLocaleString()}/yr
                            </span>
                            <span className="text-xs font-mono font-bold text-primary">
                              Cycle: ₹{orderClassification.recurringTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {orderClassification.recurringLines.length > 0 ? (
                          <div className="rounded-md border border-border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-[11px] bg-muted/30">
                                  <TableHead>Subscription Plan</TableHead>
                                  <TableHead>Billing Cadence</TableHead>
                                  <TableHead className="text-right">Unit Rate / Seat</TableHead>
                                  <TableHead className="text-right">Committed Seats</TableHead>
                                  <TableHead className="text-right">Discount</TableHead>
                                  <TableHead className="text-right">Cycle Amount</TableHead>
                                  <TableHead className="text-right">Annual Run Rate (ARR)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-xs">
                                {orderClassification.recurringLines.map((line) => (
                                  <TableRow key={line.id} className="bg-primary/5">
                                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                      {line.productName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-[9px] uppercase font-mono py-0 px-1">
                                        {line.cycle ?? selectedSub.cycle}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      ₹{line.unitPrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-primary">
                                      {line.qty} {line.unit}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">
                                      {line.discountPct > 0 ? `${line.discountPct}%` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-foreground">
                                      ₹{line.total.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium text-emerald-600">
                                      ₹{(line.annualValue ?? line.total * 12).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="p-3 rounded border border-dashed border-border text-center text-xs text-muted-foreground">
                            No recurring subscription lines linked to this quotation.
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground italic">
                          * Renews automatically according to the scheduled billing calendar below.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 rounded border border-dashed text-center text-xs text-muted-foreground">
                      No associated order found for this subscription contract.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* REQUIREMENT 3: Mid-Cycle Seat Proration Engine */}
              <Card className="shadow-xs border-primary/30 bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                      <TrendingUp className="h-4 w-4" />
                      Mid-Cycle Seat Scaling & Proration Engine
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {daysRemaining} of {daysInCycle} days remaining
                      </Badge>
                      <Badge
                        variant={plan?.prorationEnabled !== false ? "secondary" : "outline"}
                        className="text-[10px] font-mono"
                      >
                        {plan?.prorationEnabled !== false ? "Proration Enabled" : "Proration Off"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Real-time day-ratio calculation credits unused days of the previous tier and applies an interim charge or credit note.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Cycle Timeline Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Cycle Start: {new Date(selectedSub.startDate).toLocaleDateString()}</span>
                      <span className="font-mono font-medium text-foreground">
                        {cyclePercent}% elapsed ({daysElapsed}d passed · {daysRemaining}d left)
                      </span>
                      <span>Next Bill: {new Date(selectedSub.nextBillDate).toLocaleDateString()}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${cyclePercent}%` }}
                      />
                    </div>
                  </div>

                  {plan && !plan.prorationEnabled && (
                    <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        Mid-cycle proration is disabled on this plan ({plan.name}). Seat modifications will take effect starting next renewal cycle without mid-period surcharges or credit notes.
                      </span>
                    </div>
                  )}

                  {/* Interactive Seat Adjustment Controls */}
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Committed Seats:</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewSeatCount((prev) => Math.max(1, prev - 1))}
                            disabled={newSeatCount <= 1 || selectedSub.status === "CANCELLED"}
                            className="h-8 w-8 p-0 text-sm font-bold"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={newSeatCount}
                            onChange={(e) => setNewSeatCount(parseInt(e.target.value) || 1)}
                            disabled={selectedSub.status === "CANCELLED"}
                            className="h-8 w-20 text-xs font-mono text-center font-bold"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewSeatCount((prev) => prev + 1)}
                            disabled={selectedSub.status === "CANCELLED"}
                            className="h-8 w-8 p-0 text-sm font-bold"
                          >
                            +
                          </Button>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          (Current: {selectedSub.qty} seats)
                        </span>
                      </div>

                      {canManageBilling ? (
                        <Button
                          size="sm"
                          disabled={newSeatCount === selectedSub.qty || selectedSub.status === "CANCELLED"}
                          onClick={handleModifySeats}
                          className="h-8 text-xs gap-1.5"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>Apply Modification</span>
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Modification Restricted
                        </Badge>
                      )}
                    </div>

                    {/* Live Proration Math Breakdown */}
                    {prorationPreview && (
                      <div className="pt-2 border-t border-border/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded bg-background border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">Unused Tier Credit</div>
                          <div className="font-mono text-foreground font-semibold">
                            -₹{prorationPreview.unusedCredit.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {selectedSub.qty} seats × {daysRemaining}d unserved
                          </div>
                        </div>

                        <div className="p-2 rounded bg-background border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase">New Tier Charge</div>
                          <div className="font-mono text-foreground font-semibold">
                            +₹{prorationPreview.newCharge.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {newSeatCount} seats × {daysRemaining}d remaining
                          </div>
                        </div>

                        <div
                          className={`p-2 rounded border ${
                            prorationPreview.kind === "CHARGE"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
                              : prorationPreview.kind === "CREDIT"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-background border-border text-foreground"
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold">
                            {prorationPreview.kind === "CHARGE"
                              ? "Immediate Interim Charge"
                              : prorationPreview.kind === "CREDIT"
                                ? "Automatic Credit Note"
                                : "Net Adjustment"}
                          </div>
                          <div className="font-mono font-bold text-sm">
                            {prorationPreview.kind === "CHARGE"
                              ? `+₹${prorationPreview.difference.toFixed(2)}`
                              : prorationPreview.kind === "CREDIT"
                                ? `-₹${Math.abs(prorationPreview.difference).toFixed(2)}`
                                : "₹0.00"}
                          </div>
                          <div className="text-[9px] mt-0.5 opacity-90">
                            {prorationPreview.kind === "CHARGE"
                              ? "Charged for remaining cycle days"
                              : prorationPreview.kind === "CREDIT"
                                ? "Credited to account balance"
                                : "No mid-cycle adjustment"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* REQUIREMENT 2: Displays Upcoming Billing Schedule for Recurring Lines */}
              <Card className="shadow-xs">
                <CardHeader className="p-4 pb-2 border-b border-border">
                  <CardTitle className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming Billing Schedule (Next 6 Recurring Cycles)
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Auto-Cadence Timetable
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] bg-muted/30">
                        <TableHead>Cycle Label</TableHead>
                        <TableHead>Scheduled Billing Date</TableHead>
                        <TableHead>Committed Quantity</TableHead>
                        <TableHead className="text-right">Projected Charge</TableHead>
                        <TableHead className="text-right">Payment Terms</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {schedule.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {entry.label}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-foreground">
                            {selectedSub.qty} seats @ ₹{selectedSub.unitPrice}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            ₹{entry.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground text-[11px]">
                            Net 30 · Auto-Invoice
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={idx === 0 ? "secondary" : "outline"}
                              className={`text-[9px] uppercase font-mono py-0 px-1.5 ${
                                idx === 0 ? "bg-primary/10 text-primary border-primary/20" : ""
                              }`}
                            >
                              {idx === 0 ? "Next Due" : "Scheduled"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* REQUIREMENT 4: Credit Notes & Billing Adjustments Ledger */}
              <Card className="shadow-xs">
                <CardHeader className="p-4 pb-2 border-b border-border">
                  <CardTitle className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-emerald-600" />
                      Credit Notes & Proration Adjustments Ledger ({selectedSub.adjustments.length})
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Audit Trail
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {selectedSub.adjustments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSub.adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={adj.kind === "CREDIT" ? "secondary" : "outline"}
                                className={`text-[9px] font-mono uppercase py-0 px-1.5 ${
                                  adj.kind === "CREDIT"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                }`}
                              >
                                {adj.kind === "CREDIT" ? "Credit Note" : "Interim Charge"}
                              </Badge>
                              <span className="font-semibold text-foreground">{adj.note}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Posted on {new Date(adj.at).toLocaleString()} · ID: {adj.id}
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`font-mono font-bold text-sm ${
                                adj.kind === "CREDIT" ? "text-emerald-600" : "text-blue-600"
                              }`}
                            >
                              {adj.kind === "CREDIT" ? "-" : "+"}₹{adj.amount.toFixed(2)}
                            </div>
                            <Badge variant="outline" className="text-[9px] text-muted-foreground font-mono py-0 px-1">
                              Applied
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                      No mid-cycle adjustments or credit notes recorded on this subscription yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select a subscription contract from the left to view hybrid order lines, billing schedules, and seat proration.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
