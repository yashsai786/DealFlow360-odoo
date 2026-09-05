import React, { useState } from "react";
import {
  useAppState,
  productMap,
  splitFor,
  fulfillmentActions,
  customerMap,
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
  PackageCheck,
  Truck,
  Building,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Boxes,
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
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenOverride}
                        className="h-8 text-xs"
                      >
                        Manual Override
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleShip}
                        disabled={order.allocations.length === 0}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        Ship Order
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* Cost-Optimal Warehouse Split Recommendation */}
                {suggestedSplit && order.status === "AWAITING" && (
                  <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary flex items-center gap-1.5">
                        <Boxes className="h-4 w-4" />
                        Recommended Least-Cost Warehouse Split
                      </div>
                      <div className="font-mono text-foreground font-medium">
                        Shipments: {suggestedSplit.shipmentCount} · Freight Cost: ₹{suggestedSplit.shippingCost}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Our greedy allocation prioritizes nearest stock with lowest freight surcharge to minimize transit emissions and cost.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {suggestedSplit.allocations.map((a, i) => {
                        const wh = state.warehouses.find((w) => w.id === a.warehouseId);
                        const prod = products[a.productId];
                        return (
                          <div key={i} className="p-2 rounded bg-background border border-border text-[11px] space-y-0.5">
                            <div className="font-semibold text-foreground">{wh?.name}</div>
                            <div className="text-muted-foreground">
                              {prod?.name}: <strong className="text-primary">{a.qty} units</strong>
                            </div>
                            <div className="text-[10px] text-muted-foreground">Freight: ₹{a.shipmentCost}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button size="sm" onClick={handleAcceptSplit} className="h-7 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
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
                    <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Active Backorders (Insufficient Depot Stock)
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
                              <div className="font-semibold text-rose-800 dark:text-rose-300">
                                {bo.qty} × {prod?.name} ({bo.status})
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Free available across depots: {freeStock} units
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReplenish("wh-main", bo.productId, bo.qty)}
                                className="h-7 text-[10px]"
                              >
                                <PlusCircle className="h-3 w-3 mr-1 text-emerald-600" />
                                Simulate +{bo.qty} Inbound
                              </Button>
                              <Button
                                size="sm"
                                disabled={!canCons}
                                onClick={() => handleConsolidate(bo.id)}
                                className="h-7 text-[10px]"
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
