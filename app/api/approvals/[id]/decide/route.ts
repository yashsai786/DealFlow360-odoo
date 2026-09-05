import { resolveActor } from "@/application/resolveActor";
import { approvalApplicationService } from "@/application/approvalApplicationService";
import { ApprovalDecisionSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const approvalId = context.params.id;
    const body = await req.json().catch(() => ({}));
    const parsed = ApprovalDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid approval decision data",
        400
      );
    }

    const result = await approvalApplicationService.decide(
      approvalId,
      parsed.data.decision,
      parsed.data.reason,
      actor
    );

    return apiSuccess(result);
  } catch (err: any) {
    const statusCode =
      err?.message?.includes("Access denied") || err?.message?.includes("waiting on")
        ? 403
        : err?.message?.includes("not found")
        ? 404
        : 500;
    return apiError(
      "APPROVAL_DECISION_ERROR",
      err?.message || "Failed to submit approval decision",
      statusCode
    );
  }
}
