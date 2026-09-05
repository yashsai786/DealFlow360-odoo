import { inventoryRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET() {
  try {
    const items = await inventoryRepository.list();
    return apiSuccess(items);
  } catch (err: any) {
    return apiError("INVENTORY_FETCH_ERROR", err?.message || "Failed to fetch inventory", 500);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "inventory.manage");

    const body = await req.json();
    if (!body.warehouseId || !body.productId) {
      return apiError("VALIDATION_ERROR", "warehouseId and productId are required", 400);
    }
    const updated = await inventoryRepository.upsert({
      warehouseId: String(body.warehouseId),
      productId: String(body.productId),
      available: Number(body.available ?? 0),
      reserved: Number(body.reserved ?? 0),
      replenishmentDays: Number(body.replenishmentDays ?? 7),
    });
    return apiSuccess(updated);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("INVENTORY_UPDATE_ERROR", err?.message || "Failed to update inventory", status);
  }
}
