import { warehouseRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET() {
  try {
    return apiSuccess(await warehouseRepository.list());
  } catch (err: any) {
    return apiError("WAREHOUSES_FETCH_ERROR", err?.message || "Failed to fetch warehouses", 500);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "warehouse.manage");

    const body = await req.json();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return apiError("VALIDATION_ERROR", "Warehouse name is required", 400);
    }
    if (!body.location || typeof body.location !== "string" || !body.location.trim()) {
      return apiError("VALIDATION_ERROR", "Warehouse location hub is required", 400);
    }

    const cleanName = body.name.trim();
    const cleanLocation = body.location.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 15);
    const id = body.id || `w-${slug}-${Date.now().toString().slice(-4)}`;
    const shipmentCost = typeof body.shipmentCost === "number" ? Math.max(0, body.shipmentCost) : 150;

    const created = await warehouseRepository.create({
      id,
      name: cleanName,
      location: cleanLocation,
      shipmentCost,
    });
    return apiSuccess(created, 201);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("WAREHOUSE_CREATE_ERROR", err?.message || "Failed to create warehouse", status);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "warehouse.manage");

    const body = await req.json();
    if (!body.id) return apiError("VALIDATION_ERROR", "Warehouse id is required", 400);
    return apiSuccess(await warehouseRepository.update(body));
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("WAREHOUSE_UPDATE_ERROR", err?.message || "Failed to update warehouse", status);
  }
}
