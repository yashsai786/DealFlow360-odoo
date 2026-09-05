import { subscriptionRepository } from "@/infrastructure/repositories/prismaRepositories";
import { prisma } from "@/infrastructure/db";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { calculateCancellationRefund } from "@/modules/billing/service";
import type { Subscription, SubscriptionPlan, BillingAdjustment } from "@/modules/shared/types";

import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "billing.manage");

    const body = await req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return apiError("VALIDATION_ERROR", "subscriptionId is required", 400);
    }

    const sub = await subscriptionRepository.findById(subscriptionId);
    if (!sub) {
      return apiError("NOT_FOUND", "Subscription not found", 404);
    }

    // Load plan
    let plan: SubscriptionPlan | null = null;
    if (sub.planId) {
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

    const refund = calculateCancellationRefund(sub, plan);

    let adjustments = sub.adjustments || [];
    let creditNoteIssued = false;

    if (refund.isRefundable) {
      const refundAdj: BillingAdjustment = {
        id: `cn-${Date.now()}`,
        kind: "CREDIT",
        amount: refund.refundAmount,
        note: `Cancellation Credit Note: ₹${refund.refundAmount.toFixed(2)} (${refund.refundRatePct}% of ${refund.daysRemaining} unused days)`,
        at: new Date().toISOString(),
      };
      adjustments = [refundAdj, ...adjustments];
      creditNoteIssued = true;
    }

    const updated = await subscriptionRepository.update(subscriptionId, {
      status: "CANCELLED",
      adjustments,
    });

    return apiSuccess({
      subscriptionId,
      status: "CANCELLED",
      refund,
      creditNoteIssued,
      adjustments: updated.adjustments,
    });
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("CANCELLATION_ERROR", err?.message || "Failed to cancel subscription", status);
  }
}
