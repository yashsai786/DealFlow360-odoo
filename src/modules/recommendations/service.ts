import type { Product, Quotation, Recommendation, RecommendationRule } from "../shared/types";
export type { RecommendationRule };

/** Deterministic co-purchase graph — seeded, never random. */
export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    triggerProductId: "p-laptop",
    suggestedProductId: "p-warranty",
    reason: "Customers purchasing Enterprise Laptop frequently add Extended Warranty.",
    confidence: 0.92,
    promotion: "Bundle promo: 3-year cover at 2-year price",
  },
  {
    triggerProductId: "p-laptop",
    suggestedProductId: "p-careplan",
    reason: "Hardware rollouts are usually paired with a managed Cloud Care Plan.",
    confidence: 0.78,
  },
  {
    triggerProductId: "p-laptop",
    suggestedProductId: "p-setup",
    reason: "Fleet deployments of 10+ laptops typically include Setup Service.",
    confidence: 0.71,
  },
  {
    triggerProductId: "p-network",
    suggestedProductId: "p-implementation",
    reason: "Network Equipment orders convert better with Implementation Service attached.",
    confidence: 0.84,
    promotion: "Q3 rollout incentive",
  },
  {
    triggerProductId: "p-network",
    suggestedProductId: "p-warranty",
    reason: "Extended Warranty reduces support escalations on network hardware.",
    confidence: 0.65,
  },
  {
    triggerProductId: "p-setup",
    suggestedProductId: "p-careplan",
    reason: "Teams that buy Setup Service renew Cloud Care Plan at a high rate.",
    confidence: 0.69,
  },
];

export interface UpsellConfig {
  minMarginPct: number;
  promotedProductIds: string[];
  rules: RecommendationRule[];
}

export const DEFAULT_UPSELL_CONFIG: UpsellConfig = {
  minMarginPct: 15,
  promotedProductIds: ["p-warranty"],
  rules: RECOMMENDATION_RULES,
};

export function getRecommendations(
  quotation: Quotation,
  products: Record<string, Product>,
  config?: UpsellConfig,
): Recommendation[] {
  const minMargin = config?.minMarginPct ?? 15;
  const promotedIds = new Set(config?.promotedProductIds ?? ["p-warranty"]);
  const activeRules = config?.rules && config.rules.length > 0 ? config.rules : RECOMMENDATION_RULES;

  const present = new Set(quotation.lines.map((l) => l.productId));
  const scored = new Map<string, Recommendation>();

  for (const rule of activeRules) {
    if (!present.has(rule.triggerProductId)) continue;
    if (present.has(rule.suggestedProductId)) continue;
    if (quotation.dismissedRecommendations.includes(rule.suggestedProductId)) continue;
    const product = products[rule.suggestedProductId];
    if (!product) continue;

    const marginPct = ((product.price - product.cost) / product.price) * 100;
    if (marginPct < minMargin) continue;

    const isPromoted = promotedIds.has(product.id) || Boolean(rule.promotion);
    const qty = quotation.lines.find((l) => l.productId === rule.triggerProductId)?.qty ?? 1;
    const marginDelta = Math.round((product.price - product.cost) * qty);
    const existing = scored.get(product.id);
    if (existing && existing.confidence >= rule.confidence) continue;

    scored.set(product.id, {
      productId: product.id,
      productName: product.name,
      reason: rule.reason,
      marginDelta,
      confidence: rule.confidence,
      promotion: rule.promotion,
      price: product.price,
      isPromoted,
    });
  }

  // Rank promoted products at the top, then sort by boosted score
  return [...scored.values()].sort((a, b) => {
    if (Boolean(a.isPromoted) !== Boolean(b.isPromoted)) {
      return a.isPromoted ? -1 : 1;
    }
    const scoreA = a.confidence * a.marginDelta * (a.isPromoted ? 1.5 : 1.0);
    const scoreB = b.confidence * b.marginDelta * (b.isPromoted ? 1.5 : 1.0);
    return scoreB - scoreA;
  });
}
