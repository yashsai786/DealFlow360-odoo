import { warehouseRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    return apiSuccess(await warehouseRepository.list());
  } catch (err: any) {
    return apiError("WAREHOUSES_FETCH_ERROR", err?.message || "Failed to fetch warehouses", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return apiError("VALIDATION_ERROR", "Warehouse id is required", 400);
    return apiSuccess(await warehouseRepository.update(body));
  } catch (err: any) {
    return apiError("WAREHOUSE_UPDATE_ERROR", err?.message || "Failed to update warehouse", 500);
  }
}
