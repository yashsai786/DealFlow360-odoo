import React, { useState } from "react";
import {
  useAppState,
  customerMap,
  billingActions,
} from "../../infrastructure/store";
import { outstanding, paidAmount } from "../../modules/billing/service";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Receipt,
  IndianRupee,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { canPerformAction } from "../../modules/identity/permissions";

export function InvoicesView() {
  const state = useAppState();
  const customers = customerMap(state);
  const session = state.session;
  const canRecordPayment = canPerformAction(session?.role, "invoice.payment");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    state.invoices[0]?.id ?? "",
  );

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    amount: string;
    method: string;
  }>({
    open: false,
    amount: "",
    method: "Wire Transfer",
  });

  const selectedInvoice = state.invoices.find((i) => i.id === selectedInvoiceId);
  const quotation = selectedInvoice
    ? state.quotations.find((q) => q.id === selectedInvoice.quotationId)
    : null;
  const customer = selectedInvoice ? customers[selectedInvoice.customerId] : null;

  const invoicePaid = selectedInvoice ? paidAmount(selectedInvoice) : 0;
  const invoiceDue = selectedInvoice ? outstanding(selectedInvoice) : 0;

  const handleRecordPayment = () => {
    if (!selectedInvoice) return;
    const amountNum = parseFloat(paymentModal.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (amountNum > invoiceDue + 0.01) {
      toast.error(`Payment cannot exceed outstanding balance of ₹${invoiceDue.toLocaleString()}`);
      return;
    }

    try {
      const status = billingActions.recordPayment(
        selectedInvoice.id,
        amountNum,
        paymentModal.method,
      );
      toast.success(
        status === "PAID"
          ? "Payment recorded! Invoice is now fully PAID."
          : `Partial payment of ₹${amountNum.toLocaleString()} recorded. Remaining: ₹${(invoiceDue - amountNum).toLocaleString()}`,
      );
      setPaymentModal({ open: false, amount: "", method: "Wire Transfer" });
    } catch (err: any) {
      toast.error(err.message || "Payment recording failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoicing & Cash Reconciliation</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Order billing, multi-tranche partial payment reconciliation, and ledger settlement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices List */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-primary" />
              Customer Invoices ({state.invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {state.invoices.map((inv) => {
              const cust = customers[inv.customerId];
              const due = outstanding(inv);
              const active = inv.id === selectedInvoiceId;

              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-primary">{inv.number}</span>
                    <Badge
                      variant={
                        inv.status === "PAID"
                          ? "secondary"
                          : inv.status === "PARTIALLY_PAID"
                            ? "outline"
                            : inv.status === "OVERDUE"
                              ? "destructive"
                              : "outline"
                      }
                      className="text-[9px] uppercase font-mono py-0 px-1"
                    >
                      {inv.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-medium text-foreground mt-0.5">{cust?.name}</div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="font-mono font-medium text-foreground">
                      ₹{inv.amount.toLocaleString()}
                    </span>
                    <span className={due > 0 ? "text-rose-600 font-medium" : "text-emerald-600"}>
                      {due > 0 ? `Due: ₹${due.toLocaleString()}` : "Settled"}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Invoice Detail & Payment Settlement */}
        <div className="lg:col-span-2 space-y-6">
          {selectedInvoice && customer ? (
            <>
              <Card className="shadow-xs">
                <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold font-mono text-primary">
                        {selectedInvoice.number}
                      </CardTitle>
                      <Badge
                        variant={
                          selectedInvoice.status === "PAID"
                            ? "secondary"
                            : selectedInvoice.status === "PARTIALLY_PAID"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-xs uppercase font-mono"
                      >
                        {selectedInvoice.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Account: <strong className="text-foreground">{customer.name}</strong> · Ref: {quotation?.number ?? selectedInvoice.quotationId} · Due: {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                    </CardDescription>
                  </div>

                  {invoiceDue > 0 && (
                    canRecordPayment ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          setPaymentModal({
                            open: true,
                            amount: invoiceDue.toString(),
                            method: "Wire Transfer",
                          })
                        }
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <IndianRupee className="h-3.5 w-3.5 mr-1" />
                        Record Payment
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Read-Only Financials
                      </Badge>
                    )
                  )}
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {/* Financial Balance Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
                      <div className="text-muted-foreground text-[11px]">Total Invoice Amount</div>
                      <div className="text-lg font-bold font-mono">₹{selectedInvoice.amount.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">Includes applicable sales tax</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
                      <div className="text-muted-foreground text-[11px]">Total Payments Received</div>
                      <div className="text-lg font-bold font-mono text-emerald-600">
                        ₹{invoicePaid.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{selectedInvoice.payments.length} tranches</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
                      <div className="text-muted-foreground text-[11px]">Outstanding Receivable</div>
                      <div className="text-lg font-bold font-mono text-rose-600">
                        ₹{invoiceDue.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {invoiceDue <= 0 ? "Zero balance" : "Awaiting settlement"}
                      </div>
                    </div>
                  </div>

                  {/* Payment Tranches History Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Payment History & Reconciliation Ledger</span>
                      <span className="text-muted-foreground text-[11px]">
                        {selectedInvoice.payments.length} transactions
                      </span>
                    </div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Receipt ID</TableHead>
                            <TableHead>Date / Timestamp</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Recorded By</TableHead>
                            <TableHead className="text-right">Amount Received</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {selectedInvoice.payments.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-muted-foreground">{p.id}</TableCell>
                              <TableCell className="font-mono">
                                {new Date(p.at).toLocaleDateString()} {new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </TableCell>
                              <TableCell>{p.method}</TableCell>
                              <TableCell className="text-muted-foreground">{p.recordedBy}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-emerald-600">
                                ₹{p.amount.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          {selectedInvoice.payments.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                                No payments recorded yet for this invoice.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select an invoice from the ledger to view partial payment history.
            </Card>
          )}
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog
        open={paymentModal.open}
        onOpenChange={(open) => setPaymentModal({ ...paymentModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Record Payment Tranche</DialogTitle>
            <DialogDescription className="text-xs">
              Apply partial or complete payment against invoice #{selectedInvoice?.number}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/40 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Outstanding Balance:</span>
              <strong className="font-mono text-sm text-foreground">₹{invoiceDue.toLocaleString()}</strong>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Payment Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="1"
                max={invoiceDue}
                placeholder="Enter amount"
                value={paymentModal.amount}
                onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                className="text-xs font-mono font-bold"
              />
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setPaymentModal({
                      ...paymentModal,
                      amount: (Math.round(invoiceDue * 0.4)).toString(),
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Partial 40% (₹{Math.round(invoiceDue * 0.4).toLocaleString()})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setPaymentModal({
                      ...paymentModal,
                      amount: (Math.round(invoiceDue * 0.5)).toString(),
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Partial 50% (₹{Math.round(invoiceDue * 0.5).toLocaleString()})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setPaymentModal({
                      ...paymentModal,
                      amount: invoiceDue.toString(),
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Full Balance (₹{invoiceDue.toLocaleString()})
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Remittance Method</label>
              <Select
                value={paymentModal.method}
                onValueChange={(val) => setPaymentModal({ ...paymentModal, method: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wire Transfer" className="text-xs">Corporate Wire / RTGS</SelectItem>
                  <SelectItem value="Direct Debit" className="text-xs">ACH Direct Debit</SelectItem>
                  <SelectItem value="Corporate Card" className="text-xs">Corporate Credit Card</SelectItem>
                  <SelectItem value="Bank Check" className="text-xs">Certified Commercial Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaymentModal({ ...paymentModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleRecordPayment} className="text-xs">
              Reconcile Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
