import { authAppService } from "@/application/authApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email } = body || {};
    if (!id) {
      return apiError("VALIDATION_ERROR", "User ID is required", 400);
    }
    const updated = await authAppService.updateProfile(id, { name, email });
    return apiSuccess(updated);
  } catch (err: any) {
    return apiError("PROFILE_UPDATE_ERROR", err?.message || "Failed to update profile", 500);
  }
}
