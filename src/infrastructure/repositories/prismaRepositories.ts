import { prisma } from "../db";
import type {
  IUserRepository,
  IAuditRepository,
  IDomainEventRepository,
} from "./types";
import type {
  User,
  AuditEntry,
  DomainEvent,
  Role,
} from "../../modules/shared/types";

/* ------------------------------------------------ USER REPOSITORY */
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      customerId: row.customerId ?? undefined,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      customerId: row.customerId ?? undefined,
    };
  }

  async list(): Promise<User[]> {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as Role,
      customerId: r.customerId ?? undefined,
    }));
  }

  async create(user: User): Promise<User> {
    const row = await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase().trim(),
        role: user.role,
        customerId: user.customerId ?? null,
      },
    });
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      customerId: row.customerId ?? undefined,
    };
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.email ? { email: patch.email.toLowerCase().trim() } : {}),
        ...(patch.role ? { role: patch.role } : {}),
        ...(patch.customerId !== undefined ? { customerId: patch.customerId ?? null } : {}),
      },
    });
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      customerId: row.customerId ?? undefined,
    };
  }
}

/* ----------------------------------------------- AUDIT REPOSITORY */
export class PrismaAuditRepository implements IAuditRepository {
  async record(entry: AuditEntry): Promise<AuditEntry> {
    const row = await prisma.auditEntry.create({
      data: {
        id: entry.id,
        entity: entry.entity,
        entityId: entry.entityId,
        actor: entry.actor,
        action: entry.action,
        reason: entry.reason ?? null,
        at: entry.at,
      },
    });
    return {
      id: row.id,
      entity: row.entity,
      entityId: row.entityId,
      actor: row.actor,
      action: row.action,
      reason: row.reason ?? undefined,
      at: row.at,
    };
  }

  async list(filter?: { entity?: string; actor?: string }): Promise<AuditEntry[]> {
    const rows = await prisma.auditEntry.findMany({
      where: {
        ...(filter?.entity ? { entity: filter.entity } : {}),
        ...(filter?.actor ? { actor: filter.actor } : {}),
      },
      orderBy: { at: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      actor: r.actor,
      action: r.action,
      reason: r.reason ?? undefined,
      at: r.at,
    }));
  }
}

/* ---------------------------------------- DOMAIN EVENT REPOSITORY */
export class PrismaDomainEventRepository implements IDomainEventRepository {
  async emit(event: DomainEvent): Promise<DomainEvent> {
    const row = await prisma.domainEvent.create({
      data: {
        id: event.id,
        name: event.name,
        payload: event.payload,
        at: event.at,
      },
    });
    return {
      id: row.id,
      name: row.name,
      payload: row.payload,
      at: row.at,
    };
  }

  async list(): Promise<DomainEvent[]> {
    const rows = await prisma.domainEvent.findMany({
      orderBy: { at: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      payload: r.payload,
      at: r.at,
    }));
  }
}

// Export singleton instances for Auth & Identity
export const userRepository = new PrismaUserRepository();
export const auditRepository = new PrismaAuditRepository();
export const domainEventRepository = new PrismaDomainEventRepository();
