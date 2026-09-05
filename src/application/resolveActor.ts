import { userRepository } from "../infrastructure/repositories/prismaRepositories";
import type { User } from "../modules/shared/types";

export async function resolveActor(request: Request): Promise<User> {
  const userId = request.headers.get("x-user-id");
  if (userId) {
    const user = await userRepository.findById(userId);
    if (user) return user;
  }

  // Fallback to primary active persona if header not explicitly passed
  const users = await userRepository.list();
  if (users.length > 0 && users[0]) return users[0];

  return {
    id: "system",
    name: "System Administrator",
    email: "admin@dealflow360.io",
    role: "ADMIN",
  };
}

export const resolveActorFromRequest = resolveActor;
