import { subscriptionPlanRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET() {
  try {
    return apiSuccess(await subscriptionPlanRepository.list());
  } catch (err: any) {
    return apiError("PLANS_FETCH_ERROR", err?.message || "Failed to fetch subscription plans", 500);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "plans.manage");

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
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("PLAN_CREATE_ERROR", err?.message || "Failed to create subscription plan", status);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "plans.manage");

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
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("PLAN_UPDATE_ERROR", err?.message || "Failed to update subscription plan", status);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "plans.manage");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("VALIDATION_ERROR", "Plan id is required", 400);
    await subscriptionPlanRepository.delete(id);
    return apiSuccess({ deleted: true, id });
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("PLAN_DELETE_ERROR", err?.message || "Failed to delete subscription plan", status);
  }
}
