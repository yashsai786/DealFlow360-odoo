import React, { useState, useEffect } from "react";
import {
  useAppState,
  productMap,
  customerMap,
  evaluate,
  totalsOf,
  approvalActions,
  negotiationActions,
} from "../../infrastructure/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Clock,
  History,
  MessageSquareQuote,
  Search,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { canPerformAction } from "../../modules/identity/permissions";

interface ApprovalsViewProps {
  onOpenQuote: (quoteId: string) => void;
  initialApprovalId?: string;
}

export function ApprovalsView({ onOpenQuote, initialApprovalId }: ApprovalsViewProps) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const session = state.session;

  const isSalesRep = session?.role === "SALES_REP";
  const visibleApprovals = state.approvals.filter((a) => {
    if (!isSalesRep) return true;
    const q = state.quotations.find((quote) => quote.id === a.quotationId);
    return q?.ownerId === session?.id;
  });

  const pendingApprovals = visibleApprovals.filter((a) => a.status === "PENDING");
  const pastApprovals = visibleApprovals.filter((a) => a.status !== "PENDING");

  // Quotations with customer inquiries/messages where a revised quotation proposal has not yet been submitted for pending approval
  const customerInquiries = state.quotations.filter((q) => {
    if (isSalesRep && q.ownerId !== session?.id) return false;
    if (!q.messages || q.messages.length === 0) return false;
    // Exclude if already in pending approvals queue
    const isPending = pendingApprovals.some((a) => a.quotationId === q.id);
    if (isPending) return false;
    // Exclude fulfilled/invoiced/cancelled quotes unless they have open messages
    if (["FULFILLMENT", "INVOICED", "PAID", "CANCELLED"].includes(q.stage)) return false;
    return true;
  });

  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(
    initialApprovalId || visibleApprovals.find((a) => a.status === "PENDING")?.id || null,
  );
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(
    !initialApprovalId && !visibleApprovals.some((a) => a.status === "PENDING") && customerInquiries[0]?.id
      ? customerInquiries[0].id
      : null,
  );

  useEffect(() => {
    if (initialApprovalId) {
      setSelectedApprovalId(initialApprovalId);
      setSelectedQuoteId(null);
    }
  }, [initialApprovalId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Dialog for Return / Reject reason
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    type: "RETURNED" | "REJECTED";
    reason: string;
  }>({
    open: false,
    type: "RETURNED",
    reason: "",
  });

  const quotation = selectedQuoteId
    ? state.quotations.find((q) => q.id === selectedQuoteId)
    : selectedApprovalId
      ? state.quotations.find((q) => q.id === (visibleApprovals.find((a) => a.id === selectedApprovalId)?.quotationId))
      : (customerInquiries[0] || (visibleApprovals[0] ? state.quotations.find((q) => q.id === visibleApprovals[0].quotationId) : null));

  const selectedApproval = selectedApprovalId
    ? visibleApprovals.find((a) => a.id === selectedApprovalId)
    : visibleApprovals.find((a) => a.quotationId === quotation?.id);

  const customer = quotation ? customers[quotation.customerId] : null;
  const totals = quotation ? totalsOf(state, quotation) : null;
  const evaluation = quotation ? evaluate(state, quotation) : null;

  const filteredPending = pendingApprovals.filter((a) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const q = state.quotations.find((x) => x.id === a.quotationId);
    const cust = customers[q?.customerId ?? ""];
    const nextStep = a.steps.find((s) => s.status === "PENDING");
    return (
      q?.number.toLowerCase().includes(term) ||
      cust?.name.toLowerCase().includes(term) ||
      a.riskLevel.toLowerCase().includes(term) ||
      a.id.toLowerCase().includes(term) ||
      nextStep?.role.toLowerCase().includes(term)
    );
  });

  const filteredInquiries = customerInquiries.filter((q) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const cust = customers[q.customerId ?? ""];
    const lastMsg = q.messages && q.messages.length > 0 ? q.messages[q.messages.length - 1]?.body : "";
    return (
      q.number.toLowerCase().includes(term) ||
      cust?.name.toLowerCase().includes(term) ||
      lastMsg.toLowerCase().includes(term)
    );
  });

  const handleSendChat = async () => {
    if (!quotation || !chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsSendingChat(true);
    try {
      await negotiationActions.reply(quotation.id, msg);
      toast.success(`Reply sent to ${customer?.name || "customer"}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;
    try {
      const res = await approvalActions.decide(selectedApproval.id, "APPROVED");
      if (res?.chainComplete) {
        toast.success("Approval chain completed! Quotation is now APPROVED.");
      } else {
        toast.success(`Step approved. Routed to next step: ${res?.nextRole?.replace("_", " ")}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    }
  };

  const handleConfirmDecision = async () => {
    if (!selectedApproval) return;
    if (!decisionModal.reason.trim()) {
      toast.error("Please enter a clear reason for returning or rejecting this quotation.");
      return;
    }

    try {
      await approvalActions.decide(selectedApproval.id, decisionModal.type, decisionModal.reason);
      toast.success(
        decisionModal.type === "RETURNED"
          ? "Quotation returned for revision with feedback."
          : "Quotation rejected and cancelled.",
      );
      setDecisionModal({ open: false, type: "RETURNED", reason: "" });
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Discount Governance & Approvals</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Multi-level managerial and financial risk review on out-of-policy commercial terms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Queue */}
        <div className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-3 border-b border-border space-y-2">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Pending Review Queue ({filteredPending.length})
                </span>
                {searchQuery && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {filteredPending.length} of {pendingApprovals.length}
                  </span>
                )}
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search approvals (e.g. Q-1041, Acme)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-full bg-background"
                />
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5">
              {filteredPending.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {searchQuery ? "No approvals matching your search" : "No pending approvals in queue"}
                </div>
              ) : (
                filteredPending.map((a) => {
                const q = state.quotations.find((x) => x.id === a.quotationId);
                const cust = customers[q?.customerId ?? ""];
                const active = a.id === selectedApprovalId;
                const nextStep = a.steps.find((s) => s.status === "PENDING");

                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedApprovalId(a.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      active
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-primary">{q?.number}</span>
                        {q?.requests && q.requests.length > 0 && (
                          <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 py-0 px-1">
                            Negotiated
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={a.riskLevel === "HIGH" ? "destructive" : "secondary"}
                        className="text-[9px] uppercase font-mono py-0 px-1"
                      >
                        {a.riskLevel} Risk
                      </Badge>
                    </div>
                    <div className="text-[11px] text-foreground font-semibold mt-1">
                      {cust?.name} ({cust?.tier} Tier)
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Awaiting: {nextStep?.role.replace("_", " ")}</span>
                      <span>{new Date(a.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              }))}
            </CardContent>
          </Card>

          {/* Customer Inquiries & Discussions Queue */}
          <Card className="shadow-xs border-indigo-100 dark:border-indigo-950/60">
            <CardHeader className="p-3 border-b border-border bg-indigo-50/20 dark:bg-indigo-950/10">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground">
                  <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Customer Inquiries & Clarifications ({filteredInquiries.length})
                </span>
                {filteredInquiries.length > 0 && (
                  <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 font-mono py-0 px-1.5">
                    Active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
              {filteredInquiries.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {searchQuery ? "No customer inquiries matching search" : "No active customer inquiries pending revision"}
                </div>
              ) : (
                filteredInquiries.map((q) => {
                  const cust = customers[q.customerId ?? ""];
                  const active = quotation?.id === q.id && !selectedApprovalId;
                  const lastMsg = q.messages && q.messages.length > 0 ? q.messages[q.messages.length - 1] : null;
                  const isFromCustomer = lastMsg && (lastMsg.role === "CUSTOMER" || lastMsg.author.toLowerCase().includes("customer") || lastMsg.author.includes("Ortiz"));

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        setSelectedQuoteId(q.id);
                        setSelectedApprovalId(null);
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        active
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-primary font-bold">{q.number}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] py-0 px-1 ${
                              isFromCustomer
                                ? "border-amber-400 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                                : "border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50"
                            }`}
                          >
                            {isFromCustomer ? "Customer Inquired" : "Discussion"}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {q.messages.length} msg{q.messages.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="text-[11px] text-foreground font-semibold mt-1">
                        {cust?.name} ({cust?.tier} Tier)
                      </div>
                      {lastMsg && (
                        <div className="mt-1.5 p-1.5 rounded bg-muted/50 border border-border/50 text-[11px] text-muted-foreground flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 mt-0.5 text-indigo-500 shrink-0" />
                          <span className="truncate italic">"{lastMsg.body}"</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Latest: <strong className="text-foreground">{lastMsg?.author}</strong></span>
                        <span>{lastMsg ? new Date(lastMsg.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Past Approvals */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Completed Decisions ({pastApprovals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
              {pastApprovals.map((a) => {
                const q = state.quotations.find((x) => x.id === a.quotationId);
                const cust = customers[q?.customerId ?? ""];
                const active = a.id === selectedApprovalId;

                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedApprovalId(a.id)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer ${
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{q?.number}</span>
                      <Badge
                        variant={
                          a.status === "APPROVED"
                            ? "secondary"
                            : a.status === "RETURNED"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-[9px] uppercase font-mono py-0 px-1"
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {cust?.name} · {new Date(a.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
              {pastApprovals.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No past approvals.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 2 Cols: Detailed Risk & Line Evaluation */}
        <div className="lg:col-span-2 space-y-6">
          {quotation && customer && totals ? (
            <>
              <Card className="shadow-xs">
                <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold font-mono text-primary">
                        {quotation.number}
                      </CardTitle>
                      <Badge
                        variant={selectedApproval?.riskLevel === "HIGH" ? "destructive" : "secondary"}
                        className="text-xs uppercase font-mono"
                      >
                        {selectedApproval ? `${selectedApproval.riskLevel} Risk Approval` : `${quotation.stage} Stage`}
                      </Badge>
                      {quotation.messages && quotation.messages.length > 0 && (
                        <Badge variant="outline" className="text-[10px] font-mono border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50">
                          {quotation.messages.length} msg{quotation.messages.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Customer: <strong>{customer.name}</strong> ({customer.tier} Tier) · Net Value:{" "}
                      <strong>₹{totals.total.toLocaleString()}</strong>
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenQuote(quotation.id)}
                    className="h-8 text-xs"
                  >
                    Open Quotation Builder
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Negotiation Origin Context Banner */}
                  {quotation.requests.length > 0 && (
                    <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-indigo-950 dark:text-indigo-200">
                        <div className="flex items-center gap-1.5">
                          <MessageSquareQuote className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>🔁 Re-Entered from Customer Negotiation</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-background/60">
                          Customer Counter-Proposal
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        {quotation.requests.map((req) => {
                          const line = quotation.lines.find((l) => l.id === req.lineId);
                          const prod = products[line?.productId ?? ""];
                          return (
                            <div key={req.id} className="p-2 rounded bg-background border border-indigo-100 dark:border-indigo-900/50 text-foreground">
                              <div className="flex items-center justify-between font-medium">
                                <span>
                                  {prod?.name ?? "Line Item"}: Customer requested{" "}
                                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    {req.requestedDiscountPct}% discount
                                  </strong>
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {new Date(req.at).toLocaleDateString()}
                                </span>
                              </div>
                              {req.note && (
                                <p className="italic text-muted-foreground mt-0.5 text-[11px]">
                                  "{req.note}"
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Governance Breaches Highlight */}
                  <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20 text-xs space-y-2">
                    <div className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                      Policy Violation Analysis & Risk Triggers:
                    </div>
                    <ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside">
                      {evaluation?.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Customer Discussion & Direct Chat Card */}
                  <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs space-y-3">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Direct Customer Discussion & Clarifications</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-background/60">
                          {quotation.messages.length} message{quotation.messages.length === 1 ? "" : "s"}
                        </Badge>
                        {quotation.stage === "DRAFT" && (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50/80">
                            Awaiting Revised Proposal
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto p-1 pr-2">
                      {quotation.messages.map((m) => {
                        const isCustomer = m.role === "CUSTOMER" || m.author.toLowerCase().includes("customer") || m.author.includes("Ortiz");
                        const isMe = session?.name && m.author.includes(session.name);
                        return (
                          <div
                            key={m.id}
                            className={`p-2.5 rounded-lg text-xs space-y-1 max-w-[88%] ${
                              isMe
                                ? "ml-auto bg-primary text-primary-foreground shadow-xs"
                                : isCustomer
                                  ? "mr-auto bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-foreground"
                                  : "mr-auto bg-card text-foreground border border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] opacity-85 gap-3">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <span>{m.author}</span>
                                {isCustomer ? (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-400 text-amber-800 dark:text-amber-300 bg-background/70 font-medium">
                                    Customer
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] py-0 px-1 font-medium ${
                                      isMe
                                        ? "border-primary-foreground/40 text-primary-foreground bg-primary-foreground/10"
                                        : "border-border text-muted-foreground bg-background/60"
                                    }`}
                                  >
                                    {m.role?.replace("_", " ") || "Reviewer"}
                                  </Badge>
                                )}
                              </div>
                              <span className="font-mono text-[10px]">
                                {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          </div>
                        );
                      })}
                      {quotation.messages.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4 italic">
                          No discussion messages exchanged yet. Use the chat box below to message the customer.
                        </p>
                      )}
                    </div>

                    {/* Interactive Chat Input */}
                    <div className="flex items-center gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/50">
                      <Input
                        placeholder={`Reply to ${customer.name} as ${session?.name || "Reviewer"} (${session?.role?.replace("_", " ") || "Reviewer"})...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                          }
                        }}
                        className="text-xs h-8 bg-background flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleSendChat}
                        disabled={isSendingChat || !chatInput.trim()}
                        className="h-8 text-xs bg-primary text-primary-foreground shrink-0"
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>

                  {/* Line Items Discount Evaluation Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground">Line-Level Discount Breakdown</div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Product / Category</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Discount</TableHead>
                            <TableHead className="text-right">Category Ceiling</TableHead>
                            <TableHead className="text-right">Compliance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {quotation.lines.map((l) => {
                            const p = products[l.productId];
                            const lineEval = evaluation?.lines.find((el) => el.lineId === l.id);
                            return (
                              <TableRow key={l.id}>
                                <TableCell>
                                  <div className="font-medium">{p?.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{p?.category}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono">₹{l.unitPrice}</TableCell>
                                <TableCell className="text-right font-mono">{l.qty}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  {l.discountPct}%
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {lineEval?.ceilingPct}%
                                </TableCell>
                                <TableCell className="text-right">
                                  {lineEval?.violating ? (
                                    <Badge variant="destructive" className="text-[10px] font-mono py-0 px-1">
                                      +{lineEval.overagePct}% Breach
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1 text-emerald-700 dark:text-emerald-300">
                                      Within Limit
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Multi-Step Approval Chain Status */}
                  {selectedApproval?.steps && selectedApproval.steps.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-semibold text-foreground">Multi-Step Approval Chain Progress</div>
                      <div className="space-y-2">
                        {selectedApproval.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                              step.status === "APPROVED"
                                ? "border-emerald-200 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/20"
                                : step.status === "PENDING"
                                  ? "border-amber-200 dark:border-amber-950 bg-amber-50/30 dark:bg-amber-950/20"
                                  : "border-rose-200 dark:border-rose-950 bg-rose-50/30 dark:bg-rose-950/20"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-xs">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">
                                  {step.role.replace("_", " ")} Review
                                </div>
                                {step.decidedBy && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Decided by {step.decidedBy} on{" "}
                                    {new Date(step.decidedAt!).toLocaleDateString()}
                                    {step.reason && ` · Note: "${step.reason}"`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant={
                                step.status === "APPROVED"
                                  ? "secondary"
                                  : step.status === "PENDING"
                                    ? "outline"
                                    : "destructive"
                              }
                              className="text-[10px] uppercase font-mono"
                            >
                              {step.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Audit Trail Entries */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      Decision & Governance Audit Trail
                    </div>
                    <div className="rounded-md border border-border bg-muted/20 divide-y divide-border/60">
                      {state.audit
                        .filter(
                          (entry) =>
                            entry.entityId === quotation.id ||
                            (selectedApproval && entry.entityId === selectedApproval.id)
                        )
                        .slice(0, 8)
                        .map((entry) => (
                          <div key={entry.id} className="p-2.5 text-xs flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{entry.action}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">by {entry.actor}</span>
                              </div>
                              {entry.reason && (
                                <div className="text-[11px] text-muted-foreground italic">
                                  "{entry.reason}"
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                              {new Date(entry.at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      {state.audit.filter(
                        (entry) =>
                          entry.entityId === quotation.id || (selectedApproval && entry.entityId === selectedApproval.id)
                      ).length === 0 && (
                        <div className="p-3 text-center text-muted-foreground text-xs">
                          No audit trail entries recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>

                {/* Managerial Decision Actions */}
                {selectedApproval?.status === "PENDING" ? (
                  (canPerformAction(session?.role, "approval.decide_manager") || canPerformAction(session?.role, "approval.decide_finance")) ? (
                    <CardFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Signing as: <strong className="text-foreground">{session?.name}</strong> ({session?.role.replace("_", " ")})
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDecisionModal({ open: true, type: "RETURNED", reason: "" })
                          }
                          className="h-8 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-500" />
                          Return for Revision
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDecisionModal({ open: true, type: "REJECTED", reason: "" })
                          }
                          className="h-8 text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject Quotation
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApprove}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve Commercial Terms
                        </Button>
                      </div>
                    </CardFooter>
                  ) : (
                    <CardFooter className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Status: <strong className="text-amber-600">Pending Review</strong> · Viewing in read-only status mode as {session?.name} ({session?.role.replace("_", " ")})
                      </div>
                    </CardFooter>
                  )
                ) : (
                  <CardFooter className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-semibold text-amber-600">
                        Stage: {quotation.stage === "DRAFT" ? "Revision Required" : quotation.stage}
                      </span>
                      <span>· {quotation.messages.length > 0 ? "Customer message received. Review discussion above or make adjustments." : "Awaiting updated proposal."}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenQuote(quotation.id)}
                      className="h-8 text-xs"
                    >
                      Open Quotation Builder
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select an approval from the queue to view policy evaluation and authorize terms.
            </Card>
          )}
        </div>
      </div>

      {/* Return / Reject Reason Modal */}
      <Dialog
        open={decisionModal.open}
        onOpenChange={(open) => setDecisionModal({ ...decisionModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {decisionModal.type === "RETURNED" ? "Return Quotation for Revision" : "Reject Commercial Proposal"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide required managerial feedback for the sales representative. This is recorded in the permanent audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Decision Reason / Required Adjustments</label>
            <Input
              placeholder="e.g. Reduce Setup Service discount to at most 10% to meet services ceiling."
              value={decisionModal.reason}
              onChange={(e) => setDecisionModal({ ...decisionModal, reason: e.target.value })}
              className="text-xs"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDecisionModal({ ...decisionModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionModal.type === "REJECTED" ? "destructive" : "default"}
              onClick={handleConfirmDecision}
              className="text-xs"
            >
              Confirm Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
