import { authAppService } from "@/application/authApplicationService";
import { SignupRequestSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SignupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const user = await authAppService.signup(
      parsed.data.name,
      parsed.data.email,
      parsed.data.role,
      parsed.data.customerId,
      parsed.data.password,
      parsed.data.newCompany as any
    );

    return apiSuccess(user, undefined, 201);
  } catch (error: any) {
    return apiError("SIGNUP_ERROR", error.message || "Failed to create account", 400);
  }
}
