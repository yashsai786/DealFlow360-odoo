import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { AddQuotationLineSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const quotationId = context.params.id;
    const body = await req.json().catch(() => ({}));
    const parsed = AddQuotationLineSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid line item data",
        400
      );
    }

    const updated = await quotationApplicationService.addLine(
      quotationId,
      parsed.data as { productId: string; qty: number; unitPrice?: number; discountPct?: number },
      actor
    );
    return apiSuccess(updated, 201);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("LINE_ADD_ERROR", err?.message || "Failed to add line item", status);
  }
}
