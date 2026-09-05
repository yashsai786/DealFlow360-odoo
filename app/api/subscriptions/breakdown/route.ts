import { quotationRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { classifyOrderLines } from "@/modules/billing/service";
import type { Product, Quotation } from "@/modules/shared/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let quotation: Quotation | null = body.quotation || null;

    if (!quotation && body.quotationId) {
      quotation = await quotationRepository.findById(body.quotationId);
    }

    if (!quotation) {
      return apiError("NOT_FOUND", "Quotation/Order not found", 404);
    }

    // Load products
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
        cycle: (p as any).cycle || (p.category === "Subscriptions" ? "Monthly" : undefined),
      };
    }

    const classification = classifyOrderLines(quotation, products);
    return apiSuccess(classification);
  } catch (err: any) {
    return apiError("BREAKDOWN_ERROR", err?.message || "Failed to classify order lines", 500);
  }
}
