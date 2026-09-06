import React, { useState, useEffect, useMemo } from "react";
import {
  useAppState,
  adminActions,
} from "../../infrastructure/store";
import type { CustomerTier, ProductCategory, Product, Warehouse, SubscriptionPlan } from "../../modules/shared/types";
import { canAccessAdminTab } from "../../modules/identity/permissions";
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
  Boxes,
  Layers,
  Clock,
  Check,
  Search,
  Filter,
  Truck,
  ArrowUpDown,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Star,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type { RecommendationRule } from "../../modules/recommendations/service";
import { toast } from "sonner";

export interface AdminConfigViewProps {
  initialTab?: "governance" | "catalog" | "warehouses" | "plans" | "upsell";
}

export function AdminConfigView({ initialTab }: AdminConfigViewProps = {}) {
  const state = useAppState();
  const session = state.session;
  const role = session?.role;

  const defaultTab =
    initialTab ||
    (canAccessAdminTab(role, "governance")
      ? "governance"
      : canAccessAdminTab(role, "warehouses")
        ? "warehouses"
        : "governance");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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

  // Product Catalog search, category filter, and sorting
  const [productCatalogSearch, setProductCatalogSearch] = useState<string>("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("all");
  const [productSortBy, setProductSortBy] = useState<string>("date-desc");

  const filteredAndSortedProducts = useMemo(() => {
    const searchLower = productCatalogSearch.toLowerCase().trim();
    const filtered = state.products.filter((p) => {
      const matchesSearch =
        !searchLower ||
        p.name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower)) ||
        p.id.toLowerCase().includes(searchLower);

      const matchesCategory =
        productCategoryFilter === "all" || p.category === productCategoryFilter;

      return matchesSearch && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (productSortBy === "date-desc" || productSortBy === "date-asc") {
        const getTime = (prod: Product) => {
          if (prod.createdAt) {
            const t = new Date(prod.createdAt).getTime();
            if (!isNaN(t)) return t;
          }
          if (prod.id.startsWith("p-")) {
            const num = Number(prod.id.slice(2));
            if (!isNaN(num) && num > 1000000000) return num;
          }
          return 0;
        };
        const timeA = getTime(a);
        const timeB = getTime(b);
        if (timeA !== timeB) {
          return productSortBy === "date-desc" ? timeB - timeA : timeA - timeB;
        }
        return productSortBy === "date-desc"
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name);
      } else if (productSortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      } else if (productSortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      } else if (productSortBy === "price-desc") {
        return b.price - a.price;
      } else if (productSortBy === "price-asc") {
        return a.price - b.price;
      } else if (productSortBy === "margin-desc") {
        const marginA = a.price > 0 ? (a.price - a.cost) / a.price : 0;
        const marginB = b.price > 0 ? (b.price - b.cost) / b.price : 0;
        return marginB - marginA;
      }
      return 0;
    });
  }, [state.products, productCatalogSearch, productCategoryFilter, productSortBy]);

  const handleSaveProduct = async () => {
    const p = productModal.product;
    if (!p.name.trim()) {
      toast.error("Product name is required.");
      return;
    }
    const id = productModal.isNew ? `p-${Date.now()}` : p.id;
    const createdAt = productModal.isNew ? new Date().toISOString() : (p.createdAt || new Date().toISOString());
    try {
      await adminActions.saveProduct({ ...p, id, createdAt });
      toast.success(productModal.isNew ? `Created product ${p.name}` : `Updated ${p.name}`);
      setProductModal({ ...productModal, open: false });
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    }
  };

  // Plan creation and edit modal state
  const [planModal, setPlanModal] = useState<{
    open: boolean;
    isNew: boolean;
    plan: SubscriptionPlan;
    refundPreset: "FULL_PRORATED" | "PARTIAL_50" | "NON_REFUNDABLE" | "CUSTOM";
  }>({
    open: false,
    isNew: false,
    plan: {
      id: "",
      name: "",
      cycle: "Monthly",
      price: 120,
      prorationEnabled: true,
      cancellationPolicy: "Full prorated refund for remaining unused cycle days.",
    },
    refundPreset: "FULL_PRORATED",
  });

  const handleSavePlan = async () => {
    const p = planModal.plan;
    if (!p.name.trim()) {
      toast.error("Plan name is required.");
      return;
    }
    try {
      if (planModal.isNew) {
        const id = `plan-${Date.now()}`;
        await adminActions.createPlan({ ...p, id });
        toast.success(`Created subscription plan ${p.name}`);
      } else {
        await adminActions.savePlan(p);
        toast.success(`Updated subscription plan ${p.name}`);
      }
      setPlanModal({ ...planModal, open: false });
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan");
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (state.plans.length <= 1) {
      toast.error("Cannot delete the last remaining subscription plan.");
      return;
    }
    try {
      await adminActions.deletePlan(planId);
      toast.success("Subscription plan deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete plan");
    }
  };

  // Warehouse & Stock Filter states
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [stockSearch, setStockSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Stock edit tracking map: `${warehouseId}_${productId}` -> { available, replenishmentDays }
  const [stockEdits, setStockEdits] = useState<Record<string, { available: number; replenishmentDays: number }>>({});

  // Add stock allocation modal state
  const [stockModal, setStockModal] = useState<{
    open: boolean;
    warehouseId: string;
    productId: string;
    available: number;
    replenishmentDays: number;
  }>({
    open: false,
    warehouseId: "",
    productId: "",
    available: 10,
    replenishmentDays: 7,
  });

  const handleStockChange = (warehouseId: string, productId: string, field: "available" | "replenishmentDays", value: number) => {
    const key = `${warehouseId}_${productId}`;
    const current = stockEdits[key] || {
      available: state.inventory.find((i) => i.warehouseId === warehouseId && i.productId === productId)?.available ?? 0,
      replenishmentDays: state.inventory.find((i) => i.warehouseId === warehouseId && i.productId === productId)?.replenishmentDays ?? 7,
    };
    setStockEdits({
      ...stockEdits,
      [key]: {
        ...current,
        [field]: Math.max(0, value),
      },
    });
  };

  const handleSaveStock = async (warehouseId: string, productId: string) => {
    const key = `${warehouseId}_${productId}`;
    const edit = stockEdits[key];
    const currentItem = state.inventory.find((i) => i.warehouseId === warehouseId && i.productId === productId);
    const available = edit !== undefined ? edit.available : (currentItem?.available ?? 0);
    const replenishmentDays = edit !== undefined ? edit.replenishmentDays : (currentItem?.replenishmentDays ?? 7);

    try {
      await adminActions.saveStock(warehouseId, productId, available, replenishmentDays);
      const pName = state.products.find((p) => p.id === productId)?.name || productId;
      const wName = state.warehouses.find((w) => w.id === warehouseId)?.name || warehouseId;
      toast.success(`Updated ${pName} stock at ${wName} to ${available} units.`);
      const nextEdits = { ...stockEdits };
      delete nextEdits[key];
      setStockEdits(nextEdits);
    } catch (err: any) {
      toast.error(err.message || "Failed to save stock level");
    }
  };

  const handleSaveStockModal = async () => {
    const wId = stockModal.warehouseId || state.warehouses[0]?.id;
    const pId = stockModal.productId || state.products[0]?.id;
    if (!wId || !pId) {
      toast.error("Please select both a depot warehouse and a product.");
      return;
    }
    try {
      await adminActions.saveStock(
        wId,
        pId,
        stockModal.available,
        stockModal.replenishmentDays,
      );
      const pName = state.products.find((p) => p.id === pId)?.name || pId;
      const wName = state.warehouses.find((w) => w.id === wId)?.name || wId;
      toast.success(`Allocated ${stockModal.available} units of ${pName} to ${wName}.`);
      setStockModal({ ...stockModal, open: false });
    } catch (err: any) {
      toast.error(err.message || "Failed to allocate stock");
    }
  };

  // Upsell & Cross-Sell State (A6)
  const upsellConfig = state.governance?.upsellConfig || {
    minMarginPct: 15,
    promotedProductIds: ["p-warranty"],
    rules: [],
  };
  const [upsellMargin, setUpsellMargin] = useState<number>(upsellConfig.minMarginPct);
  const [pairingModal, setPairingModal] = useState<{
    open: boolean;
    triggerProductId: string;
    suggestedProductId: string;
    reason: string;
    confidence: number;
    promotion: string;
  }>({
    open: false,
    triggerProductId: "",
    suggestedProductId: "",
    reason: "Commonly purchased together",
    confidence: 0.85,
    promotion: "",
  });
  const [productSearch, setProductSearch] = useState("");

  const handleSaveUpsellMargin = async () => {
    try {
      await adminActions.setUpsellMargin(upsellMargin);
      toast.success(`Minimum upsell profit margin updated to ${upsellMargin}%. Recommendations refreshed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update margin threshold");
    }
  };

  const handleTogglePromoted = async (productId: string) => {
    try {
      await adminActions.togglePromotedProduct(productId);
      const isCurrentlyPromoted = (state.governance?.upsellConfig?.promotedProductIds || []).includes(productId);
      const pName = state.products.find((p) => p.id === productId)?.name || productId;
      if (isCurrentlyPromoted) {
        toast.success(`Removed ${pName} from promoted recommendations.`);
      } else {
        toast.success(`Promoted ${pName}! It will rank #1 in quotation suggestions.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle promoted status");
    }
  };

  const handleAddPairingRule = async () => {
    if (!pairingModal.triggerProductId || !pairingModal.suggestedProductId) {
      toast.error("Please select both a trigger product and an upsell product.");
      return;
    }
    if (pairingModal.triggerProductId === pairingModal.suggestedProductId) {
      toast.error("Trigger and suggested products must be different.");
      return;
    }
    try {
      await adminActions.addPairingRule({
        triggerProductId: pairingModal.triggerProductId,
        suggestedProductId: pairingModal.suggestedProductId,
        reason: pairingModal.reason || "Commonly purchased together",
        confidence: Number(pairingModal.confidence) || 0.8,
        promotion: pairingModal.promotion ? pairingModal.promotion : undefined,
      });
      toast.success("Upsell pairing rule added successfully.");
      setPairingModal({
        open: false,
        triggerProductId: "",
        suggestedProductId: "",
        reason: "Commonly purchased together",
        confidence: 0.85,
        promotion: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add pairing rule");
    }
  };

  const handleDeletePairingRule = async (idx: number) => {
    try {
      await adminActions.deletePairingRule(idx);
      toast.success("Pairing rule removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {session?.role === "SALES_MANAGER" || initialTab === "governance"
            ? "Commercial Policy & Discount Governance"
            : session?.role === "FINANCE" || initialTab === "warehouses"
              ? "Logistics & Multi-Depot Operations"
              : "Operational Administration & Governance"}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {session?.role === "SALES_MANAGER" || initialTab === "governance"
            ? "Configure product category ceilings and customer tier risk thresholds."
            : session?.role === "FINANCE" || initialTab === "warehouses"
              ? "Manage warehouse depot networks, stock allocations, and shipping freight rules."
              : "Configure discount thresholds, product catalogs, multi-depot shipping freight, and recurring billing models."}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card border border-border h-9 p-0.5">
          {canAccessAdminTab(role, "governance") && (
            <TabsTrigger value="governance" className="text-xs flex items-center gap-1.5 h-8">
              <ShieldAlert className="h-3.5 w-3.5" />
              Discount Policy Rules
            </TabsTrigger>
          )}
          {canAccessAdminTab(role, "catalog") && (
            <TabsTrigger value="catalog" className="text-xs flex items-center gap-1.5 h-8">
              <Package className="h-3.5 w-3.5" />
              Product Catalog
            </TabsTrigger>
          )}
          {canAccessAdminTab(role, "warehouses") && (
            <TabsTrigger value="warehouses" className="text-xs flex items-center gap-1.5 h-8">
              <Building className="h-3.5 w-3.5" />
              Warehouses & Logistics
            </TabsTrigger>
          )}
          {canAccessAdminTab(role, "plans") && (
            <TabsTrigger value="plans" className="text-xs flex items-center gap-1.5 h-8">
              <Repeat className="h-3.5 w-3.5" />
              Subscription Plans
            </TabsTrigger>
          )}
          {canAccessAdminTab(role, "upsell") && (
            <TabsTrigger value="upsell" className="text-xs flex items-center gap-1.5 h-8">
              <Sparkles className="h-3.5 w-3.5" />
              Upsell & Cross-Sell
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Discount Governance Rules */}
        {canAccessAdminTab(role, "governance") && (
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
        )}

        {/* Tab 2: Product Catalog */}
        {canAccessAdminTab(role, "catalog") && (
          <TabsContent value="catalog" className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  Commercial Product Catalog
                </CardTitle>
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
                className="h-7 text-xs shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Product
              </Button>
            </CardHeader>

            {/* Product Catalog Filters: Search bar + Category filter + Sort by date added */}
            <div className="p-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, category, or description..."
                  value={productCatalogSearch}
                  onChange={(e) => setProductCatalogSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-full bg-background shadow-2xs"
                />
                {productCatalogSearch && (
                  <button
                    onClick={() => setProductCatalogSearch("")}
                    className="absolute right-2.5 top-1.5 text-muted-foreground hover:text-foreground text-sm font-semibold"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Category filter */}
                <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-36 bg-background">
                    <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                    <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
                    <SelectItem value="Services" className="text-xs">Services</SelectItem>
                    <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort by date / name / price */}
                <Select value={productSortBy} onValueChange={setProductSortBy}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-52 bg-background">
                    <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc" className="text-xs">Date Added (Newest First)</SelectItem>
                    <SelectItem value="date-asc" className="text-xs">Date Added (Oldest First)</SelectItem>
                    <SelectItem value="name-asc" className="text-xs">Product Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc" className="text-xs">Product Name (Z-A)</SelectItem>
                    <SelectItem value="price-desc" className="text-xs">Price (High to Low)</SelectItem>
                    <SelectItem value="price-asc" className="text-xs">Price (Low to High)</SelectItem>
                    <SelectItem value="margin-desc" className="text-xs">Gross Margin (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product count and active sort indicator */}
            <div className="px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between border-b border-border/50 bg-background/50">
              <div>
                Showing <span className="font-semibold text-foreground">{filteredAndSortedProducts.length}</span> of{" "}
                <span className="font-semibold text-foreground">{state.products.length}</span> products
                {(productCatalogSearch || productCategoryFilter !== "all") && (
                  <span
                    className="ml-2 text-primary cursor-pointer hover:underline"
                    onClick={() => {
                      setProductCatalogSearch("");
                      setProductCategoryFilter("all");
                    }}
                  >
                    (Reset filters)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>
                  Sorted by:{" "}
                  {productSortBy === "date-desc"
                    ? "Newest First"
                    : productSortBy === "date-asc"
                      ? "Oldest First"
                      : productSortBy === "name-asc"
                        ? "Name (A-Z)"
                        : productSortBy === "name-desc"
                          ? "Name (Z-A)"
                          : productSortBy === "price-desc"
                            ? "Price (High to Low)"
                            : productSortBy === "price-asc"
                              ? "Price (Low to High)"
                              : "Gross Margin"}
                </span>
              </div>
            </div>

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
                  {filteredAndSortedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Package className="h-8 w-8 text-muted-foreground/50 mb-1" />
                          <p className="font-medium text-foreground">No products found</p>
                          <p className="text-[11px]">
                            {productCatalogSearch
                              ? `No products match the search query "${productCatalogSearch}".`
                              : "No products in this category."}
                          </p>
                          {(productCatalogSearch || productCategoryFilter !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setProductCatalogSearch("");
                                setProductCategoryFilter("all");
                              }}
                              className="mt-2 h-7 text-xs"
                            >
                              Clear Search & Filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedProducts.map((p) => {
                      const margin = p.price - p.cost;
                      const marginPct = p.price > 0 ? Math.round((margin / p.price) * 100) : 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-semibold text-foreground">{p.name}</div>
                            {p.createdAt && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                Added {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                          </TableCell>
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
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Tab 3: Warehouses & Logistics */}
        {canAccessAdminTab(role, "warehouses") && (
          <TabsContent value="warehouses" className="space-y-6">
          {/* Section 1: Depot Facilities & Freight Rates */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    Fulfillment Depots & Freight Surcharges
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Multi-depot shipping freight rates evaluated by the cost-optimal split fulfillment engine
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono w-fit">
                  {state.warehouses.length} Active Depots
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {state.warehouses.map((w) => {
                  const depotStockCount = state.inventory
                    .filter((i) => i.warehouseId === w.id)
                    .reduce((sum, i) => sum + i.available, 0);

                  return (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-lg border border-border bg-card/60 flex flex-col justify-between gap-3 text-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Truck className="h-3 w-3" />
                            {w.location}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {depotStockCount} Total Units
                        </Badge>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Freight Surcharge:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-mono text-xs">₹</span>
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
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Depot Stock Levels & Replenishment Matrix */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5 text-primary" />
                    Multi-Depot Inventory Stock Levels & Lead Times
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Manage stock availability per product at each depot. Products with 0 units will trigger backorder handling or split sourcing.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    setStockModal({
                      open: true,
                      warehouseId: state.warehouses[0]?.id || "",
                      productId: state.products[0]?.id || "",
                      available: 10,
                      replenishmentDays: 7,
                    })
                  }
                  className="h-8 text-xs gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Allocate Stock to Depot
                </Button>
              </div>

              {/* Filters bar */}
              <div className="pt-3 flex flex-wrap items-center gap-2 text-xs">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search product SKU / name..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Depot:
                  </span>
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger className="h-8 text-xs w-[170px]">
                      <SelectValue placeholder="All Depots" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depots</SelectItem>
                      {state.warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Category:</span>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs w-[130px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Hardware">Hardware</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Subscriptions">Subscriptions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Product Details</TableHead>
                    <TableHead className="text-xs">Fulfillment Depot</TableHead>
                    <TableHead className="text-xs text-center w-36">Available Units</TableHead>
                    <TableHead className="text-xs text-center w-28">Reserved</TableHead>
                    <TableHead className="text-xs text-center w-28">Net Free Stock</TableHead>
                    <TableHead className="text-xs text-center w-36">Lead Time (Days)</TableHead>
                    <TableHead className="text-xs text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const targetWarehouses =
                      warehouseFilter === "all"
                        ? state.warehouses
                        : state.warehouses.filter((w) => w.id === warehouseFilter);

                    const filteredProducts = state.products.filter((p) => {
                      const matchSearch =
                        !stockSearch.trim() ||
                        p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                        p.id.toLowerCase().includes(stockSearch.toLowerCase());
                      const matchCat =
                        categoryFilter === "all" || p.category === categoryFilter;
                      return matchSearch && matchCat;
                    });

                    const rows = targetWarehouses.flatMap((wh) =>
                      filteredProducts.map((prod) => {
                        const invItem = state.inventory.find(
                          (i) => i.warehouseId === wh.id && i.productId === prod.id
                        );
                        return {
                          warehouse: wh,
                          product: prod,
                          available: invItem?.available ?? 0,
                          reserved: invItem?.reserved ?? 0,
                          replenishmentDays: invItem?.replenishmentDays ?? 7,
                          isConfigured: !!invItem,
                        };
                      })
                    );

                    if (rows.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                            No products or inventory match the selected filter criteria.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return rows.map((row) => {
                      const editKey = `${row.warehouse.id}_${row.product.id}`;
                      const edit = stockEdits[editKey];
                      const availableVal = edit !== undefined ? edit.available : row.available;
                      const leadVal = edit !== undefined ? edit.replenishmentDays : row.replenishmentDays;
                      const isDirty = edit !== undefined;
                      const netFree = availableVal - row.reserved;

                      return (
                        <TableRow key={editKey} className="text-xs hover:bg-muted/40 transition-colors">
                          {/* Product Info */}
                          <TableCell className="py-2.5">
                            <div className="font-medium text-foreground flex items-center gap-1.5">
                              {row.product.name}
                              {!row.isConfigured && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 border-dashed text-muted-foreground">
                                  Not Set
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <span className="font-mono">{row.product.id}</span>
                              <span>·</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1">
                                {row.product.category}
                              </Badge>
                              <span>·</span>
                              <span>Per {row.product.unit}</span>
                            </div>
                          </TableCell>

                          {/* Warehouse Depot */}
                          <TableCell className="py-2.5">
                            <div className="font-medium text-foreground">{row.warehouse.name}</div>
                            <div className="text-[10px] text-muted-foreground">{row.warehouse.location}</div>
                          </TableCell>

                          {/* Available Units (Editable) */}
                          <TableCell className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 text-[11px]"
                                onClick={() =>
                                  handleStockChange(
                                    row.warehouse.id,
                                    row.product.id,
                                    "available",
                                    Math.max(0, availableVal - 1)
                                  )
                                }
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min={0}
                                value={availableVal}
                                onChange={(e) =>
                                  handleStockChange(
                                    row.warehouse.id,
                                    row.product.id,
                                    "available",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={`h-7 w-16 text-center text-xs font-mono font-semibold ${
                                  isDirty ? "border-amber-500 bg-amber-50/10" : ""
                                }`}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 text-[11px]"
                                onClick={() =>
                                  handleStockChange(
                                    row.warehouse.id,
                                    row.product.id,
                                    "available",
                                    availableVal + 1
                                  )
                                }
                              >
                                +
                              </Button>
                            </div>
                          </TableCell>

                          {/* Reserved Units */}
                          <TableCell className="py-2.5 text-center">
                            <Badge variant="outline" className="font-mono text-xs">
                              {row.reserved}
                            </Badge>
                          </TableCell>

                          {/* Net Free Stock */}
                          <TableCell className="py-2.5 text-center">
                            <Badge
                              variant={
                                netFree > 5
                                  ? "secondary"
                                  : netFree > 0
                                  ? "outline"
                                  : "destructive"
                              }
                              className="font-mono text-xs"
                            >
                              {netFree > 0 ? `${netFree} Free` : netFree === 0 ? "0 Free" : `${netFree} Deficit`}
                            </Badge>
                          </TableCell>

                          {/* Lead Time (Days) */}
                          <TableCell className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                value={leadVal}
                                onChange={(e) =>
                                  handleStockChange(
                                    row.warehouse.id,
                                    row.product.id,
                                    "replenishmentDays",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={`h-7 w-14 text-center text-xs font-mono ${
                                  isDirty ? "border-amber-500 bg-amber-50/10" : ""
                                }`}
                              />
                              <span className="text-[11px] text-muted-foreground">days</span>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-2.5 text-right">
                            <Button
                              size="sm"
                              variant={isDirty ? "default" : "ghost"}
                              className={`h-7 px-2.5 text-[11px] gap-1 ${
                                isDirty ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                              }`}
                              onClick={() => handleSaveStock(row.warehouse.id, row.product.id)}
                            >
                              {isDirty ? (
                                <>
                                  <Save className="h-3 w-3" />
                                  Save
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                  Saved
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Tab 4: Recurring Plans & Billing Governance */}
        {canAccessAdminTab(role, "plans") && (
          <TabsContent value="plans" className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-primary" />
                    Recurring Subscription Plans & Billing Policies
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Define recurring billing frequencies, automate mid-cycle proration rules, and configure cancellation/refund governance.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    setPlanModal({
                      open: true,
                      isNew: true,
                      plan: {
                        id: "",
                        name: "",
                        cycle: "Monthly",
                        price: 120,
                        prorationEnabled: true,
                        cancellationPolicy: "Full prorated refund for remaining unused cycle days.",
                      },
                      refundPreset: "FULL_PRORATED",
                    })
                  }
                  className="h-8 text-xs gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Recurring Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {state.plans.map((pl) => {
                  const attachedProducts = state.products.filter(
                    (prod) => prod.category === "Subscriptions" && prod.cycle === pl.cycle
                  );

                  return (
                    <div
                      key={pl.id}
                      className="p-4 rounded-lg border border-border bg-card/60 flex flex-col justify-between gap-4 text-xs hover:border-primary/40 transition-colors shadow-2xs"
                    >
                      {/* Plan Header */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              {pl.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Plan ID: <span className="font-mono">{pl.id}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {pl.cycle}
                          </Badge>
                        </div>

                        {/* Price Display / Quick Edit */}
                        <div className="p-2 rounded-md bg-muted/40 border border-border flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Base Rate:</span>
                          <div className="flex items-center gap-1 font-mono font-bold text-sm text-foreground">
                            <span>₹{pl.price}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">/ seat / {pl.cycle.toLowerCase()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Policy Governance Section */}
                      <div className="space-y-2 pt-2 border-t border-border/70 text-[11px]">
                        {/* Proration Policy */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 text-primary" /> Mid-Cycle Proration:
                          </span>
                          <Badge
                            variant={pl.prorationEnabled ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {pl.prorationEnabled ? "Daily Prorated" : "Disabled (At Renewal)"}
                          </Badge>
                        </div>

                        {/* Cancellation Policy */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-primary" /> Cancellation Refund:
                            </span>
                            <Badge
                              variant={
                                pl.cancellationPolicy.toLowerCase().includes("no refund") ||
                                pl.cancellationPolicy.toLowerCase().includes("non-refundable")
                                  ? "destructive"
                                  : pl.cancellationPolicy.toLowerCase().includes("50%")
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {pl.cancellationPolicy.toLowerCase().includes("no refund") ||
                              pl.cancellationPolicy.toLowerCase().includes("non-refundable")
                                ? "Non-Refundable"
                                : pl.cancellationPolicy.toLowerCase().includes("50%")
                                ? "50% Partial Refund"
                                : "100% Prorated Refund"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground italic line-clamp-2 bg-muted/20 p-1.5 rounded">
                            "{pl.cancellationPolicy}"
                          </p>
                        </div>

                        {/* Attached Products */}
                        <div className="space-y-1 pt-1">
                          <div className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
                            Attached Products ({attachedProducts.length}):
                          </div>
                          {attachedProducts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attachedProducts.map((p) => (
                                <Badge key={p.id} variant="outline" className="text-[9px] py-0 px-1.5">
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              No catalog products currently bound to this cycle.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            let preset: any = "CUSTOM";
                            const pol = pl.cancellationPolicy.toLowerCase();
                            if (pol.includes("no refund") || pol.includes("non-refundable")) preset = "NON_REFUNDABLE";
                            else if (pol.includes("50%")) preset = "PARTIAL_50";
                            else if (pol.includes("full") || pol.includes("prorated")) preset = "FULL_PRORATED";

                            setPlanModal({
                              open: true,
                              isNew: false,
                              plan: { ...pl },
                              refundPreset: preset,
                            });
                          }}
                          className="h-7 text-[11px] gap-1 flex-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit Rules
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePlan(pl.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Tab 5: Upsell & Cross-Sell Rules (A6) */}
        {canAccessAdminTab(role, "upsell") && (
          <TabsContent value="upsell" className="space-y-6">
          {/* Section A: Minimum Margin Cutoff */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Recommendation Margin Threshold (Cutoff)
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">
                    Filter out product recommendations where profit margin % is below this cutoff. Quotation sales panels will never suggest margin-dilutive items.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs w-fit">
                  Active Cutoff: {state.governance?.upsellConfig?.minMarginPct ?? 15}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 max-w-md">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-foreground">Minimum Margin Cutoff (%)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={upsellMargin}
                      onChange={(e) => setUpsellMargin(Number(e.target.value))}
                      className="h-9 text-xs bg-background pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveUpsellMargin}
                  className="mt-5 h-9 text-xs flex items-center gap-1 bg-primary text-primary-foreground"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Threshold
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Promoted Products Ranking */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  Promoted Products Catalog
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">
                  Promoted items receive a 1.5× recommendation ranking boost and appear with a distinct "PROMOTED" badge in sales reps' quotation panels.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search catalog..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-8 text-xs pl-8 bg-background"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Price</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                    <TableHead className="text-xs text-right">Margin %</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.products
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                        p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
                        p.id.toLowerCase().includes(productSearch.toLowerCase())
                    )
                    .map((p) => {
                      const marginPct = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
                      const isPromoted = (state.governance?.upsellConfig?.promotedProductIds || []).includes(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                              {p.name}
                              {isPromoted && (
                                <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[9px] px-1 py-0 uppercase">
                                  Promoted
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">{p.id}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">₹{p.price.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-muted-foreground">₹{p.cost.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            <span
                              className={
                                marginPct >= (state.governance?.upsellConfig?.minMarginPct ?? 15)
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : "text-destructive font-semibold"
                              }
                            >
                              {marginPct}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {isPromoted ? (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] border-amber-300">
                                ⭐ Promoted Top-Rank
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Standard</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={isPromoted ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleTogglePromoted(p.id)}
                              className={`h-7 text-[11px] ${
                                isPromoted
                                  ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 border-amber-300"
                                  : "bg-primary text-primary-foreground"
                              }`}
                            >
                              {isPromoted ? "Demote" : "Promote"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Section C: Dynamic Pairing Rules */}
          <Card className="shadow-xs border-border">
            <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Product Affinity & Upsell Pairings
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">
                  Define automated pairings: when a customer adds a Trigger Product to the quote, the engine recommends the Upsell Product.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  setPairingModal({
                    open: true,
                    triggerProductId: state.products[0]?.id || "",
                    suggestedProductId: state.products[1]?.id || "",
                    reason: "Frequently bundled together",
                    confidence: 0.85,
                    promotion: "",
                  })
                }
                className="h-8 text-xs flex items-center gap-1 bg-primary text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Pairing Rule
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Trigger Product</TableHead>
                    <TableHead className="text-xs">Upsell Suggestion</TableHead>
                    <TableHead className="text-xs">Reason / Rationale</TableHead>
                    <TableHead className="text-xs text-center">Confidence</TableHead>
                    <TableHead className="text-xs">Promo Incentive</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!state.governance?.upsellConfig?.rules || state.governance.upsellConfig.rules.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                        No pairing rules configured yet. Click "Add Pairing Rule" to set up upsell associations.
                      </TableCell>
                    </TableRow>
                  ) : (
                    state.governance.upsellConfig.rules.map((rule, idx) => {
                      const triggerProd = state.products.find((p) => p.id === rule.triggerProductId);
                      const suggestedProd = state.products.find((p) => p.id === rule.suggestedProductId);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">
                            <div>{triggerProd?.name || rule.triggerProductId}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{rule.triggerProductId}</div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-1 text-primary">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span>{suggestedProd?.name || rule.suggestedProductId}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono ml-4">{rule.suggestedProductId}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{rule.reason}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {Math.round(rule.confidence * 100)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {rule.promotion ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                                {rule.promotion}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePairingRule(idx)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        )}
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
            {/* Linked Subscription Plan when category is Subscriptions */}
            {productModal.product.category === "Subscriptions" && (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-primary/20 bg-primary/5">
                <label className="font-medium text-foreground text-xs flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-primary" />
                  Linked Subscription Recurring Plan
                </label>
                <Select
                  value={
                    state.plans.find((pl) => pl.cycle === productModal.product.cycle)?.id ||
                    state.plans[0]?.id
                  }
                  onValueChange={(planId) => {
                    const selectedPlan = state.plans.find((pl) => pl.id === planId);
                    if (selectedPlan) {
                      setProductModal({
                        ...productModal,
                        product: {
                          ...productModal.product,
                          cycle: selectedPlan.cycle,
                          price: selectedPlan.price,
                          unit: "seat / " + selectedPlan.cycle.toLowerCase(),
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="text-xs h-8 bg-background">
                    <SelectValue placeholder="Select Subscription Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.plans.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id} className="text-xs">
                        {pl.name} ({pl.cycle} · ₹{pl.price}/seat · {pl.prorationEnabled ? "Prorated" : "No Proration"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[10px] text-muted-foreground">
                  Associating a recurring plan binds this service to automated billing schedules, proration rules, and cancellation policies.
                </div>
              </div>
            )}

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

      {/* Allocate Stock Modal Dialog */}
      <Dialog open={stockModal.open} onOpenChange={(open) => setStockModal({ ...stockModal, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              Allocate Stock to Depot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign initial inventory or update stock for a product at a specific fulfillment warehouse.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Target Fulfillment Depot</label>
              <Select
                value={stockModal.warehouseId}
                onValueChange={(val) => setStockModal({ ...stockModal, warehouseId: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Warehouse Depot" />
                </SelectTrigger>
                <SelectContent>
                  {state.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground">Product</label>
              <Select
                value={stockModal.productId}
                onValueChange={(val) => setStockModal({ ...stockModal, productId: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {state.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.category} · {p.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Available Quantity</label>
                <Input
                  type="number"
                  min={0}
                  value={stockModal.available}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      available: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Lead Time (Days)</label>
                <Input
                  type="number"
                  min={0}
                  value={stockModal.replenishmentDays}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      replenishmentDays: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStockModal({ ...stockModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveStockModal} className="text-xs bg-primary text-primary-foreground">
              Save Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Plan Configuration Modal Dialog */}
      <Dialog open={planModal.open} onOpenChange={(open) => setPlanModal({ ...planModal, open })}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              {planModal.isNew ? "Create Recurring Subscription Plan" : "Edit Subscription Plan & Policies"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure billing frequency, mid-cycle seat change proration rules, and cancellation refund governance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Plan Name</label>
              <Input
                placeholder="e.g. Enterprise Cloud Care"
                value={planModal.plan.name}
                onChange={(e) =>
                  setPlanModal({
                    ...planModal,
                    plan: { ...planModal.plan, name: e.target.value },
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Billing Cycle</label>
                <Select
                  value={planModal.plan.cycle}
                  onValueChange={(val: any) =>
                    setPlanModal({
                      ...planModal,
                      plan: { ...planModal.plan, cycle: val },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly" className="text-xs">Monthly (30 days)</SelectItem>
                    <SelectItem value="Quarterly" className="text-xs">Quarterly (91 days)</SelectItem>
                    <SelectItem value="Yearly" className="text-xs">Yearly (365 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Base Price / Seat (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={planModal.plan.price}
                  onChange={(e) =>
                    setPlanModal({
                      ...planModal,
                      plan: { ...planModal.plan, price: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            {/* Proration Configuration */}
            <div className="space-y-1.5 p-2.5 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  Mid-Cycle Quantity Proration
                </label>
                <Button
                  type="button"
                  variant={planModal.plan.prorationEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setPlanModal({
                      ...planModal,
                      plan: {
                        ...planModal.plan,
                        prorationEnabled: !planModal.plan.prorationEnabled,
                      },
                    })
                  }
                  className="h-6 px-2 text-[11px]"
                >
                  {planModal.plan.prorationEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {planModal.plan.prorationEnabled
                  ? "Mid-cycle seat additions/removals are automatically charged or credited based on unused days remaining in the billing period."
                  : "Mid-cycle seat changes do not generate interim charges. New seat counts will take effect upon the next cycle renewal."}
              </p>
            </div>

            {/* Cancellation & Refund Governance */}
            <div className="space-y-2 p-2.5 rounded-lg border border-border bg-muted/30">
              <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Cancellation & Refund Governance
              </label>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Refund Policy Preset</label>
                <Select
                  value={planModal.refundPreset}
                  onValueChange={(val: any) => {
                    let text = planModal.plan.cancellationPolicy;
                    if (val === "FULL_PRORATED") text = "Full prorated refund for remaining unused cycle days.";
                    else if (val === "PARTIAL_50") text = "50% partial refund for remaining unused cycle days.";
                    else if (val === "NON_REFUNDABLE") text = "Non-refundable. Subscription remains active until end of billing period.";

                    setPlanModal({
                      ...planModal,
                      refundPreset: val,
                      plan: { ...planModal.plan, cancellationPolicy: text },
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_PRORATED" className="text-xs">
                      100% Full Prorated Refund (Remaining Days)
                    </SelectItem>
                    <SelectItem value="PARTIAL_50" className="text-xs">
                      50% Partial Refund (Remaining Days)
                    </SelectItem>
                    <SelectItem value="NON_REFUNDABLE" className="text-xs">
                      0% Non-Refundable (No Refund on Cancel)
                    </SelectItem>
                    <SelectItem value="CUSTOM" className="text-xs">
                      Custom Terms / Policy
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Policy Terms & Description</label>
                <Input
                  value={planModal.plan.cancellationPolicy}
                  onChange={(e) =>
                    setPlanModal({
                      ...planModal,
                      plan: { ...planModal.plan, cancellationPolicy: e.target.value },
                      refundPreset: "CUSTOM",
                    })
                  }
                  placeholder="e.g. Cancel with 30-day notice. Prorated refunds apply."
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlanModal({ ...planModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSavePlan} className="text-xs bg-primary text-primary-foreground">
              {planModal.isNew ? "Create Plan" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Pairing Rule Modal */}
      <Dialog
        open={pairingModal.open}
        onOpenChange={(open) => setPairingModal({ ...pairingModal, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Add Upsell / Cross-Sell Pairing Rule
            </DialogTitle>
            <DialogDescription className="text-xs">
              When a sales rep adds the Trigger Product to a quotation, the engine will suggest the Upsell Product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Trigger Product (In Quote)</label>
              <Select
                value={pairingModal.triggerProductId}
                onValueChange={(val) => setPairingModal({ ...pairingModal, triggerProductId: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select trigger product..." />
                </SelectTrigger>
                <SelectContent>
                  {state.products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.id}) - ₹{p.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Suggested Upsell Product</label>
              <Select
                value={pairingModal.suggestedProductId}
                onValueChange={(val) => setPairingModal({ ...pairingModal, suggestedProductId: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select suggested product..." />
                </SelectTrigger>
                <SelectContent>
                  {state.products
                    .filter((p) => p.id !== pairingModal.triggerProductId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.id}) - ₹{p.price.toLocaleString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Upsell Reason / Value Proposition</label>
              <Input
                value={pairingModal.reason}
                onChange={(e) => setPairingModal({ ...pairingModal, reason: e.target.value })}
                placeholder="e.g. Recommended companion for this hardware"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Confidence Score (0.1 - 1.0)</label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={pairingModal.confidence}
                  onChange={(e) => setPairingModal({ ...pairingModal, confidence: parseFloat(e.target.value) || 0.8 })}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Promotion Incentive (Optional)</label>
                <Input
                  value={pairingModal.promotion}
                  onChange={(e) => setPairingModal({ ...pairingModal, promotion: e.target.value })}
                  placeholder="e.g. 15% Bundle Discount"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPairingModal({ ...pairingModal, open: false })}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddPairingRule}
              className="text-xs bg-primary text-primary-foreground"
            >
              Add Pairing Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
