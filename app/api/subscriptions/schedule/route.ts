import { subscriptionRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { calculateBillingSchedule } from "@/modules/billing/service";
import type { Subscription } from "@/modules/shared/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let sub: Subscription | null = body.subscription || null;

    if (!sub && body.subscriptionId) {
      sub = await subscriptionRepository.findById(body.subscriptionId);
    }

    if (!sub) {
      return apiError("NOT_FOUND", "Subscription contract not found", 404);
    }

    const periods = body.periods || 6;
    const schedule = calculateBillingSchedule(sub, periods);

    return apiSuccess({
      subscriptionId: sub.id,
      cycle: sub.cycle,
      qty: sub.qty,
      unitPrice: sub.unitPrice,
      periods,
      schedule,
    });
  } catch (err: any) {
    return apiError("SCHEDULE_CALCULATION_ERROR", err?.message || "Failed to calculate billing schedule", 500);
  }
}
