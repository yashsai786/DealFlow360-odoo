import { prisma } from "../db";
import type {
  IUserRepository,
  IAuditRepository,
  IDomainEventRepository,
  IProductRepository,
} from "./types";
import type {
  User,
  AuditEntry,
  DomainEvent,
  Role,
  Product,
  ProductCategory,
  BillingCycle,
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

/* ------------------------------------------- PRODUCT REPOSITORY */
export class PrismaProductRepository implements IProductRepository {
  private toProduct(row: {
    id: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    cost: number;
    taxPct: number;
    description: string;
    cycle: string | null;
  }): Product {
    return {
      id: row.id,
      name: row.name,
      category: row.category as ProductCategory,
      unit: row.unit,
      price: row.price,
      cost: row.cost,
      taxPct: row.taxPct,
      description: row.description,
      cycle: row.cycle ? (row.cycle as BillingCycle) : undefined,
    };
  }

  async list(): Promise<Product[]> {
    const rows = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toProduct(r));
  }

  async upsert(product: Product): Promise<Product> {
    const data = {
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      cost: product.cost,
      taxPct: product.taxPct,
      description: product.description,
      cycle: product.cycle ?? null,
    };
    const row = await prisma.product.upsert({
      where: { id: product.id },
      update: data,
      create: { id: product.id, ...data },
    });
    return this.toProduct(row);
  }
}

export const productRepository = new PrismaProductRepository();
