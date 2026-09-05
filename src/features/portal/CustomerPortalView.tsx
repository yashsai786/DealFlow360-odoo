import React, { useState } from "react";
import {
  useAppState,
  productMap,
  customerMap,
  totalsOf,
  negotiationActions,
  quotationActions,
} from "../../infrastructure/store";
import { stageLabel, lineNet } from "../../modules/quotations/service";
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
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export function CustomerPortalView() {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);
  const session = state.session;

  // Strict Customer Isolation: only allow quotations belonging to this customer
  const myCustomerId = session?.customerId ?? "c-acme";
  const customer = customers[myCustomerId];
  const myQuotations = state.quotations.filter((q) => q.customerId === myCustomerId);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(
    myQuotations[0]?.id ?? "",
  );
  const quotation = myQuotations.find((q) => q.id === selectedQuoteId);
  const totals = quotation ? totalsOf(state, quotation) : null;

  // Negotiation form state
  const [discountModal, setDiscountModal] = useState<{
    open: boolean;
    lineId: string;
    productName: string;
    currentDiscount: number;
    requestedDiscount: number;
    note: string;
  }>({
    open: false,
    lineId: "",
    productName: "",
    currentDiscount: 0,
    requestedDiscount: 0,
    note: "",
  });

  const [deliveryDate, setDeliveryDate] = useState<string>(
    quotation?.requestedDeliveryDate ?? "",
  );
  const [chatMessage, setChatMessage] = useState<string>("");

  // Submit discount counter-offer
  const handleSubmitCounterOffer = () => {
    if (!quotation) return;
    try {
      negotiationActions.submitRequest(
        quotation.id,
        [
          {
            lineId: discountModal.lineId,
            requestedDiscountPct: discountModal.requestedDiscount,
            note: discountModal.note,
          },
        ],
        discountModal.note,
        deliveryDate || undefined,
      );
      toast.success("Negotiation request submitted to your sales account team.");
      setDiscountModal({ ...discountModal, open: false });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit negotiation");
    }
  };

  // Send message
  const handleSendMessage = () => {
    if (!quotation || !chatMessage.trim()) return;
    try {
      negotiationActions.reply(quotation.id, chatMessage);
      setChatMessage("");
      toast.success("Message sent to sales rep.");
    } catch (err: any) {
      toast.error(err.message || "Message failed");
    }
  };

  // Confirm quotation from customer end
  const handleCustomerAccept = () => {
    if (!quotation) return;
    try {
      quotationActions.confirm(quotation.id);
      toast.success("Quotation accepted! Your order has been scheduled for dispatch.");
    } catch (err: any) {
      toast.error(err.message || "Acceptance failed");
    }
  };

  // Internal review simulator (shows how sales rep responds and triggers re-approval)
  const handleInternalRespond = (requestId: string, accept: boolean) => {
    if (!quotation) return;
    try {
      const res = negotiationActions.respond(
        quotation.id,
        requestId,
        accept,
        accept ? "Counter terms approved by sales." : "Cannot honor requested terms.",
      );
      if (res?.reapproval) {
        toast.warning(
          `Counter discount accepted! New terms exceed category ceiling, triggering automated RE-APPROVAL at ${res.evaluation.riskLevel} risk!`,
        );
      } else {
        toast.success(accept ? "Counter discount accepted." : "Counter discount declined.");
      }
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

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
              <h1 className="text-lg font-bold text-foreground">{customer?.name}</h1>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {customer?.tier} Account Tier
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Customer Contact: {session?.name} ({session?.email}) · Secure Procurement Portal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Restricted Data View (Internal margins & audits protected)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Customer Quotations */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Your Commercial Proposals ({myQuotations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {myQuotations.map((q) => {
              const active = q.id === selectedQuoteId;
              const qTotals = totalsOf(state, q);

              return (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-primary">{q.number}</span>
                    <Badge
                      variant={
                        q.stage === "APPROVED" || q.stage === "PAID"
                          ? "secondary"
                          : q.stage === "PENDING_APPROVAL"
                            ? "outline"
                            : "outline"
                      }
                      className="text-[9px] uppercase font-mono py-0 px-1"
                    >
                      {stageLabel(q.stage)}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {q.lines.length} items · Total Contract: ₹{qTotals.total.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                    <span>Issued: {new Date(q.createdAt).toLocaleDateString()}</span>
                    {q.requests.length > 0 && (
                      <span className="text-amber-600 font-medium">
                        {q.requests.length} open negotiation request
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {myQuotations.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">No proposals found.</p>
            )}
          </CardContent>
        </Card>

        {/* Right 2 Cols: Quotation Negotiation & Line Review */}
        <div className="lg:col-span-2 space-y-6">
          {quotation && totals ? (
            <>
              <Card className="shadow-xs">
                <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold font-mono text-primary">
                        {quotation.number}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs font-mono uppercase">
                        {stageLabel(quotation.stage)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Net Total: <strong className="text-foreground">₹{totals.total.toLocaleString()}</strong> (Includes ₹{totals.tax.toLocaleString()} tax)
                    </CardDescription>
                  </div>

                  {/* Customer Confirm Action */}
                  {quotation.stage === "APPROVED" && (
                    <Button
                      size="sm"
                      onClick={handleCustomerAccept}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Sign & Accept Proposal
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {/* Lines Table with Negotiation Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground">Commercial Equipment & Services</div>
                      <span className="text-[11px] text-muted-foreground">Click "Request Revision" to counter</span>
                    </div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Product / Service</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">List Price</TableHead>
                            <TableHead className="text-right">Offered Discount</TableHead>
                            <TableHead className="text-right">Net Price</TableHead>
                            <TableHead className="text-right w-28">Negotiate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {quotation.lines.map((l) => {
                            const p = products[l.productId];
                            const net = lineNet(l);
                            const req = quotation.requests.find(
                              (r) => r.lineId === l.id && r.status === "OPEN",
                            );

                            return (
                              <TableRow key={l.id}>
                                <TableCell>
                                  <div className="font-medium">{p?.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{p?.description}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{l.qty}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  ₹{l.unitPrice}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-emerald-600">
                                  {l.discountPct}% off
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold">
                                  ₹{net.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  {req ? (
                                    <Badge variant="outline" className="text-[10px] font-mono text-amber-600">
                                      Req: {req.requestedDiscountPct}%
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setDiscountModal({
                                          open: true,
                                          lineId: l.id,
                                          productName: p?.name ?? "Product",
                                          currentDiscount: l.discountPct,
                                          requestedDiscount: l.discountPct + 4,
                                          note: "",
                                        })
                                      }
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Request Revision
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Active Negotiation Requests & Internal Rep Response Simulator */}
                  {quotation.requests.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Active Term Change Requests</span>
                        <span className="text-[10px] text-muted-foreground">
                          (Sales review simulation controls available below)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {quotation.requests.map((r) => {
                          const line = quotation.lines.find((l) => l.id === r.lineId);
                          const prod = products[line?.productId ?? ""];
                          return (
                            <div
                              key={r.id}
                              className="p-3 rounded-lg border border-border bg-card text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-semibold text-foreground">
                                  {prod?.name}: Requested {r.requestedDiscountPct}% Discount (Currently {line?.discountPct}%)
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                                  "{r.note}"
                                </p>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Status: <strong className="font-mono">{r.status}</strong> · Submitted: {new Date(r.at).toLocaleDateString()}
                                </div>
                              </div>

                              {r.status === "OPEN" && (
                                <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-md border border-border">
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    Sales Rep Action:
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleInternalRespond(r.id, false)}
                                    className="h-6 text-[10px] text-destructive"
                                  >
                                    Decline
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleInternalRespond(r.id, true)}
                                    className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    Accept (Re-evaluates Risk)
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Negotiation Discussion Thread */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      Direct Account Discussion & Messages
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-3 rounded-lg border border-border bg-muted/20">
                      {quotation.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg text-xs space-y-1 max-w-[85%] ${
                            m.role === "CUSTOMER"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-card border border-border text-card-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-80">
                            <span className="font-semibold">{m.author}</span>
                            <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-xs">{m.body}</p>
                        </div>
                      ))}
                      {quotation.messages.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Send a note below.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Write a message to your sales account executive..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="text-xs h-8"
                      />
                      <Button size="sm" onClick={handleSendMessage} className="h-8 text-xs">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select a commercial proposal from the left to view terms and discuss revisions.
            </Card>
          )}
        </div>
      </div>

      {/* Counter-Offer Revision Modal */}
      <Dialog
        open={discountModal.open}
        onOpenChange={(open) => setDiscountModal({ ...discountModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Request Discount Adjustment: {discountModal.productName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Submit your preferred counter-offer discount percentage and justification note.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3 text-xs">
            <div className="flex justify-between items-center p-2 rounded bg-muted/40">
              <span className="text-muted-foreground">Current Offered Discount:</span>
              <span className="font-mono font-bold text-foreground">{discountModal.currentDiscount}%</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Requested Counter Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={50}
                value={discountModal.requestedDiscount}
                onChange={(e) =>
                  setDiscountModal({
                    ...discountModal,
                    requestedDiscount: parseFloat(e.target.value) || 0,
                  })
                }
                className="text-xs font-mono font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Target Delivery Date (Optional)</label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Procurement Justification</label>
              <Input
                placeholder="e.g. Budget ceiling requires a 16% discount on laptop fleet."
                value={discountModal.note}
                onChange={(e) => setDiscountModal({ ...discountModal, note: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDiscountModal({ ...discountModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitCounterOffer} className="text-xs">
              Submit Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
