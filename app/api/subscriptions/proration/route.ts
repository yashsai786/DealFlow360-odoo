import { subscriptionRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { calculateProration } from "@/modules/billing/service";
import type { Subscription, SubscriptionPlan, BillingAdjustment } from "@/modules/shared/types";

import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "billing.manage");

    const body = await req.json();
    const { subscriptionId, newQty, apply } = body;

    if (!newQty || newQty < 1) {
      return apiError("VALIDATION_ERROR", "newQty must be at least 1", 400);
    }

    let sub: Subscription | null = body.subscription || null;
    if (!sub && subscriptionId) {
      sub = await subscriptionRepository.findById(subscriptionId);
    }

    if (!sub) {
      return apiError("NOT_FOUND", "Subscription not found", 404);
    }

    // Load plan
    let plan: SubscriptionPlan | null = body.plan || null;
    if (!plan && sub.planId) {
      const planRow = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
      if (planRow) {
        plan = {
          id: planRow.id,
          name: planRow.name,
          cycle: planRow.cycle as any,
          price: planRow.price,
          prorationEnabled: planRow.prorationEnabled,
          cancellationPolicy: planRow.cancellationPolicy,
        };
      }
    }

    const proration = calculateProration(sub, newQty, sub.unitPrice, plan);

    let updatedSub = sub;
    if (apply && subscriptionId) {
      const adjustment: BillingAdjustment | null =
        proration.kind === "NONE"
          ? null
          : {
              id: `adj-${Date.now()}`,
              kind: proration.kind,
              amount: Math.abs(proration.difference),
              note:
                proration.kind === "CREDIT"
                  ? `Credit Note Issued: Reduced ${Math.abs(newQty - sub.qty)} seats with ${proration.daysRemaining} of ${proration.daysInCycle} days remaining.`
                  : `Prorated Charge: Added ${Math.abs(newQty - sub.qty)} seats with ${proration.daysRemaining} of ${proration.daysInCycle} days remaining.`,
              at: new Date().toISOString(),
            };

      const adjustments = adjustment ? [adjustment, ...sub.adjustments] : sub.adjustments;
      updatedSub = await subscriptionRepository.update(subscriptionId, {
        qty: newQty,
        adjustments,
      });
    }

    return apiSuccess({
      subscriptionId: sub.id,
      oldQty: sub.qty,
      newQty,
      proration,
      applied: Boolean(apply),
      subscription: updatedSub,
    });
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("PRORATION_CALCULATION_ERROR", err?.message || "Failed to calculate proration", status);
  }
}
