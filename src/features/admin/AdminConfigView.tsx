import React, { useState } from "react";
import {
  useAppState,
  adminActions,
} from "../../infrastructure/store";
import type { CustomerTier, ProductCategory, Product, Warehouse, SubscriptionPlan } from "../../modules/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Settings,
  ShieldAlert,
  Package,
  Building,
  Repeat,
  Sparkles,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";

export function AdminConfigView() {
  const state = useAppState();

  // Edit product modal state
  const [productModal, setProductModal] = useState<{
    open: boolean;
    product: Product;
    isNew: boolean;
  }>({
    open: false,
    product: {
      id: "",
      name: "",
      category: "Hardware",
      unit: "unit",
      price: 100,
      cost: 50,
      taxPct: 8,
      description: "",
    },
    isNew: false,
  });

  // Category ceilings state
  const handleUpdateCategoryCeiling = (category: ProductCategory, pct: number) => {
    try {
      adminActions.setCategoryCeiling(category, pct);
      toast.success(`Updated ${category} ceiling to ${pct}%. Governance engine re-calibrated.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update ceiling");
    }
  };

  const handleUpdateTierCeiling = (tier: CustomerTier, pct: number) => {
    try {
      adminActions.setTierCeiling(tier, pct);
      toast.success(`Updated ${tier} tier ceiling to ${pct}%. Governance engine re-calibrated.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update ceiling");
    }
  };

  const handleSaveProduct = () => {
    const p = productModal.product;
    if (!p.name.trim()) {
      toast.error("Product name is required.");
      return;
    }
    const id = productModal.isNew ? `p-${Date.now()}` : p.id;
    try {
      adminActions.saveProduct({ ...p, id });
      toast.success(productModal.isNew ? `Created product ${p.name}` : `Updated ${p.name}`);
      setProductModal({ ...productModal, open: false });
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operational Administration & Governance</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure discount thresholds, product catalogs, multi-depot shipping freight, and recurring billing models.
        </p>
      </div>

      <Tabs defaultValue="governance" className="space-y-4">
        <TabsList className="bg-card border border-border h-9 p-0.5">
          <TabsTrigger value="governance" className="text-xs flex items-center gap-1.5 h-8">
            <ShieldAlert className="h-3.5 w-3.5" />
            Discount Policy Rules
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs flex items-center gap-1.5 h-8">
            <Package className="h-3.5 w-3.5" />
            Product Catalog
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="text-xs flex items-center gap-1.5 h-8">
            <Building className="h-3.5 w-3.5" />
            Warehouses & Logistics
          </TabsTrigger>
          <TabsTrigger value="plans" className="text-xs flex items-center gap-1.5 h-8">
            <Repeat className="h-3.5 w-3.5" />
            Subscription Plans
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Discount Governance Rules */}
        <TabsContent value="governance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Ceilings */}
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-xs font-semibold">Product Category Discount Ceilings</CardTitle>
                <CardDescription className="text-[11px]">
                  Maximum permissible line discount before elevated risk and mandatory manager sign-off is triggered.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(["Hardware", "Services", "Subscriptions"] as ProductCategory[]).map((cat) => (
                  <div
                    key={cat}
                    className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{cat}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {cat === "Hardware"
                          ? "Physical inventory & network gear"
                          : cat === "Services"
                            ? "Onsite setup & engineering cutover"
                            : "Recurring cloud monitoring & support"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={state.governance.categoryCeilings[cat]}
                        onChange={(e) =>
                          handleUpdateCategoryCeiling(cat, parseFloat(e.target.value) || 0)
                        }
                        className="h-7 w-16 text-xs text-right font-mono font-bold"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Customer Tier Allowances */}
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-xs font-semibold">Customer Tier Discount Ceilings</CardTitle>
                <CardDescription className="text-[11px]">
                  Base customer relationship ceiling. Blended quotation discounts exceeding this require escalation.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(["Bronze", "Silver", "Gold"] as CustomerTier[]).map((tier) => (
                  <div
                    key={tier}
                    className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{tier} Account Tier</div>
                      <div className="text-[10px] text-muted-foreground">
                        {tier === "Gold"
                          ? "Strategic enterprises (e.g. Acme Corp)"
                          : tier === "Silver"
                            ? "Mid-market logistics & healthcare"
                            : "Standard commercial accounts"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={state.governance.tierCeilings[tier]}
                        onChange={(e) =>
                          handleUpdateTierCeiling(tier, parseFloat(e.target.value) || 0)
                        }
                        className="h-7 w-16 text-xs text-right font-mono font-bold"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Product Catalog */}
        <TabsContent value="catalog" className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold">Commercial Product Catalog</CardTitle>
                <CardDescription className="text-[11px]">
                  Base prices, direct equipment costs, category mapping, and billing cycles
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  setProductModal({
                    open: true,
                    product: {
                      id: "",
                      name: "",
                      category: "Hardware",
                      unit: "unit",
                      price: 500,
                      cost: 300,
                      taxPct: 8,
                      description: "",
                    },
                    isNew: true,
                  })
                }
                className="h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Gross Margin</TableHead>
                    <TableHead className="text-right">Tax %</TableHead>
                    <TableHead className="text-right w-20">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {state.products.map((p) => {
                    const margin = p.price - p.cost;
                    const marginPct = p.price > 0 ? Math.round((margin / p.price) * 100) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal py-0 px-1">
                            {p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                        <TableCell className="text-right font-mono font-bold">₹{p.price}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">₹{p.cost}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">
                          ₹{margin} ({marginPct}%)
                        </TableCell>
                        <TableCell className="text-right font-mono">{p.taxPct}%</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setProductModal({
                                open: true,
                                product: { ...p },
                                isNew: false,
                              })
                            }
                            className="h-6 text-[10px] px-2"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Warehouses */}
        <TabsContent value="warehouses" className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-xs font-semibold">Warehouse Logistics & Freight Surcharges</CardTitle>
              <CardDescription className="text-[11px]">
                Shipment freight costs utilized by the cost-optimal split engine
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {state.warehouses.map((w) => (
                <div
                  key={w.id}
                  className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">{w.name}</div>
                    <div className="text-[11px] text-muted-foreground">{w.location}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Freight Surcharge (₹):</span>
                    <Input
                      type="number"
                      min={0}
                      value={w.shipmentCost}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        adminActions.saveWarehouse({ ...w, shipmentCost: val });
                      }}
                      className="h-7 w-20 text-xs font-mono text-right"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Plans */}
        <TabsContent value="plans" className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-xs font-semibold">Recurring Subscription Plans</CardTitle>
              <CardDescription className="text-[11px]">
                Configured recurring billing cycles and proration policies
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {state.plans.map((pl) => (
                <div
                  key={pl.id}
                  className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span>{pl.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {pl.cycle}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{pl.cancellationPolicy}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Price / Seat:</span>
                    <Input
                      type="number"
                      value={pl.price}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        adminActions.savePlan({ ...pl, price: val });
                      }}
                      className="h-7 w-20 text-xs font-mono text-right font-bold"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Product Modal */}
      <Dialog
        open={productModal.open}
        onOpenChange={(open) => setProductModal({ ...productModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {productModal.isNew ? "Add New Catalog Product" : "Edit Product Configuration"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Product Name</label>
              <Input
                value={productModal.product.name}
                onChange={(e) =>
                  setProductModal({
                    ...productModal,
                    product: { ...productModal.product, name: e.target.value },
                  })
                }
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Category</label>
                <Select
                  value={productModal.product.category}
                  onValueChange={(val: any) =>
                    setProductModal({
                      ...productModal,
                      product: { ...productModal.product, category: val },
                    })
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
                    <SelectItem value="Services" className="text-xs">Services</SelectItem>
                    <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">Unit</label>
                <Input
                  value={productModal.product.unit}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      product: { ...productModal.product, unit: e.target.value },
                    })
                  }
                  className="text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Price (₹)</label>
                <Input
                  type="number"
                  value={productModal.product.price}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      product: { ...productModal.product, price: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">Cost (₹)</label>
                <Input
                  type="number"
                  value={productModal.product.cost}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      product: { ...productModal.product, cost: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">Tax %</label>
                <Input
                  type="number"
                  value={productModal.product.taxPct}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      product: { ...productModal.product, taxPct: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-medium text-foreground">Description</label>
              <Input
                value={productModal.product.description}
                onChange={(e) =>
                  setProductModal({
                    ...productModal,
                    product: { ...productModal.product, description: e.target.value },
                  })
                }
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProductModal({ ...productModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveProduct} className="text-xs">
              Save Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
