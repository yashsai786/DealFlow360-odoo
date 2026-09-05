import { authAppService } from "@/application/authApplicationService";
import { resolveActor } from "@/application/resolveActor";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(request: Request) {
  try {
    const actor = await resolveActor(request);
    const session = await authAppService.getSession(actor.id);
    return apiSuccess(session);
  } catch (error: any) {
    return apiError("SESSION_ERROR", error.message || "Failed to retrieve session", 500);
  }
}
