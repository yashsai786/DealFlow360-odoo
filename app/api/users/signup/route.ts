import { authAppService } from "@/application/authApplicationService";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, role, customerId, password, newCompany } = body || {};
    if (!name || !email) {
      return apiError("VALIDATION_ERROR", "Name and email are required", 400);
    }
    const user = await authAppService.signup(name, email, role || "SALES_REP", customerId, password, newCompany);
    return apiSuccess(user, undefined, 201);
  } catch (err: any) {
    const isRegistered = err?.message?.toLowerCase().includes("already");
    const code = isRegistered ? "ALREADY_REGISTERED" : "SIGNUP_ERROR";
    const msg = isRegistered ? "This email / ID is already registered." : (err?.message || "Failed to sign up");
    return apiError(code, msg, isRegistered ? 409 : 400);
  }
}
