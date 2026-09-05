import {
  userRepository,
  auditRepository,
  domainEventRepository,
} from "../infrastructure/repositories/prismaRepositories";
import type { User, Role } from "../modules/shared/types";
import { assertCan, can } from "../modules/identity/service";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export class AuthApplicationService {
  async getSession(userId?: string): Promise<User | null> {
    if (!userId) {
      const users = await userRepository.list();
      return users[0] ?? null;
    }
    return await userRepository.findById(userId);
  }

  async login(email: string): Promise<User | null> {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;

    await auditRepository.record({
      id: uid("au"),
      entity: "Session",
      entityId: user.id,
      actor: user.name,
      action: "Signed in",
      at: new Date().toISOString(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "UserSignedIn",
      payload: `${user.name} (${user.role})`,
      at: new Date().toISOString(),
    });

    return user;
  }

  async signup(name: string, email: string, role: Role, customerId?: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new Error("This email / ID is already registered.");
    }

    const newUser: User = {
      id: uid("u"),
      name: name.trim(),
      email: normalizedEmail,
      role,
      ...(role === "CUSTOMER" && customerId ? { customerId } : {}),
    };

    const created = await userRepository.create(newUser);

    await auditRepository.record({
      id: uid("au"),
      entity: "User",
      entityId: created.id,
      actor: created.name,
      action: "Registered account",
      at: new Date().toISOString(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "UserRegistered",
      payload: `${created.name} as ${created.role}`,
      at: new Date().toISOString(),
    });

    return created;
  }

  async updateProfile(userId: string, updates: { name?: string; email?: string }): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error("User not found");

    const updated = await userRepository.update(userId, updates);

    await auditRepository.record({
      id: uid("au"),
      entity: "User",
      entityId: userId,
      actor: updated.name,
      action: "Updated profile details",
      at: new Date().toISOString(),
    });

    return updated;
  }

  async listUsers(): Promise<User[]> {
    return await userRepository.list();
  }
}

export const authAppService = new AuthApplicationService();
