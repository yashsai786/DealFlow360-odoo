import type {
  Approval,
  Customer,
  Invoice,
  Product,
  Quotation,
  User,
} from "../shared/types";
import { calculateTotals, daysSince } from "../quotations/service";
import { paidAmount } from "../billing/service";

export interface ReportFilters {
  period: "30" | "90" | "365" | "all";
  ownerId: string;
  stage: string;
  category: string;
}

export const DEFAULT_FILTERS: ReportFilters = {
  period: "90",
  ownerId: "all",
  stage: "all",
  category: "all",
};

export interface SalesMetrics {
  quotesCreated: number;
  revenue: number;
  pipeline: number;
  conversionRate: number;
  avgDiscountPct: number;
  avgApprovalHours: number;
  topUpsoldProduct: string;
  trend: { month: string; revenue: number; pipeline: number }[];
  byRep: { rep: string; quotes: number; value: number; avgDiscount: number }[];
  bottlenecks: { role: string; pending: number; avgDays: number }[];
  discountTrend: { month: string; discountPct: number }[];
}

export function filterQuotations(
  quotations: Quotation[],
  products: Record<string, Product>,
  filters: ReportFilters,
) {
  const cutoff =
    filters.period === "all" ? 0 : Date.now() - Number(filters.period) * 86400000;
  return quotations.filter((q) => {
    if (new Date(q.createdAt).getTime() < cutoff) return false;
    if (filters.ownerId !== "all" && q.ownerId !== filters.ownerId) return false;
    if (filters.stage !== "all" && q.stage !== filters.stage) return false;
    if (
      filters.category !== "all" &&
      !q.lines.some((l) => products[l.productId]?.category === filters.category)
    )
      return false;
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

    for (const line of q.lines) {
      const p = products[line.productId];
      if (!p) continue;
      if (p.category === "Hardware") continue;
      upsell.set(p.name, (upsell.get(p.name) ?? 0) + line.qty);
    }
  }

  const decided = approvals.flatMap((a) =>
    a.steps
      .filter((s) => s.decidedAt)
      .map((s) => (new Date(s.decidedAt!).getTime() - new Date(a.submittedAt).getTime()) / 3600000),
  );

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
      [...upsell.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No upsell yet",
    trend,
    byRep: [...byRepMap.entries()]
      .map(([rep, v]) => ({
        rep,
        quotes: v.quotes,
        value: Math.round(v.value),
        avgDiscount: v.gross ? +((v.disc / v.gross) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.value - a.value),
    bottlenecks: [...bottleneckMap.entries()].map(([role, v]) => ({
      role: role.replace("_", " "),
      pending: v.pending,
      avgDays: +(v.days / v.pending).toFixed(1),
    })),
    discountTrend: [...monthly.entries()].map(([month, v]) => ({
      month,
      discountPct: v.gross ? +((v.disc / v.gross) * 100).toFixed(1) : 0,
    })),
  };
}
