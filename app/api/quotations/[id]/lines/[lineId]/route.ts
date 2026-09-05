import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { UpdateQuotationLineSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

interface RouteContext {
  params: {
    id: string;
    lineId: string;
  };
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const { id: quotationId, lineId } = context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateQuotationLineSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid update data",
        400
      );
    }

    const updated = await quotationApplicationService.updateLine(
      quotationId,
      lineId,
      parsed.data,
      actor
    );
    return apiSuccess(updated);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("LINE_UPDATE_ERROR", err?.message || "Failed to update line", status);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const { id: quotationId, lineId } = context.params;

    const updated = await quotationApplicationService.removeLine(quotationId, lineId, actor);
    return apiSuccess(updated);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("LINE_DELETE_ERROR", err?.message || "Failed to remove line", status);
  }
}
