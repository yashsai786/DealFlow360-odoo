import {
  userRepository,
  customerRepository,
  auditRepository,
  domainEventRepository,
} from "../infrastructure/repositories/prismaRepositories";
import type { User, Role, CustomerTier } from "../modules/shared/types";
import { assertCan, can } from "../modules/identity/service";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../lib/auth/password";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export class AuthApplicationService {
  async getSession(userId?: string): Promise<User | null> {
    if (!userId) {
      const users = await userRepository.list();
      return users[0] ?? null;
    }
    return await userRepository.findById(userId);
  }

  async login(email: string, password?: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      await auditRepository.record({
        id: uid("au"),
        entity: "Session",
        entityId: "unknown",
        actor: normalizedEmail,
        action: "Failed sign-in attempt: account not found",
        at: new Date().toISOString(),
      });
      return null;
    }

    if (!password) {
      await auditRepository.record({
        id: uid("au"),
        entity: "Session",
        entityId: user.id,
        actor: user.name,
        action: "Failed sign-in attempt: missing password",
        at: new Date().toISOString(),
      });
      return null;
    }

    const storedHash = await userRepository.getPasswordHash(normalizedEmail);
    let isValid = false;

    if (storedHash) {
      isValid = await verifyPassword(password, storedHash);
    } else {
      // Legacy user without hash in SQLite: check standard demo fallback password
      if (password === "DealFlow@2026" || password === "password" || password === "password123") {
        isValid = true;
      }
    }

    if (!isValid) {
      await auditRepository.record({
        id: uid("au"),
        entity: "Session",
        entityId: user.id,
        actor: user.name,
        action: "Failed sign-in attempt: incorrect password",
        at: new Date().toISOString(),
      });
      return null;
    }

    await auditRepository.record({
      id: uid("au"),
      entity: "Session",
      entityId: user.id,
      actor: user.name,
      action: "Signed in securely with password verification",
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

  async signup(
    name: string,
    email: string,
    role: Role,
    customerId?: string,
    password?: string,
    newCompany?: { name: string; industry?: string; tier?: CustomerTier }
  ): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new Error("This email / ID is already registered.");
    }

    const pwdToHash = password && password.trim() ? password.trim() : "DealFlow@2026";
    const strength = validatePasswordStrength(pwdToHash);
    if (!strength.valid) {
      throw new Error(strength.reason || "Password does not meet security requirements.");
    }

    const passwordHash = await hashPassword(pwdToHash);

    let assignedCustomerId = customerId;
    if (role === "CUSTOMER" && newCompany && newCompany.name?.trim()) {
      const createdCompany = await customerRepository.create({
        id: uid("c"),
        name: newCompany.name.trim(),
        tier: (newCompany.tier as CustomerTier) || "Bronze",
        industry: newCompany.industry || "General",
        contactEmail: normalizedEmail,
      });
      assignedCustomerId = createdCompany.id;
    }

    const newUser: User = {
      id: uid("u"),
      name: name.trim(),
      email: normalizedEmail,
      role,
      ...(role === "CUSTOMER" && assignedCustomerId ? { customerId: assignedCustomerId } : {}),
    };

    const created = await userRepository.create(newUser, passwordHash);

    await auditRepository.record({
      id: uid("au"),
      entity: "User",
      entityId: created.id,
      actor: created.name,
      action: "Registered account with hashed credentials",
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
