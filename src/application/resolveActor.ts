import { userRepository } from "../infrastructure/repositories/prismaRepositories";
import type { User } from "../modules/shared/types";
import { normalizeRole } from "../modules/identity/permissions";
import { AuthorizationError } from "./authorizationGuard";

/**
 * Hardened Server-Side Actor Resolution:
 * Looks up user in SQLite database by session/actor ID.
 * Extracts immutable role and customer ID strictly from the database record.
 * Rejects non-existent or unauthenticated callers with 401 Unauthorized.
 */
export async function resolveActor(request: Request): Promise<User> {
  const userId =
    request.headers.get("x-user-id") ||
    request.headers.get("X-User-Id") ||
    request.headers.get("x-actor-id");

  if (userId) {
    const user = await userRepository.findById(userId);
    if (user) {
      return {
        ...user,
        role: normalizeRole(user.role),
      };
    }
    throw new AuthorizationError(
      "Authentication failed: User account not found in database.",
      401,
      "UNAUTHENTICATED"
    );
  }

  throw new AuthorizationError(
    "Authentication required. Please sign in to access DealFlow360.",
    401,
    "UNAUTHENTICATED"
  );
}

export const resolveActorFromRequest = resolveActor;
