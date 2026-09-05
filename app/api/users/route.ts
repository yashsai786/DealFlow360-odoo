import { authAppService } from "@/application/authApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    const users = await authAppService.listUsers();
    return apiSuccess(users);
  } catch (err: any) {
    return apiError("USERS_FETCH_ERROR", err?.message || "Failed to fetch users", 500);
  }
}
