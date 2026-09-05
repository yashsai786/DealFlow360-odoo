import { resolveActor } from "@/application/resolveActor";
import { quotationApplicationService } from "@/application/quotationApplicationService";
import { CreateQuotationSchema, apiSuccess, apiError } from "@/lib/api/contracts/schemas";

export async function GET(req: Request) {
  try {
    const actor = await resolveActor(req);
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const stage = url.searchParams.get("stage") || undefined;
    const customerId = url.searchParams.get("customerId") || undefined;

    const quotations = await quotationApplicationService.list(actor, {
      search,
      stage,
      customerId,
    });
    return apiSuccess(quotations);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("QUOTATIONS_FETCH_ERROR", err?.message || "Failed to fetch quotations", status);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateQuotationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid quotation data",
        400
      );
    }

    const quotation = await quotationApplicationService.create(parsed.data.customerId, actor);
    return apiSuccess(quotation, 201);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("QUOTATION_CREATE_ERROR", err?.message || "Failed to create quotation", status);
  }
}
