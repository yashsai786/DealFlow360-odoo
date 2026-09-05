import { fulfillmentRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (actor.role === "CUSTOMER") {
      return apiError("FORBIDDEN", "Access denied: Customers cannot access internal fulfillment orders", 403);
    }

    const list = await fulfillmentRepository.list();
    return apiSuccess(list);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("FULFILLMENT_FETCH_ERROR", err?.message || "Failed to fetch fulfillment orders", status);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "fulfillment.manage");

    const body = await req.json();
    if (!body.id || !body.quotationId) {
      return apiError("VALIDATION_ERROR", "id and quotationId are required", 400);
    }
    const created = await fulfillmentRepository.create(body);
    return apiSuccess(created);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("FULFILLMENT_CREATE_ERROR", err?.message || "Failed to create fulfillment order", status);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "fulfillment.manage");

    const body = await req.json();
    if (!body.id) {
      return apiError("VALIDATION_ERROR", "Fulfillment order id is required", 400);
    }
    const updated = await fulfillmentRepository.update(body.id, body);
    return apiSuccess(updated);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("FULFILLMENT_UPDATE_ERROR", err?.message || "Failed to update fulfillment order", status);
  }
}
