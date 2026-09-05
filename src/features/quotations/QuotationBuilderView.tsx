import React, { useState } from "react";
import {
  useAppState,
  productMap,
  customerMap,
  totalsOf,
  evaluate,
  quotationActions,
} from "../../infrastructure/store";
import { stageLabel, lineNet, lineMargin } from "../../modules/quotations/service";
import { getRecommendations } from "../../modules/recommendations/service";
import type { CustomerTier, ProductCategory } from "../../modules/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Send,
  PackagePlus,
  IndianRupee,
  TrendingUp,
  Minus,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

interface QuotationBuilderViewProps {
  quotationId?: string | undefined;
  onBack: () => void;
  onNavigateToApproval?: ((approvalId: string) => void) | undefined;
}

export function QuotationBuilderView({
  quotationId,
  onBack,
  onNavigateToApproval: _onNavigateToApproval,
}: QuotationBuilderViewProps) {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);

  // If no quotationId provided, or new quote mode
  const [activeQuoteId, setActiveQuoteId] = useState<string | undefined>(quotationId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    state.customers[0]?.id ?? "c-acme",
  );
  const [selectedProductId, setSelectedProductId] = useState<string>(
    state.products[0]?.id ?? "p-laptop",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Find the active quotation or null
  const quotation = state.quotations.find((q) => q.id === activeQuoteId);
  const customer = quotation
    ? customers[quotation.customerId]
    : customers[selectedCustomerId];

  // If creating new quote
  const handleCreateDraft = async () => {
    try {
      const q = await quotationActions.create(selectedCustomerId);
      setActiveQuoteId(q.id);
      toast.success(`Created draft quotation ${q.number}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create quotation");
    }
  };

  // If no quote active yet, show initialization card
  if (!quotation) {
    return (
      <div className="max-w-xl mx-auto py-10 space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Quotations
        </Button>
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold">New Commercial Quotation</CardTitle>
            <CardDescription className="text-xs">
              Select an enterprise customer to start constructing the quote.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Select Customer Account</label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {state.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} ({c.tier} Tier · {c.industry})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {customer && (
              <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{customer.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {customer.tier} Tier
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Discount Allowance: {state.governance.tierCeilings[customer.tier as CustomerTier]}% max tier discount.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end">
            <Button size="sm" onClick={handleCreateDraft} className="text-xs font-medium">
              Initialize Quotation Builder
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Active quotation data
  const totals = totalsOf(state, quotation);
  const evaluation = evaluate(state, quotation);
  const recommendations = getRecommendations(quotation, products);

  // Line operations
  const handleAddLine = async (prodId?: string) => {
    const idToAdd = prodId || selectedProductId;
    try {
      await quotationActions.addLine(quotation.id, idToAdd, 1);
      toast.success(`Added ${products[idToAdd]?.name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add line");
    }
  };

  const handleUpdateDiscount = async (lineId: string, disc: number) => {
    try {
      await quotationActions.updateLine(quotation.id, lineId, { discountPct: Math.max(0, Math.min(100, disc)) });
    } catch (err: any) {
      toast.error(err.message || "Cannot update line");
    }
  };

  const handleUpdateQty = async (lineId: string, qty: number) => {
    try {
      await quotationActions.updateLine(quotation.id, lineId, { qty: Math.max(1, qty) });
    } catch (err: any) {
      toast.error(err.message || "Cannot update line");
    }
  };

  const [orderDiscount, setOrderDiscount] = useState<string>("");

  const handleApplyOrderDiscount = async () => {
    if (!quotation || quotation.lines.length === 0) return;
    const disc = parseFloat(orderDiscount);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      toast.error("Please enter a valid discount percentage (0-100)");
      return;
    }
    try {
      for (const line of quotation.lines) {
        await quotationActions.updateLine(quotation.id, line.id, { discountPct: disc });
      }
      toast.success(`Applied ${disc}% order-level discount across all ${quotation.lines.length} lines`);
      setOrderDiscount("");
    } catch (err: any) {
      toast.error("Failed to apply order-level discount");
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    try {
      await quotationActions.removeLine(quotation.id, lineId);
    } catch (err: any) {
      toast.error(err.message || "Cannot remove line");
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      const res = await quotationActions.submitForApproval(quotation.id);
      if (res?.autoApproved) {
        toast.success("Quotation auto-approved! Discounts are within policy.");
      } else {
        toast.warning(
          `Elevated ${res?.evaluation.riskLevel} risk detected. Routed to ${res?.evaluation.approvalChain.map((r) => r.replace("_", " ")).join(", ")}.`,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    }
  };

  const handleConfirmQuotation = async () => {
    try {
      await quotationActions.confirm(quotation.id);
      toast.success("Quotation confirmed! Fulfillment orders, invoices, and subscriptions generated.");
    } catch (err: any) {
      toast.error(err.message || "Confirmation failed");
    }
  };

  const filteredProducts = state.products.filter(
    (p) => categoryFilter === "all" || p.category === categoryFilter,
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-foreground">{quotation.number}</h1>
              <Badge
                variant={
                  quotation.stage === "APPROVED" || quotation.stage === "PAID"
                    ? "secondary"
                    : quotation.stage === "PENDING_APPROVAL"
                      ? "destructive"
                      : "outline"
                }
                className="text-xs uppercase font-mono"
              >
                {stageLabel(quotation.stage)}
              </Badge>
              {quotation.escalated && (
                <Badge variant="destructive" className="text-[10px] uppercase">
                  Escalated
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer: <span className="font-semibold text-foreground">{customer?.name}</span> · {customer?.tier} Tier · Owner: {state.users.find((u) => u.id === quotation.ownerId)?.name ?? "Rep"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.stage) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSubmitForApproval}
              disabled={quotation.lines.length === 0}
              className="h-8 text-xs font-medium"
            >
              <Send className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Submit for Approval
            </Button>
          )}

          {quotation.stage === "APPROVED" && (
            <Button
              size="sm"
              onClick={handleConfirmQuotation}
              className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Confirm & Book Order
            </Button>
          )}
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Catalog Picker & Lines Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Products Section */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold">Catalog Product Search</CardTitle>
                <CardDescription className="text-[11px]">
                  Add hardware, professional services, or cloud subscriptions
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                {(["all", "Hardware", "Services", "Subscriptions"] as const).map((cat) => (
                  <Button
                    key={cat}
                    variant={categoryFilter === cat ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setCategoryFilter(cat)}
                    className="h-6 text-[10px] px-2"
                  >
                    {cat === "all" ? "All" : cat}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1 text-xs">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} — ₹{p.price.toLocaleString()} / {p.unit} ({p.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => handleAddLine()} className="h-9 text-xs w-full sm:w-auto">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Line Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quotation Line Items Table */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xs font-semibold">Quotation Line Items</CardTitle>
                <CardDescription className="text-[11px]">
                  Real-time discount governance evaluation per line
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Order Level Discount Control */}
                {quotation.lines.length > 0 && ["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.stage) && (
                  <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-md px-2 py-0.5">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">Order Discount:</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="0"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(e.target.value)}
                      className="h-6 w-12 text-xs text-center p-0.5 font-mono"
                    />
                    <span className="text-[11px] text-muted-foreground">%</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 text-[10px] px-2 font-medium"
                      onClick={handleApplyOrderDiscount}
                    >
                      Apply to All
                    </Button>
                  </div>
                )}
                <Badge variant="outline" className="text-xs font-mono">
                  {quotation.lines.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>Product / Category</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-24">Unit Price</TableHead>
                    <TableHead className="w-28">Discount %</TableHead>
                    <TableHead className="w-28">Governance</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {quotation.lines.map((l) => {
                    const product = products[l.productId];
                    const net = lineNet(l);
                    const margin = product ? lineMargin(l, product) : 0;
                    const lineEval = evaluation.lines.find((el) => el.lineId === l.id);

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="space-y-0.5">
                          <div className="font-medium text-foreground">{product?.name ?? l.productId}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal">
                              {product?.category}
                            </Badge>
                            <span>Margin: ₹{margin.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-6 text-xs p-0"
                              onClick={() => handleUpdateQty(l.id, Math.max(1, l.qty - 1))}
                              disabled={!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.stage)}
                              title="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) => handleUpdateQty(l.id, parseInt(e.target.value) || 1)}
                              disabled={!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.stage)}
                              className="h-7 w-12 text-xs text-center p-0.5 font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-6 text-xs p-0"
                              onClick={() => handleUpdateQty(l.id, l.qty + 1)}
                              disabled={!["DRAFT", "APPROVED", "NEGOTIATION"].includes(quotation.stage)}
                              title="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          ₹{l.unitPrice.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={l.discountPct}
                              onChange={(e) => handleUpdateDiscount(l.id, parseFloat(e.target.value) || 0)}
                              className="h-7 w-16 text-xs text-center p-1 font-mono"
                            />
                            <span className="text-muted-foreground text-xs">%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lineEval?.violating ? (
                            <Badge variant="destructive" className="text-[10px] font-mono py-0 px-1">
                              +{lineEval.overagePct}% over {lineEval.ceilingPct}%
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1 text-emerald-700 dark:text-emerald-300">
                              Valid &le; {lineEval?.ceilingPct}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ₹{net.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLine(l.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {quotation.lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                        No product lines in this quotation. Add products above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Upsell / Cross-sell Recommendations */}
          {recommendations.length > 0 && (
            <Card className="shadow-xs border-primary/20 bg-primary/5">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                  <Sparkles className="h-4 w-4" />
                  Intelligent Upsell & Cross-Sell Recommendations
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Algorithms derived from co-purchase affinity graph and margin optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.productId}
                    className="p-3 rounded-lg border border-border bg-card text-card-foreground space-y-2 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between font-semibold">
                        <span>{rec.productName}</span>
                        <span className="font-mono text-primary">₹{rec.price}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{rec.reason}</p>
                      {rec.promotion && (
                        <div className="mt-1.5 text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-1 rounded">
                          {rec.promotion}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-emerald-600 font-medium">
                        +₹{rec.marginDelta.toLocaleString()} margin
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => quotationActions.dismissRecommendation(quotation.id, rec.productId)}
                          className="h-6 text-[10px] text-muted-foreground"
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => quotationActions.addRecommendation(quotation.id, rec.productId)}
                          className="h-6 text-[10px]"
                        >
                          <PackagePlus className="h-3 w-3 mr-1" />
                          Add to Quote
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Commercial Totals & Blended Risk Governance */}
        <div className="space-y-6">
          {/* Commercial Totals Card */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                Commercial Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Value</span>
                <span className="font-mono">₹{totals.gross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Discount</span>
                <span className="font-mono text-rose-600">-₹{totals.discount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Tax</span>
                <span className="font-mono">₹{totals.tax.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between font-bold text-sm">
                <span>Net Total Contract</span>
                <span className="font-mono text-primary">₹{totals.total.toLocaleString()}</span>
              </div>

              {/* One-time vs Recurring Breakdown */}
              <div className="p-2.5 rounded-lg bg-muted/40 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">One-Time (Hardware & Setup):</span>
                  <span className="font-mono font-medium">₹{totals.oneTimeTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recurring (Care Plans / Subscriptions):</span>
                  <span className="font-mono font-medium">₹{totals.recurringTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Profitability Margin */}
              <div className="p-2.5 rounded-lg border border-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    Gross Profit Margin
                  </div>
                  <div className="text-[10px] text-muted-foreground">After direct equipment & delivery cost</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-600">₹{totals.margin.toLocaleString()}</div>
                  <div className="text-[10px] font-semibold">{totals.marginPct}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discount Governance & Blended Risk Card */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Discount Governance Engine
                </CardTitle>
                <Badge
                  variant={
                    evaluation.riskLevel === "HIGH"
                      ? "destructive"
                      : evaluation.riskLevel === "MEDIUM"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs font-mono uppercase"
                >
                  {evaluation.riskLevel} Risk
                </Badge>
              </div>
              <CardDescription className="text-[11px]">
                Autonomous policy compliance check
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Customer Tier Ceiling</span>
                <span className="font-mono font-semibold">{evaluation.tierCeilingPct}% ({evaluation.tier})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Blended Quote Discount</span>
                <span className="font-mono font-semibold">{evaluation.blendedDiscountPct}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Risk Score Index</span>
                <span className="font-mono font-bold text-primary">{evaluation.riskScore} / 100</span>
              </div>

              {/* Policy Reasons */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="text-[11px] font-semibold text-foreground">Governance Audit Reasons:</div>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {evaluation.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Required Approval Chain */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="text-[11px] font-semibold text-foreground">Required Approval Chain:</div>
                {evaluation.approvalChain.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Auto-Approved — Inside standard policy thresholds</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {evaluation.approvalChain.map((role, idx) => (
                      <div
                        key={role}
                        className="flex items-center justify-between text-[11px] bg-muted/50 p-1.5 rounded"
                      >
                        <span>
                          Step {idx + 1}: <strong className="text-foreground">{role.replace("_", " ")}</strong>
                        </span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                          Mandatory
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
