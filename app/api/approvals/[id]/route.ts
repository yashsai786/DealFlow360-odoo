import { resolveActor } from "@/application/resolveActor";
import { approvalApplicationService } from "@/application/approvalApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const approvalId = context.params.id;

    const approval = await approvalApplicationService.getById(approvalId, actor);
    return apiSuccess(approval);
  } catch (err: any) {
    const statusCode = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("not found")
      ? 404
      : 500;
    return apiError("APPROVAL_FETCH_ERROR", err?.message || "Failed to fetch approval", statusCode);
  }
}
