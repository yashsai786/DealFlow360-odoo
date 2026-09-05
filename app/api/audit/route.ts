import { auditRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    if (actor.role === "CUSTOMER") {
      return apiError("FORBIDDEN", "Access denied: Customers cannot access internal audit trail logs.", 403);
    }

    const url = new URL(req.url);
    const entity = url.searchParams.get("entity") || undefined;
    const entityId = url.searchParams.get("entityId") || undefined;
    const actorFilter = url.searchParams.get("actor") || undefined;

    const entries = await auditRepository.list({
      entity,
      entityId,
      actor: actorFilter,
    });
    return apiSuccess(entries);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("AUDIT_FETCH_ERROR", err?.message || "Failed to fetch audit entries", status);
  }
}
