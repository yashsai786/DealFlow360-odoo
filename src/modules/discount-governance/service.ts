import type {
  ApprovalStep,
  CustomerTier,
  DiscountEvaluation,
  LineEvaluation,
  Product,
  ProductCategory,
  Quotation,
  RiskLevel,
} from "../shared/types";

export const TIER_CEILINGS: Record<CustomerTier, number> = {
  Bronze: 5,
  Silver: 10,
  Gold: 15,
};

export const CATEGORY_CEILINGS: Record<ProductCategory, number> = {
  Hardware: 15,
  Services: 10,
  Subscriptions: 12,
};

import { type UpsellConfig, DEFAULT_UPSELL_CONFIG } from "../recommendations/service";

export interface GovernanceConfig {
  tierCeilings: Record<CustomerTier, number>;
  categoryCeilings: Record<ProductCategory, number>;
  upsellConfig?: UpsellConfig;
}

export const DEFAULT_CONFIG: GovernanceConfig = {
  tierCeilings: TIER_CEILINGS,
  categoryCeilings: CATEGORY_CEILINGS,
  upsellConfig: DEFAULT_UPSELL_CONFIG,
};

export function effectiveCeiling(
  tier: CustomerTier,
  category: ProductCategory,
  config: GovernanceConfig = DEFAULT_CONFIG,
) {
  return Math.min(config.tierCeilings[tier], config.categoryCeilings[category]);
}

/** Line-level validation of a single discount against tier + category ceilings. */
export function evaluateLineDiscount(
  tier: CustomerTier,
  product: Product,
  discountPct: number,
  lineTotal: number,
  lineId: string,
  config: GovernanceConfig = DEFAULT_CONFIG,
): LineEvaluation {
  const ceilingPct = effectiveCeiling(tier, product.category, config);
  const overagePct = Math.max(0, +(discountPct - ceilingPct).toFixed(2));
  return {
    lineId,
    productName: product.name,
    category: product.category,
    discountPct,
    ceilingPct,
    overagePct,
    violating: overagePct > 0,
    lineTotal,
  };
}

/**
 * Blended risk considers tier headroom, category overage, monetary weight of the
 * offending lines, total discount exposure and the number of violations.
 */
export function calculateBlendedRisk(
  quotation: Quotation,
  tier: CustomerTier,
  products: Record<string, Product>,
  config: GovernanceConfig = DEFAULT_CONFIG,
): DiscountEvaluation {
  const lines: LineEvaluation[] = [];
  let gross = 0;
  let discount = 0;

  for (const line of quotation.lines) {
    const product = products[line.productId];
    if (!product) continue;
    const lineGross = line.qty * line.unitPrice;
    const lineDiscount = (lineGross * line.discountPct) / 100;
    gross += lineGross;
    discount += lineDiscount;
    lines.push(
      evaluateLineDiscount(
        tier,
        product,
        line.discountPct,
        lineGross - lineDiscount,
        line.id,
        config,
      ),
    );
  }

  const blendedDiscountPct = gross > 0 ? +((discount / gross) * 100).toFixed(2) : 0;
  const violations = lines.filter((l) => l.violating);

  let score = 0;
  const reasons: string[] = [];

  // Exposure: how much of the quote value is being given away.
  score += Math.min(30, (discount / Math.max(gross, 1)) * 100 * 1.6);

  for (const v of violations) {
    const weight = gross > 0 ? v.lineTotal / gross : 0;
    score += v.overagePct * 2.4 + weight * 22;
    reasons.push(
      `${v.category} discount on ${v.productName} exceeds the ${v.ceilingPct}% category ceiling by ${v.overagePct} percentage points.`,
    );
  }

  if (violations.length > 1) {
    score += violations.length * 6;
    reasons.push(`${violations.length} lines breach their category ceiling simultaneously.`);
  }

  if (blendedDiscountPct > config.tierCeilings[tier]) {
    score += (blendedDiscountPct - config.tierCeilings[tier]) * 1.8;
    reasons.push(
      `Blended discount of ${blendedDiscountPct}% is above the ${tier} tier allowance of ${config.tierCeilings[tier]}%.`,
    );
  }

  if (gross > 60000 && violations.length > 0) {
    score += 8;
    reasons.push("High contract value amplifies the impact of the discount overage.");
  }

  score = +Math.min(100, score).toFixed(1);
  const riskLevel: RiskLevel = score >= 40 ? "HIGH" : score >= 15 ? "MEDIUM" : "LOW";

  if (reasons.length === 0) {
    reasons.push("All line discounts sit inside tier and category ceilings.");
  }

  return {
    tier,
    tierCeilingPct: config.tierCeilings[tier],
    lines,
    blendedDiscountPct,
    riskScore: score,
    riskLevel,
    reasons,
    approvalChain: determineApprovalChain(riskLevel),
  };
}

/** Routing rules: within limits → none, medium → manager, high → manager + finance. */
export function determineApprovalChain(risk: RiskLevel): ApprovalStep["role"][] {
  if (risk === "LOW") return [];
  if (risk === "MEDIUM") return ["SALES_MANAGER"];
  return ["SALES_MANAGER", "FINANCE"];
}
