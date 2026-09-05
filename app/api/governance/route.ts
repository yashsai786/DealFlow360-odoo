import { governanceRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET() {
  try {
    return apiSuccess(await governanceRepository.load());
  } catch (err: any) {
    return apiError("GOVERNANCE_FETCH_ERROR", err?.message || "Failed to fetch governance config", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body.tierCeilings || !body.categoryCeilings) {
      return apiError("VALIDATION_ERROR", "tierCeilings and categoryCeilings are required", 400);
    }
    await governanceRepository.save(body);
    return apiSuccess(body);
  } catch (err: any) {
    return apiError("GOVERNANCE_SAVE_ERROR", err?.message || "Failed to save governance config", 500);
  }
}
