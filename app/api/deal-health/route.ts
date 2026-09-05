import { resolveActor } from "@/application/resolveActor";
import {
  quotationRepository,
  productRepository,
  customerRepository,
  userRepository,
  fulfillmentRepository,
  approvalRepository,
} from "@/infrastructure/repositories/prismaRepositories";
import { calculateDealHealth, repDiscountAverages } from "@/modules/deal-intelligence/service";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    const { searchParams } = new URL(req.url);
    const stallDaysParam = searchParams.get("stallDays");
    const stallDaysThreshold = stallDaysParam ? parseInt(stallDaysParam, 10) || 7 : 7;

    const [quotations, productsList, customersList, usersList, orders, approvals] = await Promise.all([
      quotationRepository.list(),
      productRepository.list(),
      customerRepository.list(),
      userRepository.list(),
      fulfillmentRepository.list(),
      approvalRepository.list(),
    ]);

    const products = Object.fromEntries(productsList.map((p) => [p.id, p]));
    const customers = Object.fromEntries(customersList.map((c) => [c.id, c]));
    const users = Object.fromEntries(usersList.map((u) => [u.id, u]));

    const alerts = calculateDealHealth({
      quotations,
      products,
      customers,
      users,
      orders,
      approvals,
      stallDaysThreshold,
    });

    const repBaselines = repDiscountAverages(quotations, products);

    const criticalCount = alerts.filter((a) => a.severity === "Critical").length;
    const atRiskCount = alerts.filter((a) => a.severity === "At Risk").length;
    const watchCount = alerts.filter((a) => a.severity === "Watch").length;
    const healthyCount = Math.max(0, quotations.length - alerts.length);

    return apiSuccess({
      stallDaysThreshold,
      summary: {
        criticalCount,
        atRiskCount,
        watchCount,
        healthyCount,
        totalQuotations: quotations.length,
        totalAlerts: alerts.length,
      },
      alerts,
      repBaselines,
    });
  } catch (err: any) {
    return apiError("DEAL_HEALTH_ERROR", err?.message || "Failed to calculate deal health", 500);
  }
}
