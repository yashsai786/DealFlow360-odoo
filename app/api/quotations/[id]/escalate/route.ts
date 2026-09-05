import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { EscalateActionSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

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
    const parsed = EscalateActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid escalation payload",
        400
      );
    }

    const result = await quotationApplicationService.escalate(
      quotationId,
      parsed.data.reason,
      actor
    );
    return apiSuccess(result);
  } catch (err: any) {
    const statusCode = err?.message?.includes("not found") ? 404 : 500;
    return apiError("ESCALATE_ERROR", err?.message || "Failed to escalate quotation", statusCode);
  }
}
