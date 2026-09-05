import type { Product, Quotation, QuotationLine, QuotationStage, Totals } from "../shared/types";

const ALLOWED: Record<QuotationStage, QuotationStage[]> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["NEGOTIATION", "CONFIRMED", "PENDING_APPROVAL", "CANCELLED"],
  NEGOTIATION: ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["FULFILLMENT", "CANCELLED"],
  FULFILLMENT: ["INVOICED", "CANCELLED"],
  INVOICED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canTransition(from: QuotationStage, to: QuotationStage) {
  return ALLOWED[from].includes(to);
}

export function calculateTotals(
  lines: QuotationLine[],
  products: Record<string, Product>,
): Totals {
  let gross = 0;
  let discount = 0;
  let tax = 0;
  let oneTimeTotal = 0;
  let recurringTotal = 0;
  let cost = 0;

  for (const line of lines) {
    const product = products[line.productId];
    if (!product) continue;
    const lineGross = line.qty * line.unitPrice;
    const lineDiscount = (lineGross * line.discountPct) / 100;
    const net = lineGross - lineDiscount;
    const lineTax = (net * line.taxPct) / 100;
    gross += lineGross;
    discount += lineDiscount;
    tax += lineTax;
    cost += product.cost * line.qty;
    if (product.cycle) recurringTotal += net;
    else oneTimeTotal += net;
  }

  const net = gross - discount;
  const margin = net - cost;
  return {
    gross: round(gross),
    discount: round(discount),
    tax: round(tax),
    total: round(net + tax),
    oneTimeTotal: round(oneTimeTotal),
    recurringTotal: round(recurringTotal),
    margin: round(margin),
    marginPct: net > 0 ? +((margin / net) * 100).toFixed(1) : 0,
  };
}

export function lineNet(line: QuotationLine) {
  const gross = line.qty * line.unitPrice;
  return round(gross - (gross * line.discountPct) / 100);
}

export function lineMargin(line: QuotationLine, product: Product) {
  return round(lineNet(line) - product.cost * line.qty);
}

export function stageLabel(stage: QuotationStage) {
  return stage
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function isRecurring(quotation: Quotation, products: Record<string, Product>) {
  return quotation.lines.some((l) => products[l.productId]?.cycle);
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}
