import { fulfillmentRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { canConsolidate } from "@/modules/fulfillment/service";
import type { InventoryItem } from "@/modules/shared/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, arrivalWarehouseId, arrivalProductId, arrivalQty } = body;

    let order = body.order || null;
    if (!order && orderId) {
      order = await fulfillmentRepository.findById(orderId);
    }

    if (!order) {
      return apiError("NOT_FOUND", "Fulfillment order not found", 404);
    }

    // Load inventory
    const inventoryRows = await prisma.inventoryItem.findMany();
    const inventory: InventoryItem[] = inventoryRows.map((i) => ({
      warehouseId: i.warehouseId,
      productId: i.productId,
      available: i.available,
      reserved: i.reserved,
      replenishmentDays: i.replenishmentDays,
    }));

    // If new arrival stock was provided, simulate the arrival in inventory
    if (arrivalWarehouseId && arrivalProductId && arrivalQty > 0) {
      const match = inventory.find(
        (i) => i.warehouseId === arrivalWarehouseId && i.productId === arrivalProductId,
      );
      if (match) {
        match.available += arrivalQty;
      } else {
        inventory.push({
          warehouseId: arrivalWarehouseId,
          productId: arrivalProductId,
          available: arrivalQty,
          reserved: 0,
          replenishmentDays: 0,
        });
      }
    }

    const consolidatableBackorders = (order.backorders || []).filter(
      (b: any) => b.status === "OPEN" && canConsolidate(b, inventory),
    );

    const promptAvailable = consolidatableBackorders.length > 0;

    return apiSuccess({
      orderId: order.id,
      promptAvailable,
      promptMessage: promptAvailable
        ? `Stock arrived mid-fulfillment! You can consolidate ${consolidatableBackorders.reduce(
            (sum: number, b: any) => sum + b.qty,
            0,
          )} units of backordered stock immediately.`
        : "No backorders eligible for consolidation at this time.",
      consolidatableBackorders,
    });
  } catch (err: any) {
    return apiError("CONSOLIDATION_CHECK_ERROR", err?.message || "Failed to check backorder consolidation", 500);
  }
}
