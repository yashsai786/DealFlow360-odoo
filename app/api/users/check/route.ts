import { userRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return apiError("VALIDATION_ERROR", "Email parameter is required", 400);
    }
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return apiSuccess({
        registered: true,
        message: "This email / ID is already registered.",
        user: { id: existing.id, email: existing.email, name: existing.name },
      });
    }
    return apiSuccess({
      registered: false,
      message: "Email is available for registration.",
    });
  } catch (err: any) {
    return apiError("CHECK_ERROR", err?.message || "Failed to check user registration", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || body.id || "").trim().toLowerCase();
    if (!email) {
      return apiError("VALIDATION_ERROR", "Email or ID is required", 400);
    }
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return apiSuccess({
        registered: true,
        message: "This email / ID is already registered.",
        user: { id: existing.id, email: existing.email, name: existing.name },
      });
    }
    return apiSuccess({
      registered: false,
      message: "Email is available for registration.",
    });
  } catch (err: any) {
    return apiError("CHECK_ERROR", err?.message || "Failed to check user registration", 500);
  }
}
