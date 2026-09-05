import type {
  Approval,
  Customer,
  DealHealthAlert,
  DealHealthStatus,
  FulfillmentOrder,
  Product,
  Quotation,
  User,
} from "../shared/types";
import { calculateTotals, daysSince } from "../quotations/service";

const STALL_DAYS = 7;
const APPROVAL_BOTTLENECK_DAYS = 3;
const ANOMALY_THRESHOLD_PCT = 5;

export interface DealIntelligenceInput {
  quotations: Quotation[];
  products: Record<string, Product>;
  customers: Record<string, Customer>;
  users: Record<string, User>;
  orders: FulfillmentOrder[];
  approvals: Approval[];
  stallDaysThreshold?: number;
}

/** Historical blended discount per rep, used as the anomaly baseline. */
export function repDiscountAverages(
  quotations: Quotation[],
  products: Record<string, Product>,
): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (const q of quotations) {
    const totals = calculateTotals(q.lines, products);
    if (totals.gross <= 0) continue;
    const pct = (totals.discount / totals.gross) * 100;
    (buckets[q.ownerId] ??= []).push(pct);
  }
  const out: Record<string, number> = {};
  for (const [rep, values] of Object.entries(buckets)) {
    out[rep] = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  }
  return out;
}

export function detectStalledDeals(input: DealIntelligenceInput): DealHealthAlert[] {
  const threshold = input.stallDaysThreshold ?? STALL_DAYS;
  return input.quotations
    .filter(
      (q) =>
        ["DRAFT", "PENDING_APPROVAL", "NEGOTIATION"].includes(q.stage) &&
        daysSince(q.updatedAt) >= threshold,
    )
    .map((q) => {
      const days = daysSince(q.updatedAt);
      return alert(q, input, {
        issue: "Stalled deal",
        detail: `No activity for ${days} days (threshold: ${threshold}d) while sitting in ${q.stage.toLowerCase().replace("_", " ")}.`,
        severity: days >= threshold * 3 ? "Critical" : days >= threshold * 2 ? "At Risk" : "Watch",
        recommendedAction: "Nudge the owner to re-engage the customer",
      });
    });
}

export function detectAnomalies(input: DealIntelligenceInput): DealHealthAlert[] {
  const averages = repDiscountAverages(input.quotations, input.products);
  const out: DealHealthAlert[] = [];
  for (const q of input.quotations) {
    const totals = calculateTotals(q.lines, input.products);
    if (totals.gross <= 0) continue;
    const pct = (totals.discount / totals.gross) * 100;
    const baseline = averages[q.ownerId];
    const sample = input.quotations.filter((x) => x.ownerId === q.ownerId).length;
    if (baseline === undefined || sample < 3) continue;
    const delta = +(pct - baseline).toFixed(1);
    if (delta < ANOMALY_THRESHOLD_PCT) continue;
    out.push(
      alert(q, input, {
        issue: "Discount anomaly",
        detail: `Discount is ${delta} percentage points above this rep's historical average of ${baseline}%.`,
        severity: delta >= 9 ? "Critical" : "At Risk",
        recommendedAction: "Escalate to the approving manager for review",
      }),
    );
  }
  return out;
}

export function detectDeliverySlippage(input: DealIntelligenceInput): DealHealthAlert[] {
  const out: DealHealthAlert[] = [];
  for (const order of input.orders) {
    const q = input.quotations.find((x) => x.id === order.quotationId);
    if (!q) continue;
    const late = new Date(order.dueAt).getTime() < Date.now() && order.status !== "SHIPPED";
    const backordered = order.backorders.some((b) => b.status === "OPEN");
    if (!late && !backordered) continue;
    out.push(
      alert(q, input, {
        issue: "Delivery slippage",
        detail: late
          ? `Promised date passed ${daysSince(order.dueAt)} days ago with the order still ${order.status.toLowerCase()}.`
          : "Open backorder is blocking a complete shipment.",
        severity: late && backordered ? "Critical" : "At Risk",
        recommendedAction: "Review the warehouse split and confirm replenishment",
      }),
    );
  }
  return out;
}

export function detectNegotiationPressure(input: DealIntelligenceInput): DealHealthAlert[] {
  return input.quotations
    .filter((q) => q.requests.length >= 2 || q.messages.length >= 4)
    .map((q) =>
      alert(q, input, {
        issue: "Excessive negotiation activity",
        detail: `${q.requests.length} change requests and ${q.messages.length} messages exchanged on this deal.`,
        severity: "Watch",
        recommendedAction: "Agree final terms in a single revision",
      }),
    );
}

export function detectApprovalBottlenecks(input: DealIntelligenceInput): DealHealthAlert[] {
  return input.approvals
    .filter((a) => a.status === "PENDING" && daysSince(a.submittedAt) >= APPROVAL_BOTTLENECK_DAYS)
    .flatMap((a) => {
      const q = input.quotations.find((x) => x.id === a.quotationId);
      if (!q) return [];
      return [
        alert(q, input, {
          issue: "Approval bottleneck",
          detail: `Awaiting a decision for ${daysSince(a.submittedAt)} days at ${a.steps.find((s) => s.status === "PENDING")?.role ?? "approval"}.`,
          severity: "At Risk",
          recommendedAction: "Escalate the approval queue",
        }),
      ];
    });
}

export function calculateDealHealth(input: DealIntelligenceInput): DealHealthAlert[] {
  const all = [
    ...detectStalledDeals(input),
    ...detectAnomalies(input),
    ...detectDeliverySlippage(input),
    ...detectNegotiationPressure(input),
    ...detectApprovalBottlenecks(input),
  ];
  const rank: Record<DealHealthStatus, number> = {
    Critical: 0,
    "At Risk": 1,
    Watch: 2,
    Healthy: 3,
  };
  return all.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function healthOf(alerts: DealHealthAlert[], quotationId: string): DealHealthStatus {
  const mine = alerts.filter((a) => a.quotationId === quotationId);
  if (mine.some((a) => a.severity === "Critical")) return "Critical";
  if (mine.some((a) => a.severity === "At Risk")) return "At Risk";
  if (mine.length > 0) return "Watch";
  return "Healthy";
}

function alert(
  q: Quotation,
  input: DealIntelligenceInput,
  data: {
    issue: string;
    detail: string;
    severity: DealHealthStatus;
    recommendedAction: string;
  },
): DealHealthAlert {
  return {
    id: `${q.id}-${data.issue.replace(/\s/g, "-").toLowerCase()}`,
    quotationId: q.id,
    quotationNumber: q.number,
    customerName: input.customers[q.customerId]?.name ?? "Unknown",
    detectedAt: q.updatedAt,
    ...data,
  };
}
