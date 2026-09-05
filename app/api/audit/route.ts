import { auditRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity") || undefined;
    const entityId = url.searchParams.get("entityId") || undefined;
    const actor = url.searchParams.get("actor") || undefined;

    const entries = await auditRepository.list({
      entity,
      entityId,
      actor,
    });
    return apiSuccess(entries);
  } catch (err: any) {
    return apiError("AUDIT_FETCH_ERROR", err?.message || "Failed to fetch audit entries", 500);
  }
}
