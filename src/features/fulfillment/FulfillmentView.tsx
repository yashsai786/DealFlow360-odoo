import React, { useState } from "react";
import {
  useAppState,
  productMap,
  splitFor,
  fulfillmentActions,
  customerMap,
} from "../../infrastructure/store";
import { canConsolidate } from "../../modules/fulfillment/service";
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
  PackageCheck,
  Truck,
  Building,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Boxes,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export function FulfillmentView() {
  const state = useAppState();
  const products = productMap(state);
  const customers = customerMap(state);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    state.orders[0]?.id ?? "",
  );

  const [overrideModal, setOverrideModal] = useState<{
    open: boolean;
    allocations: { warehouseId: string; productId: string; qty: number }[];
  }>({
    open: false,
    allocations: [],
  });

  const order = state.orders.find((o) => o.id === selectedOrderId);
  const quotation = order
    ? state.quotations.find((q) => q.id === order.quotationId)
    : null;
  const customer = quotation ? customers[quotation.customerId] : null;
  const suggestedSplit = order ? splitFor(state, order) : null;

  // Automated check: Are there open backorders on this order that can now be consolidated?
  const consolidatableBackorders = (order?.backorders || []).filter(
    (bo) => bo.status === "OPEN" && canConsolidate(bo, state.inventory)
  );

  // Accept suggested split
  const handleAcceptSplit = () => {
    if (!order) return;
    try {
      const res = fulfillmentActions.acceptSplit(order.id);
      if (res?.backorders.length) {
        toast.warning(
          `Allocated available stock. ${res.backorders[0]?.qty} units placed on backorder due to depot shortages.`,
        );
      } else {
        toast.success("Warehouse split accepted! All units successfully allocated.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to allocate");
    }
  };

  // Ship order
  const handleShip = () => {
    if (!order) return;
    try {
      fulfillmentActions.ship(order.id);
      toast.success("Order marked as SHIPPED! Delivery dispatched from warehouses.");
    } catch (err: any) {
      toast.error(err.message || "Cannot ship order");
    }
  };

  // Replenish stock
  const handleReplenish = (warehouseId: string, productId: string, qty: number) => {
    try {
      fulfillmentActions.replenish(warehouseId, productId, qty);
      toast.success(
        `Added ${qty} units to ${state.warehouses.find((w) => w.id === warehouseId)?.name}.`,
      );
    } catch (err: any) {
      toast.error(err.message || "Replenishment failed");
    }
  };

  // Consolidate backorder
  const handleConsolidate = (backorderId: string) => {
    if (!order) return;
    try {
      fulfillmentActions.consolidate(order.id, backorderId);
      toast.success("Consolidated backorder into shipment!");
    } catch (err: any) {
      toast.error(err.message || "Cannot consolidate backorder");
    }
  };

  // Open manual override
  const handleOpenOverride = () => {
    if (!order || !quotation) return;
    const initial: { warehouseId: string; productId: string; qty: number }[] = [];
    const hardwareLines = quotation.lines.filter(
      (l) => products[l.productId]?.category === "Hardware",
    );

    for (const l of hardwareLines) {
      for (const w of state.warehouses) {
        const existing = order.allocations.find(
          (a) => a.warehouseId === w.id && a.productId === l.productId,
        );
        initial.push({
          warehouseId: w.id,
          productId: l.productId,
          qty: existing?.qty ?? 0,
        });
      }
    }
    setOverrideModal({ open: true, allocations: initial });
  };

  const handleSaveOverride = () => {
    if (!order) return;
    try {
      fulfillmentActions.overrideSplit(order.id, overrideModal.allocations);
      toast.success("Manual warehouse allocation applied!");
      setOverrideModal({ open: false, allocations: [] });
    } catch (err: any) {
      toast.error(err.message || "Override validation failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Fulfillment & Multi-Depot Inventory</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cost-optimal warehouse allocation, automated backorders, and multi-hub dispatch.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Queue */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-primary" />
              Fulfillment Orders ({state.orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {state.orders.map((o) => {
              const q = state.quotations.find((x) => x.id === o.quotationId);
              const cust = customers[q?.customerId ?? ""];
              const active = o.id === selectedOrderId;

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-primary">{q?.number}</span>
                    <Badge
                      variant={
                        o.status === "SHIPPED"
                          ? "secondary"
                          : o.status === "BACKORDERED"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-[9px] uppercase font-mono py-0 px-1"
                    >
                      {o.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-medium text-foreground mt-0.5">{cust?.name}</div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Due: {new Date(o.dueAt).toLocaleDateString()}</span>
                    <span>{o.allocations.length} shipments</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Order Detail View */}
        <div className="lg:col-span-2 space-y-6">
          {order && quotation && customer ? (
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold font-mono text-primary">
                      {quotation.number} Fulfillment
                    </CardTitle>
                    <Badge
                      variant={
                        order.status === "SHIPPED"
                          ? "secondary"
                          : order.status === "BACKORDERED"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-xs uppercase font-mono"
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Customer: <strong className="text-foreground">{customer.name}</strong> · Promised Delivery: {quotation.promisedDeliveryDate ? new Date(quotation.promisedDeliveryDate).toLocaleDateString() : "Pending"}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {order.status !== "SHIPPED" && (
                    <Button
                      size="sm"
                      onClick={handleShip}
                      disabled={order.allocations.length === 0}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <Truck className="h-3.5 w-3.5 mr-1" />
                      Ship Order
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* Mid-Fulfillment Stock Arrival Prompt (Appears Automatically when stock arrives) */}
                {consolidatableBackorders.length > 0 && (
                  <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 shadow-md space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2.5 py-0.5 uppercase tracking-wider font-bold animate-pulse">
                          ⚡ Stock Arrived Mid-Fulfillment
                        </Badge>
                        <span className="font-bold text-xs text-foreground">
                          Inbound Inventory Detected for Pending Backorder
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                        Ready to Consolidate
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      New stock arrived at regional depots mid-fulfillment! Available on-hand inventory is now sufficient to eliminate remaining backorders and fulfill the order in full without delivery delays.
                    </p>

                    <div className="space-y-2 pt-1">
                      {consolidatableBackorders.map((bo) => {
                        const prod = products[bo.productId];
                        const freeStock = state.inventory
                          .filter((i) => i.productId === bo.productId)
                          .reduce((s, i) => s + Math.max(0, i.available - i.reserved), 0);
                        return (
                          <div
                            key={bo.id}
                            className="p-3 rounded-lg bg-background border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                          >
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-2">
                                <span>{prod?.name || bo.productId}</span>
                                <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-400">
                                  {bo.qty} Units On Backorder
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Available free depot inventory: <strong className="text-emerald-600 font-mono">{freeStock} units</strong>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleConsolidate(bo.id)}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              Consolidate Remaining Backorder
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cost-Optimal Warehouse Split Recommendation (B6) */}
                {suggestedSplit && order.status !== "SHIPPED" && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3.5 text-xs shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-3">
                      <div>
                        <div className="font-semibold text-primary flex items-center gap-1.5 text-sm">
                          <Boxes className="h-4 w-4" />
                          Recommended Warehouse Split (Live Stock Optimal)
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Greedy cost-optimal allocation selects nearest depot stock with lowest freight surcharge to minimize transit emissions and cost.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs bg-background">
                          {suggestedSplit.shipmentCount} {suggestedSplit.shipmentCount === 1 ? "Shipment" : "Shipments"}
                        </Badge>
                        <Badge className="font-mono text-xs bg-primary text-primary-foreground">
                          Est. Freight: ₹{suggestedSplit.shippingCost.toLocaleString()}
                        </Badge>
                      </div>
                    </div>

                    {/* Displays: Warehouse name, Quantity fulfilled from that warehouse, freight */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {suggestedSplit.allocations.map((a, i) => {
                        const wh = state.warehouses.find((w) => w.id === a.warehouseId);
                        const prod = products[a.productId];
                        return (
                          <div key={i} className="p-3 rounded-lg bg-background border border-border text-xs space-y-1 shadow-xs">
                            <div className="flex items-center justify-between font-semibold text-foreground">
                              <span>{wh?.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">₹{a.shipmentCost} freight</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">{wh?.location}</div>
                            <div className="pt-1 text-[11px] text-foreground border-t border-border/60 flex items-center justify-between">
                              <span className="truncate">{prod?.name}</span>
                              <strong className="text-primary font-mono ml-1">{a.qty} units</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Shortage notice if total stock < order requirements */}
                    {suggestedSplit.shortages.length > 0 && (
                      <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                          <span>
                            Depot Shortage: {suggestedSplit.shortages.map((s) => `${s.qty} × ${products[s.productId]?.name || s.productId}`).join(", ")} will be placed on Backorder until inbound replenishment.
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold">Auto-Backorder</span>
                      </div>
                    )}

                    {/* B6 Action Buttons: Accept Suggested Split & Manual Override side-by-side */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenOverride}
                        className="h-8 text-xs bg-background hover:bg-muted"
                      >
                        <Sliders className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Manual Override
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAcceptSplit}
                        className="h-8 text-xs bg-primary text-primary-foreground font-semibold shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Accept Suggested Split
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Allocations Table */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground">Current Warehouse Dispatch Allocations</div>
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead>Warehouse Depot</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Allocated Qty</TableHead>
                          <TableHead className="text-right">Freight Surcharge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {order.allocations.map((a, idx) => {
                          const wh = state.warehouses.find((w) => w.id === a.warehouseId);
                          const prod = products[a.productId];
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-semibold">{wh?.name}</TableCell>
                              <TableCell className="text-muted-foreground">{wh?.location}</TableCell>
                              <TableCell>{prod?.name}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-primary">
                                {a.qty} units
                              </TableCell>
                              <TableCell className="text-right font-mono">₹{a.shipmentCost}</TableCell>
                            </TableRow>
                          );
                        })}
                        {order.allocations.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                              No warehouse allocations assigned yet. Click "Accept Suggested Split" above.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Backorders Section */}
                {order.backorders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-rose-600 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Pending Backorders (Pending Inbound Stock)
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Consolidation prompt triggers automatically when stock arrives
                      </span>
                    </div>
                    <div className="space-y-2">
                      {order.backorders.map((bo) => {
                        const prod = products[bo.productId];
                        const freeStock = state.inventory
                          .filter((i) => i.productId === bo.productId)
                          .reduce((s, i) => s + Math.max(0, i.available - i.reserved), 0);
                        const canCons = freeStock >= bo.qty && bo.status === "OPEN";

                        return (
                          <div
                            key={bo.id}
                            className="p-3 rounded-lg border border-rose-200 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                                <span>{bo.qty} × {prod?.name}</span>
                                <Badge variant={bo.status === "OPEN" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                                  {bo.status}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Free stock in depots:{" "}
                                <span className={freeStock >= bo.qty ? "text-emerald-600 font-bold font-mono" : "text-rose-600 font-bold font-mono"}>
                                  {freeStock} units
                                </span>{" "}
                                (Required: {bo.qty})
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReplenish("wh-main", bo.productId, bo.qty)}
                                className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                              >
                                <PlusCircle className="h-3 w-3 mr-1 text-emerald-600" />
                                Simulate +{bo.qty} Inbound
                              </Button>
                              <Button
                                size="sm"
                                disabled={!canCons}
                                onClick={() => handleConsolidate(bo.id)}
                                className={`h-7 text-[11px] ${
                                  canCons ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" : ""
                                }`}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Consolidate Backorder
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-xs p-10 text-center text-muted-foreground text-xs">
              Select an order from the queue to view warehouse dispatch options.
            </Card>
          )}

          {/* Depot Live Inventory Status Table */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" />
                Live Depot Inventory Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On-Hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Free Available</TableHead>
                    <TableHead className="text-right w-24">Replenish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {state.inventory.map((item, idx) => {
                    const wh = state.warehouses.find((w) => w.id === item.warehouseId);
                    const prod = products[item.productId];
                    const free = item.available - item.reserved;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{wh?.name}</TableCell>
                        <TableCell>{prod?.name}</TableCell>
                        <TableCell className="text-right font-mono">{item.available}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {item.reserved}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600">
                          {free}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReplenish(item.warehouseId, item.productId, 10)}
                            className="h-6 text-[10px] px-1.5"
                          >
                            +10 Inbound
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual Override Allocation Modal */}
      <Dialog
        open={overrideModal.open}
        onOpenChange={(open) => setOverrideModal({ ...overrideModal, open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Manual Warehouse Override</DialogTitle>
            <DialogDescription className="text-xs">
              Directly specify the units to pull from each depot. Cannot exceed available stock.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3 max-h-80 overflow-y-auto">
            {overrideModal.allocations.map((alloc, idx) => {
              const wh = state.warehouses.find((w) => w.id === alloc.warehouseId);
              const prod = products[alloc.productId];
              const inv = state.inventory.find(
                (i) => i.warehouseId === alloc.warehouseId && i.productId === alloc.productId,
              );
              const free = (inv?.available ?? 0) - (inv?.reserved ?? 0);

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold">{wh?.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {prod?.name} · {free} units free in depot
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={alloc.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const next = [...overrideModal.allocations];
                        next[idx] = { ...alloc, qty: val };
                        setOverrideModal({ ...overrideModal, allocations: next });
                      }}
                      className="h-7 w-20 text-xs text-right font-mono"
                    />
                    <span className="text-muted-foreground text-xs">units</span>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOverrideModal({ open: false, allocations: [] })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveOverride} className="text-xs">
              Apply Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
