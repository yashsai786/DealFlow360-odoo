import { authAppService } from "@/application/authApplicationService";
import { LoginRequestSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const user = await authAppService.login(parsed.data.email);
    if (!user) {
      return apiError("USER_NOT_FOUND", "No account found with this email address.", 404);
    }

    return apiSuccess(user);
  } catch (error: any) {
    return apiError("LOGIN_ERROR", error.message || "Failed to authenticate", 500);
  }
}
