import { subscriptionRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    const list = await subscriptionRepository.list();
    return apiSuccess(list);
  } catch (err: any) {
    return apiError("SUBSCRIPTIONS_FETCH_ERROR", err?.message || "Failed to fetch subscriptions", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.customerId || !body.planId) {
      return apiError("VALIDATION_ERROR", "id, customerId, and planId are required", 400);
    }
    const created = await subscriptionRepository.create(body);
    return apiSuccess(created);
  } catch (err: any) {
    return apiError("SUBSCRIPTION_CREATE_ERROR", err?.message || "Failed to create subscription", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return apiError("VALIDATION_ERROR", "Subscription id is required", 400);
    }
    const updated = await subscriptionRepository.update(body.id, body);
    return apiSuccess(updated);
  } catch (err: any) {
    return apiError("SUBSCRIPTION_UPDATE_ERROR", err?.message || "Failed to update subscription", 500);
  }
}
