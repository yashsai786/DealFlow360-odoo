import { fulfillmentRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    const list = await fulfillmentRepository.list();
    return apiSuccess(list);
  } catch (err: any) {
    return apiError("FULFILLMENT_FETCH_ERROR", err?.message || "Failed to fetch fulfillment orders", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.quotationId) {
      return apiError("VALIDATION_ERROR", "id and quotationId are required", 400);
    }
    const created = await fulfillmentRepository.create(body);
    return apiSuccess(created);
  } catch (err: any) {
    return apiError("FULFILLMENT_CREATE_ERROR", err?.message || "Failed to create fulfillment order", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return apiError("VALIDATION_ERROR", "Fulfillment order id is required", 400);
    }
    const updated = await fulfillmentRepository.update(body.id, body);
    return apiSuccess(updated);
  } catch (err: any) {
    return apiError("FULFILLMENT_UPDATE_ERROR", err?.message || "Failed to update fulfillment order", 500);
  }
}
