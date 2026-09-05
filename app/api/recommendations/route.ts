import { quotationRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import {
  getRecommendations,
  DEFAULT_UPSELL_CONFIG,
  type UpsellConfig,
} from "@/modules/recommendations/service";
import type { Product, Quotation } from "@/modules/shared/types";

let currentConfig: UpsellConfig = { ...DEFAULT_UPSELL_CONFIG };

export async function GET() {
  try {
    return apiSuccess(currentConfig);
  } catch (err: any) {
    return apiError("RECOMMENDATIONS_CONFIG_ERROR", err?.message || "Failed to load upsell config", 500);
  }
}

import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function PUT(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "upsell.manage");

    const body = await req.json();
    currentConfig = {
      ...currentConfig,
      ...body,
    };
    return apiSuccess(currentConfig);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("RECOMMENDATIONS_CONFIG_UPDATE_ERROR", err?.message || "Failed to update upsell config", status);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let quotation: Quotation | null = body.quotation || null;

    if (!quotation && body.quotationId) {
      quotation = await quotationRepository.findById(body.quotationId);
    }

    if (!quotation) {
      return apiError("NOT_FOUND", "Quotation not found", 404);
    }

    // Load products from DB
    const productRows = await prisma.product.findMany();
    const products: Record<string, Product> = {};
    for (const p of productRows) {
      products[p.id] = {
        id: p.id,
        name: p.name,
        category: p.category as any,
        unit: p.unit,
        price: p.price,
        cost: p.cost,
        taxPct: p.taxPct,
        description: p.description,
      };
    }

    const config = body.config || currentConfig;
    const recommendations = getRecommendations(quotation, products, config);

    return apiSuccess({
      quotationId: quotation.id,
      count: recommendations.length,
      recommendations,
    });
  } catch (err: any) {
    return apiError("RECOMMENDATIONS_ERROR", err?.message || "Failed to generate recommendations", 500);
  }
}
