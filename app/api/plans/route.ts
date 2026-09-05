import { subscriptionPlanRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    return apiSuccess(await subscriptionPlanRepository.list());
  } catch (err: any) {
    return apiError("PLANS_FETCH_ERROR", err?.message || "Failed to fetch subscription plans", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.name || !body.cycle) {
      return apiError("VALIDATION_ERROR", "id, name, and cycle are required", 400);
    }
    const created = await subscriptionPlanRepository.create({
      id: String(body.id),
      name: String(body.name),
      cycle: body.cycle,
      price: Number(body.price ?? 0),
      prorationEnabled: Boolean(body.prorationEnabled ?? true),
      cancellationPolicy: String(body.cancellationPolicy ?? "Standard cancellation policy"),
    });
    return apiSuccess(created);
  } catch (err: any) {
    return apiError("PLAN_CREATE_ERROR", err?.message || "Failed to create subscription plan", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return apiError("VALIDATION_ERROR", "Plan id is required", 400);
    const updated = await subscriptionPlanRepository.update({
      id: String(body.id),
      name: String(body.name),
      cycle: body.cycle,
      price: Number(body.price ?? 0),
      prorationEnabled: Boolean(body.prorationEnabled ?? true),
      cancellationPolicy: String(body.cancellationPolicy ?? ""),
    });
    return apiSuccess(updated);
  } catch (err: any) {
    return apiError("PLAN_UPDATE_ERROR", err?.message || "Failed to update subscription plan", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return apiError("VALIDATION_ERROR", "Plan id is required", 400);
    await subscriptionPlanRepository.delete(id);
    return apiSuccess({ deleted: true, id });
  } catch (err: any) {
    return apiError("PLAN_DELETE_ERROR", err?.message || "Failed to delete subscription plan", 500);
  }
}
