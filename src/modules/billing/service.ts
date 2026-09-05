import type {
  BillingCycle,
  Invoice,
  InvoiceStatus,
  Payment,
  Subscription,
  SubscriptionPlan,
} from "../shared/types";
import { round } from "../quotations/service";

export const CYCLE_DAYS: Record<BillingCycle, number> = {
  Monthly: 30,
  Quarterly: 91,
  Yearly: 365,
};

export function addCycle(from: string, cycle: BillingCycle) {
  const date = new Date(from);
  if (cycle === "Monthly") date.setMonth(date.getMonth() + 1);
  if (cycle === "Quarterly") date.setMonth(date.getMonth() + 3);
  if (cycle === "Yearly") date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

export interface ScheduleEntry {
  date: string;
  amount: number;
  label: string;
}

export function calculateBillingSchedule(sub: Subscription, periods = 6): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  let cursor = sub.nextBillDate;
  const amount = round(sub.qty * sub.unitPrice);
  for (let i = 0; i < periods; i++) {
    entries.push({
      date: cursor,
      amount,
      label: `${sub.cycle} charge ${i + 1}`,
    });
    cursor = addCycle(cursor, sub.cycle);
  }
  return entries;
}

export interface ProrationResult {
  daysRemaining: number;
  daysInCycle: number;
  unusedCredit: number;
  newCharge: number;
  difference: number;
  kind: "CREDIT" | "CHARGE" | "NONE";
}

/** Real mid-cycle proration based on unused days of the current period. */
export function calculateProration(
  sub: Subscription,
  newQty: number,
  newUnitPrice: number,
  plan?: SubscriptionPlan | null,
  now = new Date(),
): ProrationResult {
  const daysInCycle = CYCLE_DAYS[sub.cycle] || 30;
  const next = new Date(sub.nextBillDate).getTime();
  const daysRemaining = Math.max(
    0,
    Math.min(daysInCycle, Math.ceil((next - now.getTime()) / 86400000)),
  );

  // If proration is explicitly disabled on the plan, no mid-cycle difference is charged/credited
  if (plan && plan.prorationEnabled === false) {
    return {
      daysRemaining,
      daysInCycle,
      unusedCredit: 0,
      newCharge: 0,
      difference: 0,
      kind: "NONE",
    };
  }

  const ratio = daysRemaining / daysInCycle;
  const oldAmount = sub.qty * sub.unitPrice;
  const newAmount = newQty * newUnitPrice;
  const unusedCredit = round(oldAmount * ratio);
  const newCharge = round(newAmount * ratio);
  const difference = round(newCharge - unusedCredit);
  return {
    daysRemaining,
    daysInCycle,
    unusedCredit,
    newCharge,
    difference,
    kind: difference > 0 ? "CHARGE" : difference < 0 ? "CREDIT" : "NONE",
  };
}

export interface CancellationRefundResult {
  daysRemaining: number;
  daysInCycle: number;
  unearnedPeriodAmount: number;
  refundRatePct: number;
  refundAmount: number;
  policyNotes: string;
  isRefundable: boolean;
}

/**
 * Calculates cancellation refund based on remaining unserved cycle days
 * and the configured cancellation/refund policy of the subscription plan.
 */
export function calculateCancellationRefund(
  sub: Subscription,
  plan?: SubscriptionPlan | null,
  now = new Date(),
): CancellationRefundResult {
  const daysInCycle = CYCLE_DAYS[sub.cycle] || 30;
  const next = new Date(sub.nextBillDate).getTime();
  const daysRemaining = Math.max(
    0,
    Math.min(daysInCycle, Math.ceil((next - now.getTime()) / 86400000)),
  );

  const policy = plan?.cancellationPolicy?.toLowerCase() || "";

  // Determine refund percentage from plan policy rules
  let refundRatePct = 100; // default full prorated refund
  if (policy.includes("no refund") || policy.includes("non-refundable") || policy.includes("0%")) {
    refundRatePct = 0;
  } else if (policy.includes("50%") || policy.includes("partial") || policy.includes("half")) {
    refundRatePct = 50;
  } else if (policy.includes("25%")) {
    refundRatePct = 25;
  } else if (policy.includes("75%")) {
    refundRatePct = 75;
  }

  const unearnedPeriodAmount = round((daysRemaining / daysInCycle) * (sub.qty * sub.unitPrice));
  const refundAmount = round(unearnedPeriodAmount * (refundRatePct / 100));

  return {
    daysRemaining,
    daysInCycle,
    unearnedPeriodAmount,
    refundRatePct,
    refundAmount,
    policyNotes: plan?.cancellationPolicy || "Prorated refund for remaining unused days",
    isRefundable: refundAmount > 0,
  };
}

export function outstanding(invoice: Invoice) {
  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  return round(invoice.amount - paid);
}

export function paidAmount(invoice: Invoice) {
  return round(invoice.payments.reduce((sum, p) => sum + p.amount, 0));
}

/** Reconciliation: an invoice is only Paid when payments cover the balance. */
export function reconcile(invoice: Invoice, extra: Payment[] = []): InvoiceStatus {
  const payments = [...invoice.payments, ...extra];
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const overdue = new Date(invoice.dueDate).getTime() < Date.now();
  if (paid <= 0) return overdue ? "OVERDUE" : "UNPAID";
  if (paid + 0.01 < invoice.amount) return "PARTIALLY_PAID";
  return "PAID";
}
