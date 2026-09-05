import { quotationRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { quotationId, productId } = body;

    if (!quotationId || !productId) {
      return apiError("VALIDATION_ERROR", "quotationId and productId are required", 400);
    }

    const quotation = await quotationRepository.findById(quotationId);
    if (!quotation) {
      return apiError("NOT_FOUND", "Quotation not found", 404);
    }

    const currentDismissed = quotation.dismissedRecommendations || [];
    if (!currentDismissed.includes(productId)) {
      const updatedDismissed = [...currentDismissed, productId];
      await quotationRepository.update(quotationId, {
        dismissedRecommendations: updatedDismissed,
      });
      return apiSuccess({
        quotationId,
        dismissedProductId: productId,
        dismissedRecommendations: updatedDismissed,
        success: true,
      });
    }

    return apiSuccess({
      quotationId,
      dismissedProductId: productId,
      dismissedRecommendations: currentDismissed,
      success: true,
    });
  } catch (err: any) {
    return apiError("DISMISS_RECOMMENDATION_ERROR", err?.message || "Failed to dismiss recommendation", 500);
  }
}
