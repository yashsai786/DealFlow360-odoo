import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { UpdateQuotationSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import type { Quotation } from "@/modules/shared/types";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const quotationId = context.params.id;

    const quotation = await quotationApplicationService.getById(quotationId, actor);
    return apiSuccess(quotation);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("QUOTATION_FETCH_ERROR", err?.message || "Failed to fetch quotation", status);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const quotationId = context.params.id;
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateQuotationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid update data",
        400
      );
    }

    const updated = await quotationApplicationService.update(
      quotationId,
      parsed.data as Partial<Quotation>,
      actor
    );
    return apiSuccess(updated);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("QUOTATION_UPDATE_ERROR", err?.message || "Failed to update quotation", status);
  }
}
