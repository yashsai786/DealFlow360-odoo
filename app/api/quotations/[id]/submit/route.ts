import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const quotationId = context.params.id;

    const result = await quotationApplicationService.submitForApproval(quotationId, actor);
    return apiSuccess(result);
  } catch (err: any) {
    const status = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : err?.message?.includes("Add at least one")
      ? 400
      : 500;
    return apiError("QUOTATION_SUBMIT_ERROR", err?.message || "Failed to submit quotation", status);
  }
}
