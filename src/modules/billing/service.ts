import type {
  BillingCycle,
  Invoice,
  InvoiceStatus,
  Payment,
  Subscription,
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
  now = new Date(),
): ProrationResult {
  const daysInCycle = CYCLE_DAYS[sub.cycle];
  const next = new Date(sub.nextBillDate).getTime();
  const daysRemaining = Math.max(
    0,
    Math.min(daysInCycle, Math.ceil((next - now.getTime()) / 86400000)),
  );
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
