import { customerRepository } from "@/infrastructure/repositories/prismaRepositories";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import type { Customer, CustomerTier } from "@/modules/shared/types";

export async function GET() {
  try {
    const customers = await customerRepository.list();
    return apiSuccess(customers);
  } catch (err: any) {
    return apiError("CUSTOMERS_FETCH_ERROR", err?.message || "Failed to fetch customers", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, tier, industry, contactEmail } = body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return apiError("VALIDATION_ERROR", "Customer name is required", 400);
    }

    const customer: Customer = {
      id: body.id || `c-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      tier: (tier as CustomerTier) || "Bronze",
      industry: industry?.trim() || "General",
      contactEmail: contactEmail?.trim() || "",
    };

    const created = await customerRepository.create(customer);
    return apiSuccess(created, undefined, 201);
  } catch (err: any) {
    return apiError("CUSTOMER_CREATE_ERROR", err?.message || "Failed to create customer", 500);
  }
}
