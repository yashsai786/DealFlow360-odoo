import React, { useState, useEffect, useMemo } from "react";
import {
  useAppState,
  productMap,
  customerMap,
  totalsOf,
  negotiationActions,
} from "../../infrastructure/store";
import type { Quotation, Approval } from "../../modules/shared/types";
import { lineNet } from "../../modules/quotations/service";
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
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Send,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Info,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Maps internal quotation stages to clean customer-facing statuses (B8 specification):
 * - Sent: Newly issued proposal ready for customer review
 * - Under Negotiation: Customer submitted counter-discounts or change requests
 * - Under Review: Exceeds discount ceilings, pending managerial sign-off
 * - Confirmed: Finalized order moving to fulfillment
 */
export function getCustomerStatus(quotation: Quotation, relatedApproval?: Approval | null): {
  label: "Sent" | "Under Negotiation" | "Under Review" | "Confirmed" | "Revision Required" | "Cancelled";
  variant: "default" | "secondary" | "outline" | "destructive";
  badgeClass: string;
  description: string;
} {
  if (
    quotation.stage === "CONFIRMED" ||
    quotation.stage === "FULFILLMENT" ||
    quotation.stage === "INVOICED" ||
    quotation.stage === "PAID"
  ) {
    return {
      label: "Confirmed",
      variant: "default",
      badgeClass: "bg-emerald-600 hover:bg-emerald-600 text-white font-semibold",
      description: "Quotation signed & accepted. Transferred to warehouse fulfillment.",
    };
  }

  // Check if quotation or its approval was returned for revision
  const isReturned =
    relatedApproval?.status === "RETURNED" ||
    relatedApproval?.steps.some((s) => s.status === "RETURNED") ||
    quotation.messages.some((m) => m.body.includes("[Revision Required"));

  if (isReturned) {
    return {
      label: "Revision Required",
      variant: "outline",
      badgeClass: "border-amber-500 text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40",
      description: "Returned for revision. Please review feedback below and submit updated terms.",
    };
  }

  if (quotation.stage === "CANCELLED" || relatedApproval?.status === "REJECTED") {
    return {
      label: "Cancelled",
      variant: "destructive",
      badgeClass: "bg-destructive text-destructive-foreground font-semibold",
      description: "Commercial proposal was rejected or cancelled.",
    };
  }

  if (quotation.stage === "PENDING_APPROVAL") {
    return {
      label: "Under Review",
      variant: "outline",
      badgeClass: "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30",
      description: "Counter-discount terms submitted for internal executive sign-off.",
    };
  }
  if (quotation.stage === "NEGOTIATION" || quotation.requests.some((r) => r.status === "OPEN")) {
    return {
      label: "Under Negotiation",
      variant: "secondary",
      badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-semibold border border-indigo-300 dark:border-indigo-800",
      description: "Revision requests submitted. Awaiting sales account executive review.",
    };
  }
  return {
    label: "Sent",
    variant: "outline",
    badgeClass: "border-sky-500 text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-950/30",
    description: "Commercial proposal active and ready for your sign-off or counter-offer.",
  };
}

interface CustomerPortalViewProps {
  initialQuoteId?: string;
}

export function CustomerPortalView({ initialQuoteId }: CustomerPortalViewProps = {}) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const session = state.session;

  // Strict Customer Isolation: show only quotations belonging to this customer
  const myCustomerId = session?.customerId ?? "c-acme";
  const customer = customers[myCustomerId];
  const myQuotations = state.quotations.filter((q) => q.customerId === myCustomerId);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(
    initialQuoteId || myQuotations[0]?.id || "",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sync selectedQuoteId if initialQuoteId prop changes
  useEffect(() => {
    if (initialQuoteId) {
      setSelectedQuoteId(initialQuoteId);
    }
  }, [initialQuoteId]);

  // Sync selectedQuoteId if list changes
  useEffect(() => {
    if (!selectedQuoteId && myQuotations.length > 0) {
      setSelectedQuoteId(myQuotations[0]!.id);
    }
  }, [myQuotations, selectedQuoteId]);

  const filteredQuotations = myQuotations.filter((q) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const qTotals = totalsOf(state, q);
    const qStatus = getCustomerStatus(q);
    const hasMatchingProduct = q.lines.some((l) => {
      const p = products[l.productId];
      return p?.name.toLowerCase().includes(term) || l.productId.toLowerCase().includes(term);
    });
    return (
      q.number.toLowerCase().includes(term) ||
      qStatus.label.toLowerCase().includes(term) ||
      qTotals.total.toString().includes(term) ||
      hasMatchingProduct
    );
  });

  const quotation = myQuotations.find((q) => q.id === selectedQuoteId);
  const relatedApproval = quotation
    ? state.approvals.find((a) => a.quotationId === quotation.id)
    : null;
  const totals = quotation ? totalsOf(state, quotation) : null;
  const statusInfo = quotation ? getCustomerStatus(quotation, relatedApproval) : null;
  const isLocked =
    quotation?.stage === "CONFIRMED" ||
    quotation?.stage === "FULFILLMENT" ||
    quotation?.stage === "INVOICED" ||
    quotation?.stage === "PAID";

  // Find feedback from returned or rejected approval steps
  const returnedStep = relatedApproval?.steps
    .slice()
    .reverse()
    .find((s) => s.status === "RETURNED" && s.reason);

  const rejectedStep = relatedApproval?.steps
    .slice()
    .reverse()
    .find((s) => s.status === "REJECTED" && s.reason);

  const latestFeedback = returnedStep || rejectedStep;

  // Merge messages from quotation.messages with any approval return/reject step feedback
  const combinedMessages = useMemo(() => {
    if (!quotation) return [];
    const msgs = [...quotation.messages];

    // If there is approval step feedback not yet in quotation.messages, include it
    if (relatedApproval) {
      for (const step of relatedApproval.steps) {
        if ((step.status === "RETURNED" || step.status === "REJECTED") && step.reason) {
          const actionText = step.status === "RETURNED" ? "Revision Required" : "Proposal Rejected";
          const alreadyPresent = msgs.some(
            (m) => m.body.includes(step.reason!) || (step.decidedAt && m.at === step.decidedAt),
          );
          if (!alreadyPresent) {
            msgs.push({
              id: `msg-approval-${step.role}`,
              author: `${step.decidedBy || "Executive"} (${step.role.replace("_", " ")})`,
              role: "ADMIN" as any,
              body: `[${actionText} by ${step.role.replace("_", " ")}]: ${step.reason}`,
              at: step.decidedAt || quotation.createdAt,
            });
          }
        }
      }
    }

    return msgs.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [quotation, relatedApproval]);

  // Line-level counter proposals and comments state
  const [lineProposals, setLineProposals] = useState<
    Record<string, { counterDiscount: number; note: string }>
  >({});
  const [overallComment, setOverallComment] = useState("");
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset proposals when active quotation changes
  useEffect(() => {
    if (!quotation) return;
    const initial: Record<string, { counterDiscount: number; note: string }> = {};
    for (const line of quotation.lines) {
      const openReq = quotation.requests.find((r) => r.lineId === line.id && r.status === "OPEN");
      initial[line.id] = {
        counterDiscount: openReq ? openReq.requestedDiscountPct : line.discountPct,
        note: openReq?.note ?? "",
      };
    }
    setLineProposals(initial);
    setTargetDeliveryDate(quotation.requestedDeliveryDate ?? "");
    setOverallComment("");
  }, [quotation?.id]);

  // Handle counter-discount change on a line
  const handleDiscountChange = (lineId: string, val: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
    setLineProposals((prev) => ({
      ...prev,
      [lineId]: {
        counterDiscount: clamped,
        note: prev[lineId]?.note ?? "",
      },
    }));
  };

  // Handle line note change
  const handleNoteChange = (lineId: string, note: string) => {
    setLineProposals((prev) => ({
      ...prev,
      [lineId]: {
        counterDiscount: prev[lineId]?.counterDiscount ?? 0,
        note,
      },
    }));
  };

  // Button 1: Submit Request (B8 requirement)
  const handleSubmitRequest = () => {
    if (!quotation) return;

    // Collect lines where counter discount differs from original offered discount or has a note
    const changedRequests: { lineId: string; requestedDiscountPct: number; note: string }[] = [];
    for (const line of quotation.lines) {
      const prop = lineProposals[line.id];
      if (prop && (prop.counterDiscount !== line.discountPct || prop.note.trim().length > 0)) {
        changedRequests.push({
          lineId: line.id,
          requestedDiscountPct: prop.counterDiscount,
          note: prop.note.trim() || `Requested ${prop.counterDiscount}% discount (offered: ${line.discountPct}%)`,
        });
      }
    }

    if (changedRequests.length === 0 && !overallComment.trim() && !targetDeliveryDate) {
      toast.info("Please enter a counter discount or comment before submitting.");
      return;
    }

    try {
      negotiationActions.submitRequest(
        quotation.id,
        changedRequests.length > 0
          ? changedRequests
          : quotation.lines.map((l) => ({
              lineId: l.id,
              requestedDiscountPct: lineProposals[l.id]?.counterDiscount ?? l.discountPct,
              note: overallComment.trim() || "General terms adjustment requested.",
            })),
        overallComment.trim() || "Customer submitted negotiation counter-proposals.",
        targetDeliveryDate || undefined,
      );

      toast.success("Negotiation request submitted! Your proposal status is now 'Under Negotiation'.");
      setOverallComment("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit negotiation request");
    }
  };

  // Button 2: Confirm Quotation (B8 requirement & smart routing)
  const handleConfirmQuotation = async () => {
    if (!quotation) return;
    setIsSubmitting(true);
    try {
      const res = await negotiationActions.customerConfirm(quotation.id);
      if (res.routedTo === "APPROVAL") {
        toast.warning(
          `Quotation terms accepted! However, final counter-terms exceed governance ceilings (${res.riskLevel} risk). Automatically routed to B4 Manager & Finance Approval Queue.`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          "Quotation Confirmed! Your order has been scheduled and moved directly to warehouse fulfillment.",
          { duration: 5000 },
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Quotation confirmation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Discussion reply
  const handleSendMessage = async () => {
    if (!quotation || !chatMessage.trim()) return;
    const msg = chatMessage.trim();
    setChatMessage("");
    try {
      await negotiationActions.reply(quotation.id, msg);
      toast.success("Message sent to sales rep.");
    } catch (err: any) {
      toast.error(err.message || "Message failed");
    }
  };

  // Calculate proposed totals preview
  const proposedTotals = quotation
    ? quotation.lines.reduce(
        (acc, l) => {
          const p = products[l.productId];
          const unitPrice = l.unitPrice;
          const disc = lineProposals[l.id]?.counterDiscount ?? l.discountPct;
          const lineTotal = Math.round(l.qty * unitPrice * (1 - disc / 100));
          return {
            gross: acc.gross + l.qty * unitPrice,
            net: acc.net + lineTotal,
          };
        },
        { gross: 0, net: 0 },
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Customer Header Banner */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{customer?.name ?? "Enterprise Account"}</h1>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {customer?.tier ?? "Commercial"} Account Tier
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Customer Procurement Portal · Logged in as {session?.name} ({session?.email})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Customer-Facing Secure Workspace</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Customer Proposals List */}
        <Card className="shadow-xs border-border">
          <CardHeader className="p-4 pb-3 border-b border-border space-y-2.5">
            <div>
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  Commercial Proposals ({filteredQuotations.length})
                </span>
                {searchQuery && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Filtering {filteredQuotations.length} of {myQuotations.length}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-[11px] mt-0.5">
                Select a quote to review terms or propose adjustments
              </CardDescription>
            </div>

            {/* In-page Search Bar for Customer Screen */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search proposals by quote #, status, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs w-full bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {filteredQuotations.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                <Search className="h-5 w-5 mx-auto opacity-30 mb-1" />
                <p className="font-medium text-foreground">No proposals found</p>
                <p className="text-[11px]">No quotations match &ldquo;{searchQuery}&rdquo;</p>
              </div>
            ) : (
              filteredQuotations.map((q) => {
              const active = q.id === selectedQuoteId;
              const qTotals = totalsOf(state, q);
              const qApproval = state.approvals.find((a) => a.quotationId === q.id);
              const qStatus = getCustomerStatus(q, qApproval);

              return (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-primary font-bold">{q.number}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 uppercase ${qStatus.badgeClass}`}>
                      {qStatus.label}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
                    <span>{q.lines.length} line items</span>
                    <span className="font-semibold text-foreground font-mono">
                      ₹{qTotals.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex justify-between items-center pt-1 border-t border-border/40">
                    <span>Issued: {new Date(q.createdAt).toLocaleDateString()}</span>
                    {qApproval?.status === "RETURNED" ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Revision requested
                      </span>
                    ) : q.requests.some((r) => r.status === "OPEN") ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        Active revision
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            }))}
          </CardContent>
        </Card>

        {/* Right 2 Cols: Quotation Negotiation & Line Review */}
        <div className="lg:col-span-2 space-y-6">
          {quotation && totals && statusInfo ? (
            <>
              <Card className="shadow-xs border-border">
                {/* Header with Status & Primary Action Buttons */}
                <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold font-mono text-primary">
                        {quotation.number}
                      </CardTitle>
                      <Badge className={`text-xs px-2 py-0.5 uppercase ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1 text-muted-foreground">
                      {statusInfo.description}
                    </CardDescription>
                  </div>

                  {/* Primary B8 Buttons: Submit Request & Confirm Quotation */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isLocked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSubmitRequest}
                        className="h-8 text-xs flex items-center gap-1.5 border-indigo-300 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit Request
                      </Button>
                    )}

                    {!isLocked ? (
                      <Button
                        size="sm"
                        disabled={isSubmitting}
                        onClick={handleConfirmQuotation}
                        className="h-8 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isSubmitting ? "Processing..." : "Confirm Quotation"}
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 text-xs py-1 px-2.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Order Confirmed
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-6">
                  {/* Prominent Reviewer Feedback Banner when Returned for Revision or Rejected */}
                  {latestFeedback && (
                    <div
                      className={`p-4 rounded-xl border flex items-start gap-3.5 shadow-xs ${
                        latestFeedback.status === "REJECTED"
                          ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
                          : "border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          latestFeedback.status === "REJECTED"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            {latestFeedback.status === "REJECTED"
                              ? "Commercial Proposal Rejected"
                              : "Commercial Terms Returned for Revision"}
                            <span className="font-normal text-muted-foreground">
                              by <strong className="text-foreground">{latestFeedback.decidedBy}</strong> (
                              {latestFeedback.role.replace("_", " ")})
                            </span>
                          </span>
                          {latestFeedback.decidedAt && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(latestFeedback.decidedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="text-xs p-2.5 rounded-md bg-background/80 border border-border/60 font-mono text-foreground font-medium">
                          &ldquo;{latestFeedback.reason}&rdquo;
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {latestFeedback.status === "REJECTED"
                            ? "This proposal has been rejected by leadership. Please contact your account executive for assistance."
                            : "Please adjust your proposed counter-discounts or delivery date below, then click 'Submit Request' to re-route for priority review."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Proposal Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] block uppercase font-medium">Issue Date</span>
                      <span className="font-medium text-foreground">{new Date(quotation.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block uppercase font-medium">Target Delivery</span>
                      {isLocked ? (
                        <span className="font-medium text-foreground">{quotation.requestedDeliveryDate || "Standard (7-10 days)"}</span>
                      ) : (
                        <Input
                          type="date"
                          value={targetDeliveryDate}
                          onChange={(e) => setTargetDeliveryDate(e.target.value)}
                          className="h-6 text-[11px] p-1 bg-background mt-0.5"
                        />
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block uppercase font-medium">Current Total</span>
                      <span className="font-bold text-foreground font-mono">₹{totals.total.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block uppercase font-medium">Payment Terms</span>
                      <span className="font-medium text-foreground">Net 30 Days</span>
                    </div>
                  </div>

                  {/* Line Items Table with Counter Discount Proposal Field (B8) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>Commercial Equipment & Line Items</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          (Propose line-level counter discounts below)
                        </span>
                      </div>
                      {proposedTotals && proposedTotals.net !== totals.total && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5" />
                          Proposed Net: ₹{proposedTotals.net.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 text-[11px]">
                            <TableHead>Product / Service</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">List Price</TableHead>
                            <TableHead className="text-right">Offered Discount</TableHead>
                            <TableHead className="text-right w-36">Counter Discount Proposal</TableHead>
                            <TableHead className="text-right">Net Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {quotation.lines.map((l) => {
                            const p = products[l.productId];
                            const net = lineNet(l);
                            const proposal = lineProposals[l.id] ?? {
                              counterDiscount: l.discountPct,
                              note: "",
                            };
                            const isChanged = proposal.counterDiscount !== l.discountPct;

                            return (
                              <React.Fragment key={l.id}>
                                <TableRow className={isChanged ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}>
                                  <TableCell className="font-medium">
                                    <div className="text-foreground">{p?.name ?? l.productId}</div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">{p?.description}</div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{l.qty}</TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    ₹{l.unitPrice.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                    {l.discountPct}% off
                                  </TableCell>

                                  {/* Counter Discount Proposal Field (B8) */}
                                  <TableCell className="text-right">
                                    {isLocked ? (
                                      <span className="font-mono font-bold text-foreground">
                                        {proposal.counterDiscount}%
                                      </span>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1">
                                        <div className="relative w-20">
                                          <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={proposal.counterDiscount}
                                            onChange={(e) =>
                                              handleDiscountChange(l.id, parseFloat(e.target.value))
                                            }
                                            className="h-7 text-xs text-right font-mono font-bold pr-5 bg-background"
                                          />
                                          <span className="absolute right-2 top-1.5 text-[11px] text-muted-foreground">%</span>
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell className="text-right font-mono font-bold text-foreground">
                                    ₹{net.toLocaleString()}
                                  </TableCell>
                                </TableRow>

                                {/* Line-level Comment and Change Request Tool */}
                                {!isLocked && (
                                  <TableRow className="bg-muted/10 border-b border-border/60">
                                    <TableCell colSpan={6} className="py-1.5 px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                          Line Note / Comment:
                                        </span>
                                        <Input
                                          placeholder={`e.g. Budget ceiling requires ${proposal.counterDiscount}% on ${p?.name || "this item"}...`}
                                          value={proposal.note}
                                          onChange={(e) => handleNoteChange(l.id, e.target.value)}
                                          className="h-6 text-[11px] bg-background/80"
                                        />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* General Procurement Comment */}
                  {!isLocked && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        Procurement Justification & Message to Account Executive
                      </label>
                      <Input
                        placeholder="e.g. Seeking bulk procurement approval for Q3 budget. Ready to sign if counter terms are approved."
                        value={overallComment}
                        onChange={(e) => setOverallComment(e.target.value)}
                        className="text-xs h-8 bg-background"
                      />
                    </div>
                  )}

                  {/* Smart Confirmation Info Box */}
                  <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                      <strong className="text-foreground">Automated Contract Governance:</strong>
                      <p>
                        When you click <strong className="text-foreground">"Confirm Quotation"</strong>:
                        If agreed terms are within standard account guidelines, your order moves directly to <strong>Warehouse Fulfillment</strong>.
                        If custom counter-discounts exceed policy ceilings, the proposal automatically re-enters internal <strong>Executive & Finance Approval</strong> for priority sign-off.
                      </p>
                    </div>
                  </div>

                  {/* Direct Account Discussion Thread */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span>Direct Account Messages & History</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {combinedMessages.length} messages exchanged
                      </span>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto p-3 rounded-lg border border-border bg-muted/20">
                      {combinedMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg text-xs space-y-1 max-w-[85%] ${
                            m.role === "CUSTOMER"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : m.body.includes("Revision Required")
                                ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200"
                                : "bg-card border border-border text-card-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-80 gap-3">
                            <span className="font-semibold">{m.author}</span>
                            <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-xs leading-relaxed">{m.body}</p>
                        </div>
                      ))}
                      {combinedMessages.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Send a note below to chat with your sales representative.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Write a message to your sales account executive..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="text-xs h-8 bg-background"
                      />
                      <Button size="sm" onClick={handleSendMessage} className="h-8 text-xs bg-primary text-primary-foreground">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-xs border-border p-12 text-center text-muted-foreground text-xs">
              Select a commercial proposal from the left to view terms and submit negotiation requests.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
