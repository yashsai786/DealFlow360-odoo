import { productRepository } from "@/infrastructure/repositories/prismaRepositories";
import { CreateProductSchema, UpdateProductSchema } from "@/lib/api/contracts/schemas";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import { resolveActor } from "@/application/resolveActor";
import { requirePermission } from "@/application/authorizationGuard";

export async function GET() {
  try {
    const products = await productRepository.list();
    return apiSuccess(products);
  } catch (err: any) {
    return apiError("PRODUCTS_FETCH_ERROR", err?.message || "Failed to fetch products", 500);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActor(req);
    requirePermission(actor, "product.create");

    const body = await req.json();

    // Upsert: if `id` is present it's an edit, otherwise it's a create
    const isNew = !body.id;
    const schema = isNew ? CreateProductSchema : UpdateProductSchema;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid product data", 400);
    }

    const id = body.id ?? `p-${Math.random().toString(36).slice(2, 8)}`;
    const product = await productRepository.upsert({ id, ...parsed.data } as any);
    return apiSuccess(product, isNew ? 201 : 200);
  } catch (err: any) {
    const status = err?.statusCode || (err?.message?.includes("Access denied") ? 403 : 500);
    return apiError("PRODUCT_SAVE_ERROR", err?.message || "Failed to save product", status);
  }
}
