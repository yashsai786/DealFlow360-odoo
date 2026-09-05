import { subscriptionPlanRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    return apiSuccess(await subscriptionPlanRepository.list());
  } catch (err: any) {
    return apiError("PLANS_FETCH_ERROR", err?.message || "Failed to fetch subscription plans", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return apiError("VALIDATION_ERROR", "Plan id is required", 400);
    return apiSuccess(await subscriptionPlanRepository.update(body));
  } catch (err: any) {
    return apiError("PLAN_UPDATE_ERROR", err?.message || "Failed to update subscription plan", 500);
  }
}
