import type {
  Approval,
  Customer,
  FulfillmentOrder,
  Invoice,
  Product,
  ProductCategory,
  Quotation,
  User,
} from "../shared/types";
import { calculateTotals, daysSince } from "../quotations/service";
import { paidAmount } from "../billing/service";

export type PeriodType = "today" | "week" | "30" | "90" | "365" | "custom" | "all";

export interface ReportFilters {
  period: PeriodType;
  customStartDate?: string;
  customEndDate?: string;
  team: string; // "all" | "enterprise" | "commercial"
  ownerId: string; // "all" | userId
  approvalStatus: string; // "all" | "PENDING" | "APPROVED" | "REJECTED"
  category: string; // "all" | "Hardware" | "Services" | "Subscriptions"
  productId: string; // "all" | productId
  stage: string; // "all" | "DRAFT" | "APPROVED" | ...
}

export const DEFAULT_FILTERS: ReportFilters = {
  period: "90",
  customStartDate: "",
  customEndDate: "",
  team: "all",
  ownerId: "all",
  approvalStatus: "all",
  category: "all",
  productId: "all",
  stage: "all",
};

export interface SalesTeamConfig {
  id: string;
  name: string;
  repIds: string[];
}

export const SALES_TEAMS: SalesTeamConfig[] = [
  {
    id: "enterprise",
    name: "Enterprise Sales",
    repIds: ["u-rep1", "u-rep3", "u-rep8", "u-rep10"],
  },
  {
    id: "commercial",
    name: "Commercial & SMB",
    repIds: ["u-rep2", "u-rep4", "u-rep5", "u-rep6", "u-rep7", "u-rep9"],
  },
];

export interface BestSellingProduct {
  productId: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  unitsSold: number;
  totalRevenue: number;
  avgSellingPrice: number;
}

export interface MostDiscountedProduct {
  productId: string;
  name: string;
  category: ProductCategory;
  quoteCount: number;
  avgDiscountPct: number;
  maxDiscountPct: number;
  totalDiscountAmount: number;
}

export interface TeamPerformance {
  teamId: string;
  teamName: string;
  quotesCount: number;
  totalValue: number;
  avgDiscount: number;
  reps: string[];
}

export interface SalesMetrics {
  quotesCreated: number;
  revenue: number;
  pipeline: number;
  conversionRate: number;
  avgDiscountPct: number;
  avgApprovalHours: number;
  topUpsoldProduct: string;
  orderCount: number;
  ordersShipped: number;
  ordersPending: number;
  trend: { month: string; revenue: number; pipeline: number }[];
  byRep: { rep: string; quotes: number; value: number; avgDiscount: number }[];
  byTeam: TeamPerformance[];
  bottlenecks: { role: string; pending: number; avgDays: number }[];
  discountTrend: { month: string; discountPct: number }[];
  bestSellingProducts: BestSellingProduct[];
  mostDiscountedProducts: MostDiscountedProduct[];
}

export function isDateInPeriod(
  dateIso: string,
  period: PeriodType,
  customStartDate?: string,
  customEndDate?: string,
): boolean {
  if (period === "all") return true;
  const time = new Date(dateIso).getTime();
  const now = new Date();

  if (period === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return time >= startOfToday;
  }

  if (period === "week") {
    const sevenDaysAgo = now.getTime() - 7 * 86400000;
    return time >= sevenDaysAgo;
  }

  if (period === "custom") {
    if (customStartDate) {
      const start = new Date(customStartDate + "T00:00:00").getTime();
      if (!isNaN(start) && time < start) return false;
    }
    if (customEndDate) {
      const end = new Date(customEndDate + "T23:59:59").getTime();
      if (!isNaN(end) && time > end) return false;
    }
    return true;
  }

  const days = Number(period);
  if (!isNaN(days)) {
    return time >= now.getTime() - days * 86400000;
  }

  return true;
}

export function filterQuotations(
  quotations: Quotation[],
  products: Record<string, Product>,
  filters: ReportFilters,
  approvals: Approval[] = [],
) {
  return quotations.filter((q) => {
    // 1. Period (today, week, 30, 90, 365, custom, all)
    if (!isDateInPeriod(q.createdAt, filters.period, filters.customStartDate, filters.customEndDate)) {
      return false;
    }

    // 2. Sales Team
    if (filters.team !== "all") {
      const teamConfig = SALES_TEAMS.find((t) => t.id === filters.team);
      if (teamConfig && !teamConfig.repIds.includes(q.ownerId)) {
        return false;
      }
    }

    // 3. Sales Rep
    if (filters.ownerId !== "all" && q.ownerId !== filters.ownerId) {
      return false;
    }

    // 4. Approval Status (pending, approved, rejected)
    if (filters.approvalStatus !== "all") {
      const relApprovals = approvals.filter((a) => a.quotationId === q.id);
      const isPending =
        q.stage === "PENDING_APPROVAL" ||
        relApprovals.some((a) => a.status === "PENDING" || a.steps.some((s) => s.status === "PENDING"));
      const isApproved =
        relApprovals.some((a) => a.status === "APPROVED") ||
        ["APPROVED", "CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage);
      const isRejected =
        relApprovals.some((a) => a.status === "REJECTED" || a.status === "RETURNED") ||
        relApprovals.some((a) => a.steps.some((s) => s.status === "REJECTED" || s.status === "RETURNED")) ||
        q.stage === "CANCELLED";

      if (filters.approvalStatus === "PENDING" && !isPending) return false;
      if (filters.approvalStatus === "APPROVED" && (!isApproved || isPending)) return false;
      if (filters.approvalStatus === "REJECTED" && !isRejected) return false;
    }

    // 5. Stage
    if (filters.stage !== "all" && q.stage !== filters.stage) {
      return false;
    }

    // 6. Category
    if (
      filters.category !== "all" &&
      !q.lines.some((l) => products[l.productId]?.category === filters.category)
    ) {
      return false;
    }

    // 7. Product
    if (
      filters.productId !== "all" &&
      !q.lines.some((l) => l.productId === filters.productId)
    ) {
      return false;
    }

    return true;
  });
}

export function filterOrders(
  orders: FulfillmentOrder[],
  quotationMap: Record<string, Quotation>,
  filters: ReportFilters,
) {
  return orders.filter((o) => {
    if (!isDateInPeriod(o.createdAt, filters.period, filters.customStartDate, filters.customEndDate)) {
      return false;
    }
    const q = quotationMap[o.quotationId];
    if (q) {
      if (filters.ownerId !== "all" && q.ownerId !== filters.ownerId) return false;
      if (filters.team !== "all") {
        const teamConfig = SALES_TEAMS.find((t) => t.id === filters.team);
        if (teamConfig && !teamConfig.repIds.includes(q.ownerId)) return false;
      }
    }
    return true;
  });
}

export function getSalesMetrics(
  quotations: Quotation[],
  products: Record<string, Product>,
  invoices: Invoice[],
  approvals: Approval[],
  users: Record<string, User>,
  _customers: Record<string, Customer>,
  orders: FulfillmentOrder[] = [],
): SalesMetrics {
  const won = quotations.filter((q) =>
    ["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage),
  );
  const revenue = invoices.reduce((sum, i) => sum + paidAmount(i), 0);
  const pipeline = quotations
    .filter((q) => !["PAID", "CANCELLED"].includes(q.stage))
    .reduce((sum, q) => sum + calculateTotals(q.lines, products).total, 0);

  let gross = 0;
  let discount = 0;
  const monthly = new Map<string, { revenue: number; pipeline: number; gross: number; disc: number }>();
  const upsell = new Map<string, number>();

  // Product metrics trackers
  const productStats = new Map<
    string,
    {
      unitsSold: number;
      revenue: number;
      quotedUnits: number;
      quoteCount: number;
      discountSum: number;
      maxDiscount: number;
      grossSum: number;
      discountAmountSum: number;
    }
  >();

  for (const q of quotations) {
    const totals = calculateTotals(q.lines, products);
    gross += totals.gross;
    discount += totals.discount;
    const key = new Date(q.createdAt).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    const bucket = monthly.get(key) ?? { revenue: 0, pipeline: 0, gross: 0, disc: 0 };
    bucket.pipeline += totals.total;
    if (["INVOICED", "PAID"].includes(q.stage)) bucket.revenue += totals.total;
    bucket.gross += totals.gross;
    bucket.disc += totals.discount;
    monthly.set(key, bucket);

    const isWon = ["CONFIRMED", "FULFILLMENT", "INVOICED", "PAID"].includes(q.stage);

    for (const line of q.lines) {
      const p = products[line.productId];
      if (!p) continue;
      if (p.category !== "Hardware") {
        upsell.set(p.name, (upsell.get(p.name) ?? 0) + line.qty);
      }

      // Aggregate product stats
      const curr = productStats.get(p.id) ?? {
        unitsSold: 0,
        revenue: 0,
        quotedUnits: 0,
        quoteCount: 0,
        discountSum: 0,
        maxDiscount: 0,
        grossSum: 0,
        discountAmountSum: 0,
      };

      curr.quotedUnits += line.qty;
      curr.quoteCount += 1;
      curr.discountSum += line.discountPct;
      curr.maxDiscount = Math.max(curr.maxDiscount, line.discountPct);

      const lineGross = line.qty * line.unitPrice;
      const lineDisc = (lineGross * line.discountPct) / 100;
      curr.grossSum += lineGross;
      curr.discountAmountSum += lineDisc;

      if (isWon) {
        curr.unitsSold += line.qty;
        curr.revenue += lineGross - lineDisc;
      }

      productStats.set(p.id, curr);
    }
  }

  // Best Selling Items (Ranked by Units Sold & Net Revenue)
  const bestSellingProducts: BestSellingProduct[] = Object.values(products)
    .map((p) => {
      const stats = productStats.get(p.id);
      const unitsSold = stats?.unitsSold ?? 0;
      const totalRevenue = Math.round(stats?.revenue ?? 0);
      const avgSellingPrice = unitsSold > 0 ? Math.round(totalRevenue / unitsSold) : p.price;
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        unitPrice: p.price,
        unitsSold,
        totalRevenue,
        avgSellingPrice,
      };
    })
    .filter((p) => p.unitsSold > 0 || (productStats.get(p.productId)?.quotedUnits ?? 0) > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || b.totalRevenue - a.totalRevenue);

  // Most Discounted Items (Ranked by Average Discount %)
  const mostDiscountedProducts: MostDiscountedProduct[] = Object.values(products)
    .map((p) => {
      const stats = productStats.get(p.id);
      const quoteCount = stats?.quoteCount ?? 0;
      const avgDiscountPct =
        stats && stats.grossSum > 0
          ? +((stats.discountAmountSum / stats.grossSum) * 100).toFixed(1)
          : stats && quoteCount > 0
            ? +(stats.discountSum / quoteCount).toFixed(1)
            : 0;
      const maxDiscountPct = stats?.maxDiscount ?? 0;
      const totalDiscountAmount = Math.round(stats?.discountAmountSum ?? 0);
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        quoteCount,
        avgDiscountPct,
        maxDiscountPct,
        totalDiscountAmount,
      };
    })
    .filter((p) => p.quoteCount > 0)
    .sort((a, b) => b.avgDiscountPct - a.avgDiscountPct || b.maxDiscountPct - a.maxDiscountPct);

  const decided = approvals.flatMap((a) =>
    a.steps
      .filter((s) => s.decidedAt)
      .map((s) => (new Date(s.decidedAt!).getTime() - new Date(a.submittedAt).getTime()) / 3600000),
  );

  // Performance by Rep
  const byRepMap = new Map<string, { quotes: number; value: number; gross: number; disc: number }>();
  for (const q of quotations) {
    const totals = calculateTotals(q.lines, products);
    const name = users[q.ownerId]?.name ?? "Unassigned";
    const b = byRepMap.get(name) ?? { quotes: 0, value: 0, gross: 0, disc: 0 };
    b.quotes += 1;
    b.value += totals.total;
    b.gross += totals.gross;
    b.disc += totals.discount;
    byRepMap.set(name, b);
  }

  // Performance by Sales Team
  const byTeam: TeamPerformance[] = SALES_TEAMS.map((team) => {
    const teamQuotes = quotations.filter((q) => team.repIds.includes(q.ownerId));
    let tValue = 0;
    let tGross = 0;
    let tDisc = 0;
    for (const q of teamQuotes) {
      const totals = calculateTotals(q.lines, products);
      tValue += totals.total;
      tGross += totals.gross;
      tDisc += totals.discount;
    }
    return {
      teamId: team.id,
      teamName: team.name,
      quotesCount: teamQuotes.length,
      totalValue: Math.round(tValue),
      avgDiscount: tGross > 0 ? +((tDisc / tGross) * 100).toFixed(1) : 0,
      reps: team.repIds.map((id) => users[id]?.name ?? id),
    };
  });

  const bottleneckMap = new Map<string, { pending: number; days: number }>();
  for (const a of approvals) {
    for (const s of a.steps) {
      if (s.status !== "PENDING") continue;
      const b = bottleneckMap.get(s.role) ?? { pending: 0, days: 0 };
      b.pending += 1;
      b.days += daysSince(a.submittedAt);
      bottleneckMap.set(s.role, b);
    }
  }

  const trend = [...monthly.entries()].map(([month, v]) => ({
    month,
    revenue: Math.round(v.revenue),
    pipeline: Math.round(v.pipeline),
  }));

  const ordersShipped = orders.filter((o) => o.status === "SHIPPED").length;
  const ordersPending = orders.filter((o) => o.status === "AWAITING" || o.status === "BACKORDERED").length;

  return {
    quotesCreated: quotations.length,
    revenue: Math.round(revenue),
    pipeline: Math.round(pipeline),
    conversionRate: quotations.length
      ? +((won.length / quotations.length) * 100).toFixed(1)
      : 0,
    avgDiscountPct: gross ? +((discount / gross) * 100).toFixed(1) : 0,
    avgApprovalHours: decided.length
      ? +(decided.reduce((a, b) => a + b, 0) / decided.length).toFixed(1)
      : 0,
    topUpsoldProduct:
      [...upsell.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Enterprise Care Pack",
    orderCount: orders.length,
    ordersShipped,
    ordersPending,
    trend,
    byRep: [...byRepMap.entries()]
      .map(([rep, v]) => ({
        rep,
        quotes: v.quotes,
        value: Math.round(v.value),
        avgDiscount: v.gross ? +((v.disc / v.gross) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.value - a.value),
    byTeam,
    bottlenecks: [...bottleneckMap.entries()].map(([role, v]) => ({
      role: role.replace("_", " "),
      pending: v.pending,
      avgDays: +(v.days / v.pending).toFixed(1),
    })),
    discountTrend: [...monthly.entries()].map(([month, v]) => ({
      month,
      discountPct: v.gross ? +((v.disc / v.gross) * 100).toFixed(1) : 0,
    })),
    bestSellingProducts,
    mostDiscountedProducts,
  };
}
