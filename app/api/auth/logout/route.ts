import { apiSuccess } from "@/lib/api/contracts/schemas";

export async function POST(_request: Request) {
  return apiSuccess({ message: "Successfully signed out" });
}
