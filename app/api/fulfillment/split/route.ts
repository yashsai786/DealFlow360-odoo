import { quotationRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { calculateWarehouseSplit } from "@/modules/fulfillment/service";
import type { Product, Warehouse, InventoryItem, Quotation } from "@/modules/shared/types";

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
      };
    }

    // Load warehouses
    const warehouseRows = await prisma.warehouse.findMany();
    const warehouses: Warehouse[] = warehouseRows.map((w) => ({
      id: w.id,
      name: w.name,
      location: w.location,
      shipmentCost: w.shipmentCost,
    }));

    // Load inventory
    const inventoryRows = await prisma.inventoryItem.findMany();
    const inventory: InventoryItem[] = inventoryRows.map((i) => ({
      warehouseId: i.warehouseId,
      productId: i.productId,
      available: i.available,
      reserved: i.reserved,
      replenishmentDays: i.replenishmentDays,
    }));

    const splitPlan = calculateWarehouseSplit(quotation, products, warehouses, inventory);

    return apiSuccess({
      quotationId: quotation.id,
      splitPlan,
      warehouseBreakdown: warehouses.map((w) => {
        const whAllocations = splitPlan.allocations.filter((a) => a.warehouseId === w.id);
        const totalQty = whAllocations.reduce((s, a) => s + a.qty, 0);
        return {
          warehouseId: w.id,
          warehouseName: w.name,
          allocatedQty: totalQty,
          allocations: whAllocations,
          shipmentCost: whAllocations.length > 0 ? w.shipmentCost : 0,
        };
      }),
    });
  } catch (err: any) {
    return apiError("SPLIT_CALCULATION_ERROR", err?.message || "Failed to calculate warehouse split", 500);
  }
}
