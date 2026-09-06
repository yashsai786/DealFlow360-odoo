import { resolveActor } from "@/application/resolveActor";
import { approvalApplicationService } from "@/application/approvalApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const quotationId = url.searchParams.get("quotationId") || undefined;

    const approvals = await approvalApplicationService.list(actor, {
      status,
      quotationId,
    });
    return apiSuccess(approvals);
  } catch (err: any) {
    const statusCode = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("APPROVALS_FETCH_ERROR", err?.message || "Failed to fetch approvals", statusCode);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    const body = await req.json().catch(() => ({}));
    if (!body?.quotationId) {
      return apiError("VALIDATION_ERROR", "Quotation ID is required to create approval", 400);
    }
    const created = await approvalApplicationService.create(body, actor);
    return apiSuccess(created, 201);
  } catch (err: any) {
    const statusCode = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("APPROVAL_CREATE_ERROR", err?.message || "Failed to create approval", statusCode);
  }
}

