import { governanceRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET() {
  try {
    return apiSuccess(await governanceRepository.load());
  } catch (err: any) {
    return apiError("GOVERNANCE_FETCH_ERROR", err?.message || "Failed to fetch governance config", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "governance.tiers");

    const body = await req.json();
    if (!body.tierCeilings || !body.categoryCeilings) {
      return apiError("VALIDATION_ERROR", "tierCeilings and categoryCeilings are required", 400);
    }
    await governanceRepository.save(body);
    return apiSuccess(body);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("GOVERNANCE_SAVE_ERROR", err?.message || "Failed to save governance config", status);
  }
}
