import { userRepository } from "../infrastructure/repositories/prismaRepositories";
import type { User, Quotation } from "../modules/shared/types";
import {
  type PermissionAction,
  canPerformAction,
  normalizeRole,
} from "../modules/identity/permissions";

export class AuthorizationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Resolves and authenticates the requesting actor strictly from the SQLite database.
 * The client's role or customer claims are NEVER trusted.
 */
export async function authenticateActor(request: Request): Promise<User> {
  const userId =
    request.headers.get("x-user-id") ||
    request.headers.get("X-User-Id") ||
    request.headers.get("x-actor-id");

  if (!userId) {
    throw new AuthorizationError(
      "Authentication required. No authenticated session found.",
      401,
      "UNAUTHENTICATED"
    );
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthorizationError(
      "Invalid or expired user session.",
      401,
      "UNAUTHENTICATED"
    );
  }

  // Normalize canonical role from SQLite
  return {
    ...user,
    role: normalizeRole(user.role),
  };
}

/**
 * Asserts that the actor possesses the required granular action permission.
 */
export function requirePermission(actor: User, action: PermissionAction): void {
  if (!canPerformAction(actor.role, action)) {
    throw new AuthorizationError(
      `Access denied: Role '${actor.role}' is not authorized to execute '${action}'.`,
      403,
      "FORBIDDEN_ACTION"
    );
  }
}

/**
 * Enforces strict customer data isolation: customers cannot access another customer's data.
 */
export function enforceCustomerIsolation(actor: User, targetCustomerId?: string): void {
  if (actor.role === "CUSTOMER") {
    if (!actor.customerId || (targetCustomerId && actor.customerId !== targetCustomerId)) {
      throw new AuthorizationError(
        "Access denied: Customer data isolation policy strictly forbids accessing other customer accounts.",
        403,
        "CUSTOMER_DATA_ISOLATION_VIOLATION"
      );
    }
  }
}

/**
 * Enforces quotation ownership:
 * - Customers can only view/interact with their own quotations.
 * - Sales Reps can only mutate quotations they own.
 */
export function enforceQuotationOwnership(
  actor: User,
  quotation: Quotation,
  requireEditOwnership = false
): void {
  if (actor.role === "CUSTOMER") {
    if (quotation.customerId !== actor.customerId) {
      throw new AuthorizationError(
        "Access denied: You do not have permission to view or interact with this quotation.",
        403,
        "CUSTOMER_DATA_ISOLATION_VIOLATION"
      );
    }
    return;
  }

  if (actor.role === "SALES_REP") {
    if (requireEditOwnership && quotation.ownerId !== actor.id) {
      throw new AuthorizationError(
        "Access denied: Sales Representatives are restricted to modifying their own assigned quotations.",
        403,
        "OWNERSHIP_RESTRICTION"
      );
    }
  }
}
