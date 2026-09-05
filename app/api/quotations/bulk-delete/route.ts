import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { BulkDeleteQuotationsSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    const body = await req.json().catch(() => ({}));
    const parsed = BulkDeleteQuotationsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid bulk delete request data",
        400
      );
    }

    const result = await quotationApplicationService.deleteMany(parsed.data.ids, actor);
    return apiSuccess(result);
  } catch (err: any) {
    const statusCode = err?.message?.includes("Access denied")
      ? 403
      : err?.message?.includes("Only DRAFT")
      ? 400
      : 500;
    return apiError(
      "QUOTATION_BULK_DELETE_ERROR",
      err?.message || "Failed to bulk delete quotations",
      statusCode
    );
  }
}
