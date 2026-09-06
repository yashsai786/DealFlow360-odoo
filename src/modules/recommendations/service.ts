import type { Product, ProductCategory, Quotation, Recommendation, RecommendationRule } from "../shared/types";
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
    triggerProductId: "p-server",
    suggestedProductId: "p-setup",
    reason: "Server rack & blade deployments typically require on-site setup.",
    confidence: 0.90,
  },
  {
    triggerProductId: "p-server",
    suggestedProductId: "p-care",
    reason: "24/7 mission-critical SLA care pack recommended for server nodes.",
    confidence: 0.88,
  },
  {
    triggerProductId: "p-storage",
    suggestedProductId: "p-deploy",
    reason: "Storage arrays convert better with cluster deployment validation.",
    confidence: 0.85,
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
  promotedProductIds: ["p-warranty", "p-care"],
  rules: RECOMMENDATION_RULES,
};

/**
 * Intelligent semantic affinity matching between trigger product and candidate.
 * Identifies domain clusters (e.g. cluster/cloud/devops, server/rack/storage, network/switches).
 */
function computeKeywordAffinity(
  triggerName: string,
  candidateName: string,
  category: ProductCategory
): { affinity: number; reason: string } {
  const triggerLower = triggerName.toLowerCase();
  const candLower = candidateName.toLowerCase();

  // Domain synonym clusters
  const clusters: { terms: string[]; tag: string }[] = [
    {
      terms: ["cluster", "deploy", "kubernetes", "microservices", "pipeline", "ci/cd", "cloud", "migration", "devops", "automation"],
      tag: "cloud orchestration & deployment",
    },
    {
      terms: ["server", "blade", "node", "rack", "pdu", "ups", "nvme", "array", "storage", "shelf", "power", "supply", "kvm"],
      tag: "data center & compute infrastructure",
    },
    {
      terms: ["network", "switch", "spine", "gateway", "transceiver", "patch", "cable", "sd-wan", "poe", "fiber", "wi-fi", "router"],
      tag: "enterprise networking & connectivity",
    },
    {
      terms: ["security", "zero-trust", "audit", "penetration", "red team", "hardening", "forensics", "firewall", "compliance", "iso", "siem", "edr"],
      tag: "cybersecurity & compliance governance",
    },
    {
      terms: ["database", "sql", "performance", "optimization", "deduplication", "retention", "snapshot", "backup"],
      tag: "database performance & data lifecycle",
    },
    {
      terms: ["care", "pack", "sla", "support", "backup", "tam", "priority", "replacement", "warranty", "license"],
      tag: "enterprise SLA & managed support",
    },
    {
      terms: ["workstation", "laptop", "tablet", "terminal", "vdi", "monitor", "dock", "i7", "32c"],
      tag: "client computing & productivity fleet",
    },
  ];

  for (const c of clusters) {
    const triggerMatch = c.terms.some((term) => triggerLower.includes(term));
    const candMatch = c.terms.some((term) => candLower.includes(term));
    if (triggerMatch && candMatch) {
      return {
        affinity: 0.96,
        reason: `Direct companion in ${c.tag}, frequently co-procured with ${triggerName}.`,
      };
    }
  }

  return {
    affinity: 0.75,
    reason: `Related ${category.toLowerCase()} package commonly attached to ${triggerName}.`,
  };
}

export function getRecommendations(
  quotation: Quotation,
  products: Record<string, Product>,
  config?: UpsellConfig,
  categoryFilter?: ProductCategory | "MATCH" | "ALL",
): Recommendation[] {
  const minMargin = config?.minMarginPct ?? 15;
  const promotedIds = new Set(config?.promotedProductIds ?? ["p-warranty", "p-care"]);
  const activeRules = config?.rules && config.rules.length > 0 ? config.rules : RECOMMENDATION_RULES;

  const present = new Set(quotation.lines.map((l) => l.productId));
  const dismissed = new Set(quotation.dismissedRecommendations || []);
  const allProducts = Object.values(products);
  const scored = new Map<string, Recommendation>();

  // Determine allowed categories based on quotation lines
  const cartCategories = new Set(
    quotation.lines.map((l) => products[l.productId]?.category).filter(Boolean) as ProductCategory[]
  );

  const isCategoryAllowed = (cat: ProductCategory): boolean => {
    if (categoryFilter === "ALL") return true;
    if (categoryFilter && categoryFilter !== "MATCH") return cat === categoryFilter;
    // Default MATCH: If cart has items, strictly match the category of items in the quotation!
    if (cartCategories.size > 0) return cartCategories.has(cat);
    return true;
  };

  // 1. Process explicit rules (if candidate category is allowed)
  for (const rule of activeRules) {
    if (!present.has(rule.triggerProductId)) continue;
    if (!present.has(rule.suggestedProductId)) {
      if (dismissed.has(rule.suggestedProductId)) continue;
      const product = products[rule.suggestedProductId];
      if (!product || !isCategoryAllowed(product.category)) continue;

      const marginPct = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
      if (marginPct < minMargin) continue;

      const isPromoted = promotedIds.has(product.id) || Boolean(rule.promotion);
      const triggerLine = quotation.lines.find((l) => l.productId === rule.triggerProductId);
      const qty = triggerLine?.qty ?? 1;
      const marginDelta = Math.round((product.price - product.cost) * qty);

      scored.set(product.id, {
        productId: product.id,
        productName: product.name,
        reason: rule.reason,
        marginDelta,
        confidence: rule.confidence,
        promotion: rule.promotion || (isPromoted ? "Admin Promoted" : undefined),
        price: product.price,
        isPromoted,
        category: product.category,
      });
    }
  }

  // 2. Intelligent Dynamic Relationship Matching strictly within allowed categories
  for (const line of quotation.lines) {
    const triggerProd = products[line.productId];
    if (!triggerProd) continue;

    for (const cand of allProducts) {
      if (cand.id === triggerProd.id) continue;
      if (present.has(cand.id)) continue;
      if (dismissed.has(cand.id)) continue;
      if (scored.has(cand.id)) continue;
      if (!isCategoryAllowed(cand.category)) continue;

      const marginPct = cand.price > 0 ? ((cand.price - cand.cost) / cand.price) * 100 : 0;
      if (marginPct < minMargin) continue;

      const isPromoted = promotedIds.has(cand.id);
      const { affinity, reason } = computeKeywordAffinity(triggerProd.name, cand.name, cand.category);

      const qty = line.qty || 1;
      const marginDelta = Math.round((cand.price - cand.cost) * qty);

      scored.set(cand.id, {
        productId: cand.id,
        productName: cand.name,
        reason,
        marginDelta,
        confidence: isPromoted ? Math.max(affinity, 0.90) : affinity,
        promotion: isPromoted ? "Admin Promoted" : undefined,
        price: cand.price,
        isPromoted,
        category: cand.category,
      });
    }
  }

  // 3. Fallback for Empty Quotation: Recommend top matching items meeting margin cutoff
  if (quotation.lines.length === 0) {
    for (const cand of allProducts) {
      if (dismissed.has(cand.id)) continue;
      if (!isCategoryAllowed(cand.category)) continue;
      const marginPct = cand.price > 0 ? ((cand.price - cand.cost) / cand.price) * 100 : 0;
      if (marginPct < minMargin) continue;

      const isPromoted = promotedIds.has(cand.id);
      scored.set(cand.id, {
        productId: cand.id,
        productName: cand.name,
        reason: isPromoted
          ? `Admin-promoted ${cand.category} offering with high margin yield.`
          : `Top-converting ${cand.category} recommendation for new quotes.`,
        marginDelta: Math.round(cand.price - cand.cost),
        confidence: isPromoted ? 0.90 : 0.75,
        promotion: isPromoted ? "Admin Promoted" : undefined,
        price: cand.price,
        isPromoted,
        category: cand.category,
      });
    }
  }

  // 4. Rank and sort by Relevance & Margin:
  // - Promoted products always rank on top
  // - Then by composite score = confidence * (1 + marginPct / 100)
  //   (Normalized margin percentage prevents expensive products from dominating relevance)
  const ranked = [...scored.values()].sort((a, b) => {
    if (Boolean(a.isPromoted) !== Boolean(b.isPromoted)) {
      return a.isPromoted ? -1 : 1;
    }
    const prodA = products[a.productId];
    const prodB = products[b.productId];
    const marginPctA = prodA && prodA.price > 0 ? ((prodA.price - prodA.cost) / prodA.price) * 100 : 0;
    const marginPctB = prodB && prodB.price > 0 ? ((prodB.price - prodB.cost) / prodB.price) * 100 : 0;

    const scoreA = a.confidence * (1 + marginPctA / 100) * (a.isPromoted ? 1.5 : 1.0);
    const scoreB = b.confidence * (1 + marginPctB / 100) * (b.isPromoted ? 1.5 : 1.0);
    return scoreB - scoreA;
  });

  // Balanced multi-category distribution:
  // When cart contains multiple categories (e.g. Subscriptions AND Hardware),
  // ensure at least 1 top companion per cart category before filling remaining slots.
  if (cartCategories.size > 1 && (!categoryFilter || categoryFilter === "MATCH")) {
    const byCategory = new Map<ProductCategory, Recommendation[]>();
    for (const cat of cartCategories) {
      byCategory.set(cat, []);
    }
    for (const rec of ranked) {
      const cat = products[rec.productId]?.category;
      if (cat && byCategory.has(cat)) {
        byCategory.get(cat)!.push(rec);
      }
    }

    const balanced: Recommendation[] = [];
    const usedIds = new Set<string>();

    // Pass 1: Ensure top #1 recommendation from each category in the cart
    for (const cat of cartCategories) {
      const topForCat = byCategory.get(cat)?.find((r) => !usedIds.has(r.productId));
      if (topForCat && balanced.length < 3) {
        balanced.push(topForCat);
        usedIds.add(topForCat.productId);
      }
    }

    // Pass 2: Fill remaining slot(s) up to 3 with highest scored items
    for (const rec of ranked) {
      if (balanced.length >= 3) break;
      if (!usedIds.has(rec.productId)) {
        balanced.push(rec);
        usedIds.add(rec.productId);
      }
    }

    return balanced;
  }

  // Limit to at max 3 products as specified
  return ranked.slice(0, 3);
}
