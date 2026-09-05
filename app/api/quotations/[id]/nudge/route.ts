import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { NudgeActionSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

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
    const parsed = NudgeActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid nudge payload",
        400
      );
    }

    const result = await quotationApplicationService.nudge(
      quotationId,
      parsed.data.note,
      actor
    );
    return apiSuccess(result);
  } catch (err: any) {
    const statusCode = err?.message?.includes("not found") ? 404 : 500;
    return apiError("NUDGE_ERROR", err?.message || "Failed to nudge quotation owner", statusCode);
  }
}
