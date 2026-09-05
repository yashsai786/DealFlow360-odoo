import { prisma } from "../db";
import type {
  IUserRepository,
  IAuditRepository,
  IDomainEventRepository,
  IProductRepository,
  IWarehouseRepository,
  IInventoryRepository,
  ISubscriptionPlanRepository,
  ISubscriptionRepository,
  IGovernanceRepository,
  IQuotationRepository,
  ICustomerRepository,
  IApprovalRepository,
  IInvoiceRepository,
  IFulfillmentRepository,
} from "./types";
import type {
  User,
  AuditEntry,
  DomainEvent,
  Role,
  Product,
  ProductCategory,
  BillingCycle,
  Warehouse,
  InventoryItem,
  SubscriptionPlan,
  Subscription,
  BillingAdjustment,
  Quotation,
  QuotationLine,
  QuotationStage,
  NegotiationMessage,
  NegotiationRequest,
  Customer,
  CustomerTier,
  Approval,
  ApprovalStep,
  ApprovalStepStatus,
  RiskLevel,
  Invoice,
  FulfillmentOrder,
} from "../../modules/shared/types";
import {
  DEFAULT_CONFIG,
  type GovernanceConfig,
} from "../../modules/discount-governance/service";

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

  async getPasswordHash(email: string): Promise<string | null> {
    const row = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { passwordHash: true },
    });
    return row?.passwordHash ?? null;
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

  async create(user: User, passwordHash?: string): Promise<User> {
    const row = await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase().trim(),
        role: user.role,
        passwordHash: passwordHash ?? null,
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
        createdAt: new Date(entry.at),
      },
    });
    return {
      id: row.id,
      entity: row.entity,
      entityId: row.entityId,
      actor: row.actor,
      action: row.action,
      reason: row.reason ?? undefined,
      at: row.createdAt.toISOString(),
    };
  }

  async list(filter?: { entity?: string; entityId?: string; actor?: string }): Promise<AuditEntry[]> {
    const rows = await prisma.auditEntry.findMany({
      where: {
        ...(filter?.entity ? { entity: filter.entity } : {}),
        ...(filter?.entityId ? { entityId: filter.entityId } : {}),
        ...(filter?.actor ? { actor: filter.actor } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      actor: r.actor,
      action: r.action,
      reason: r.reason ?? undefined,
      at: r.createdAt.toISOString(),
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
        createdAt: new Date(event.at),
      },
    });
    return {
      id: row.id,
      name: row.name,
      payload: row.payload,
      at: row.createdAt.toISOString(),
    };
  }

  async list(): Promise<DomainEvent[]> {
    const rows = await prisma.domainEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      payload: r.payload,
      at: r.createdAt.toISOString(),
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

/* ------------------------------------------ WAREHOUSE REPOSITORY */
export class PrismaWarehouseRepository implements IWarehouseRepository {
  async list(): Promise<Warehouse[]> {
    const rows = await prisma.warehouse.findMany();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      shipmentCost: r.shipmentCost,
    }));
  }

  async update(warehouse: Warehouse): Promise<Warehouse> {
    const row = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        name: warehouse.name,
        location: warehouse.location,
        shipmentCost: warehouse.shipmentCost,
      },
    });
    return { id: row.id, name: row.name, location: row.location, shipmentCost: row.shipmentCost };
  }
}

/* ------------------------------------- SUBSCRIPTION PLAN REPOSITORY */
export class PrismaSubscriptionPlanRepository implements ISubscriptionPlanRepository {
  async list(): Promise<SubscriptionPlan[]> {
    const rows = await prisma.subscriptionPlan.findMany();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      cycle: r.cycle as BillingCycle,
      price: r.price,
      prorationEnabled: r.prorationEnabled,
      cancellationPolicy: r.cancellationPolicy,
    }));
  }

  async create(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    const row = await prisma.subscriptionPlan.create({
      data: {
        id: plan.id,
        name: plan.name,
        cycle: plan.cycle,
        price: plan.price,
        prorationEnabled: plan.prorationEnabled,
        cancellationPolicy: plan.cancellationPolicy,
      },
    });
    return {
      id: row.id,
      name: row.name,
      cycle: row.cycle as BillingCycle,
      price: row.price,
      prorationEnabled: row.prorationEnabled,
      cancellationPolicy: row.cancellationPolicy,
    };
  }

  async update(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    const row = await prisma.subscriptionPlan.update({
      where: { id: plan.id },
      data: {
        name: plan.name,
        cycle: plan.cycle,
        price: plan.price,
        prorationEnabled: plan.prorationEnabled,
        cancellationPolicy: plan.cancellationPolicy,
      },
    });
    return {
      id: row.id,
      name: row.name,
      cycle: row.cycle as BillingCycle,
      price: row.price,
      prorationEnabled: row.prorationEnabled,
      cancellationPolicy: row.cancellationPolicy,
    };
  }

  async delete(id: string): Promise<void> {
    await prisma.subscriptionPlan.delete({ where: { id } });
  }
}

/* --------------------------------------- GOVERNANCE REPOSITORY */
export class PrismaGovernanceRepository implements IGovernanceRepository {
  async load(): Promise<GovernanceConfig> {
    const row = await prisma.governanceConfig.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_CONFIG;
    return JSON.parse(row.config) as GovernanceConfig;
  }

  async save(config: GovernanceConfig): Promise<void> {
    await prisma.governanceConfig.upsert({
      where: { id: "default" },
      update: { config: JSON.stringify(config) },
      create: { id: "default", config: JSON.stringify(config) },
    });
  }
}

/* ------------------------------------------ INVENTORY REPOSITORY */
export class PrismaInventoryRepository implements IInventoryRepository {
  async list(): Promise<InventoryItem[]> {
    const rows = await prisma.inventoryItem.findMany();
    return rows.map((r) => ({
      warehouseId: r.warehouseId,
      productId: r.productId,
      available: r.available,
      reserved: r.reserved,
      replenishmentDays: r.replenishmentDays,
    }));
  }

  async upsert(item: InventoryItem): Promise<InventoryItem> {
    const id = `${item.warehouseId}_${item.productId}`;
    const row = await prisma.inventoryItem.upsert({
      where: { id },
      update: {
        available: Math.max(0, item.available),
        reserved: Math.max(0, item.reserved ?? 0),
        replenishmentDays: Math.max(0, item.replenishmentDays ?? 7),
      },
      create: {
        id,
        warehouseId: item.warehouseId,
        productId: item.productId,
        available: Math.max(0, item.available),
        reserved: Math.max(0, item.reserved ?? 0),
        replenishmentDays: Math.max(0, item.replenishmentDays ?? 7),
      },
    });
    return {
      warehouseId: row.warehouseId,
      productId: row.productId,
      available: row.available,
      reserved: row.reserved,
      replenishmentDays: row.replenishmentDays,
    };
  }
}

export const warehouseRepository = new PrismaWarehouseRepository();
export const inventoryRepository = new PrismaInventoryRepository();
export const subscriptionPlanRepository = new PrismaSubscriptionPlanRepository();
export const governanceRepository = new PrismaGovernanceRepository();

/* ------------------------------------- SUBSCRIPTION REPOSITORY */
export class PrismaSubscriptionRepository implements ISubscriptionRepository {
  private toSubscription(row: {
    id: string;
    customerId: string;
    quotationId: string;
    planId: string;
    qty: number;
    unitPrice: number;
    cycle: string;
    startDate: string;
    nextBillDate: string;
    status: string;
    adjustments: string;
  }): Subscription {
    let adjustments: BillingAdjustment[] = [];
    try {
      adjustments = JSON.parse(row.adjustments || "[]");
    } catch {
      adjustments = [];
    }
    return {
      id: row.id,
      customerId: row.customerId,
      quotationId: row.quotationId,
      planId: row.planId,
      qty: row.qty,
      unitPrice: row.unitPrice,
      cycle: row.cycle as BillingCycle,
      startDate: row.startDate,
      nextBillDate: row.nextBillDate,
      status: row.status as any,
      adjustments,
    };
  }

  async list(): Promise<Subscription[]> {
    const rows = await prisma.subscription.findMany();
    return rows.map((r) => this.toSubscription(r));
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await prisma.subscription.findUnique({ where: { id } });
    if (!row) return null;
    return this.toSubscription(row);
  }

  async create(sub: Subscription): Promise<Subscription> {
    const row = await prisma.subscription.create({
      data: {
        id: sub.id,
        customerId: sub.customerId,
        quotationId: sub.quotationId,
        planId: sub.planId,
        qty: sub.qty,
        unitPrice: sub.unitPrice,
        cycle: sub.cycle,
        startDate: sub.startDate,
        nextBillDate: sub.nextBillDate,
        status: sub.status,
        adjustments: JSON.stringify(sub.adjustments || []),
      },
    });
    return this.toSubscription(row);
  }

  async update(id: string, patch: Partial<Subscription>): Promise<Subscription> {
    const data: any = {};
    if (patch.qty !== undefined) data.qty = patch.qty;
    if (patch.unitPrice !== undefined) data.unitPrice = patch.unitPrice;
    if (patch.planId !== undefined) data.planId = patch.planId;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.nextBillDate !== undefined) data.nextBillDate = patch.nextBillDate;
    if (patch.adjustments !== undefined) data.adjustments = JSON.stringify(patch.adjustments);

    const row = await prisma.subscription.update({
      where: { id },
      data,
    });
    return this.toSubscription(row);
  }
}

export const subscriptionRepository = new PrismaSubscriptionRepository();

/* -------------------------------------- QUOTATION REPOSITORY */
export class PrismaQuotationRepository implements IQuotationRepository {
  private toQuotation(row: {
    id: string;
    number: string;
    customerId: string;
    ownerId: string;
    stage: string;
    lines: string;
    messages: string;
    requests: string;
    dismissedRecommendations: string;
    requestedDeliveryDate: string | null;
    promisedDeliveryDate: string | null;
    nudgedAt: string | null;
    escalated: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Quotation {
    let lines: QuotationLine[] = [];
    let messages: NegotiationMessage[] = [];
    let requests: NegotiationRequest[] = [];
    let dismissedRecommendations: string[] = [];

    try {
      lines = JSON.parse(row.lines || "[]");
    } catch {
      lines = [];
    }
    try {
      messages = JSON.parse(row.messages || "[]");
    } catch {
      messages = [];
    }
    try {
      requests = JSON.parse(row.requests || "[]");
    } catch {
      requests = [];
    }
    try {
      dismissedRecommendations = JSON.parse(row.dismissedRecommendations || "[]");
    } catch {
      dismissedRecommendations = [];
    }

    return {
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      ownerId: row.ownerId,
      stage: row.stage as QuotationStage,
      lines,
      messages,
      requests,
      dismissedRecommendations,
      requestedDeliveryDate: row.requestedDeliveryDate ?? undefined,
      promisedDeliveryDate: row.promisedDeliveryDate ?? undefined,
      nudgedAt: row.nudgedAt ?? undefined,
      escalated: Boolean(row.escalated),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(filter?: { customerId?: string; ownerId?: string; stage?: string; search?: string }): Promise<Quotation[]> {
    const where: any = {};
    if (filter?.customerId) {
      where.customerId = filter.customerId;
    }
    if (filter?.ownerId) {
      where.ownerId = filter.ownerId;
    }
    if (filter?.stage && filter.stage !== "all") {
      where.stage = filter.stage;
    }
    if (filter?.search) {
      where.OR = [
        { number: { contains: filter.search } },
      ];
    }

    const rows = await prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toQuotation(r));
  }

  async findById(id: string): Promise<Quotation | null> {
    const row = await prisma.quotation.findUnique({ where: { id } });
    if (!row) return null;
    return this.toQuotation(row);
  }

  async findByNumber(number: string): Promise<Quotation | null> {
    const row = await prisma.quotation.findUnique({ where: { number } });
    if (!row) return null;
    return this.toQuotation(row);
  }

  async create(quotation: Quotation): Promise<Quotation> {
    const row = await prisma.quotation.create({
      data: {
        id: quotation.id,
        number: quotation.number,
        customerId: quotation.customerId,
        ownerId: quotation.ownerId,
        stage: quotation.stage,
        lines: JSON.stringify(quotation.lines || []),
        messages: JSON.stringify(quotation.messages || []),
        requests: JSON.stringify(quotation.requests || []),
        dismissedRecommendations: JSON.stringify(quotation.dismissedRecommendations || []),
        requestedDeliveryDate: quotation.requestedDeliveryDate ?? null,
        promisedDeliveryDate: quotation.promisedDeliveryDate ?? null,
        nudgedAt: quotation.nudgedAt ?? null,
        escalated: Boolean(quotation.escalated),
      },
    });
    return this.toQuotation(row);
  }

  async update(id: string, patch: Partial<Quotation>): Promise<Quotation> {
    const data: any = {};
    if (patch.stage !== undefined) data.stage = patch.stage;
    if (patch.lines !== undefined) data.lines = JSON.stringify(patch.lines);
    if (patch.messages !== undefined) data.messages = JSON.stringify(patch.messages);
    if (patch.requests !== undefined) data.requests = JSON.stringify(patch.requests);
    if (patch.dismissedRecommendations !== undefined)
      data.dismissedRecommendations = JSON.stringify(patch.dismissedRecommendations);
    if (patch.requestedDeliveryDate !== undefined)
      data.requestedDeliveryDate = patch.requestedDeliveryDate ?? null;
    if (patch.promisedDeliveryDate !== undefined)
      data.promisedDeliveryDate = patch.promisedDeliveryDate ?? null;
    if (patch.nudgedAt !== undefined) data.nudgedAt = patch.nudgedAt ?? null;
    if (patch.escalated !== undefined) data.escalated = Boolean(patch.escalated);

    const row = await prisma.quotation.update({
      where: { id },
      data,
    });
    return this.toQuotation(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.approval.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.delete({ where: { id } });
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    await prisma.approval.deleteMany({ where: { quotationId: { in: ids } } });
    const result = await prisma.quotation.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }

  async getNextSequence(): Promise<number> {
    const rows = await prisma.quotation.findMany({ select: { number: true } });
    let maxSeq = 1040;
    for (const r of rows) {
      const match = r.number.match(/Q-(\d+)/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val > maxSeq) maxSeq = val;
      }
    }
    return maxSeq + 1;
  }
}

/* --------------------------------------- CUSTOMER REPOSITORY */
export class PrismaCustomerRepository implements ICustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      tier: row.tier as CustomerTier,
      industry: row.industry,
      contactEmail: row.contactEmail,
    };
  }

  async list(): Promise<Customer[]> {
    const rows = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier as CustomerTier,
      industry: r.industry,
      contactEmail: r.contactEmail,
    }));
  }
}

/* --------------------------------------- APPROVAL REPOSITORY */
export class PrismaApprovalRepository implements IApprovalRepository {
  private toApproval(row: {
    id: string;
    quotationId: string;
    status: string;
    steps: string;
    riskLevel: string;
    submittedBy: string;
    submittedAt: Date;
  }): Approval {
    let steps: ApprovalStep[] = [];
    try {
      steps = JSON.parse(row.steps || "[]");
    } catch {
      steps = [];
    }
    return {
      id: row.id,
      quotationId: row.quotationId,
      status: row.status as ApprovalStepStatus,
      steps,
      riskLevel: row.riskLevel as RiskLevel,
      submittedBy: row.submittedBy,
      submittedAt: row.submittedAt.toISOString(),
    };
  }

  async findById(id: string): Promise<Approval | null> {
    const row = await prisma.approval.findUnique({ where: { id } });
    if (!row) return null;
    return this.toApproval(row);
  }

  async findByQuotationId(quotationId: string): Promise<Approval | null> {
    const row = await prisma.approval.findFirst({
      where: { quotationId },
      orderBy: { submittedAt: "desc" },
    });
    if (!row) return null;
    return this.toApproval(row);
  }

  async create(approval: Approval): Promise<Approval> {
    const row = await prisma.approval.create({
      data: {
        id: approval.id,
        quotationId: approval.quotationId,
        status: approval.status,
        steps: JSON.stringify(approval.steps || []),
        riskLevel: approval.riskLevel,
        submittedBy: approval.submittedBy,
      },
    });
    return this.toApproval(row);
  }

  async update(id: string, patch: Partial<Approval>): Promise<Approval> {
    const data: any = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.steps !== undefined) data.steps = JSON.stringify(patch.steps);
    if (patch.riskLevel !== undefined) data.riskLevel = patch.riskLevel;

    const row = await prisma.approval.update({
      where: { id },
      data,
    });
    return this.toApproval(row);
  }

  async list(filter?: { status?: string; quotationId?: string }): Promise<Approval[]> {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.quotationId) where.quotationId = filter.quotationId;
    const rows = await prisma.approval.findMany({
      where,
      orderBy: { submittedAt: "desc" },
    });
    return rows.map((r) => this.toApproval(r));
  }
}

/* ---------------------------------------- INVOICE REPOSITORY */
export class PrismaInvoiceRepository implements IInvoiceRepository {
  async create(invoice: Invoice): Promise<Invoice> {
    const row = await prisma.invoice.create({
      data: {
        id: invoice.id,
        number: invoice.number,
        customerId: invoice.customerId,
        quotationId: invoice.quotationId,
        amount: invoice.amount,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        payments: JSON.stringify(invoice.payments || []),
      },
    });
    return {
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      quotationId: row.quotationId,
      amount: row.amount,
      status: row.status as any,
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
      payments: JSON.parse(row.payments || "[]"),
    };
  }

  async list(): Promise<Invoice[]> {
    const rows = await prisma.invoice.findMany({ orderBy: { issuedAt: "desc" } });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      quotationId: row.quotationId,
      amount: row.amount,
      status: row.status as any,
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
      payments: JSON.parse(row.payments || "[]"),
    }));
  }
}

/* ------------------------------------ FULFILLMENT REPOSITORY */
export class PrismaFulfillmentRepository implements IFulfillmentRepository {
  async create(order: FulfillmentOrder): Promise<FulfillmentOrder> {
    const row = await prisma.fulfillmentOrder.create({
      data: {
        id: order.id,
        quotationId: order.quotationId,
        status: order.status,
        allocations: JSON.stringify(order.allocations || []),
        backorders: JSON.stringify(order.backorders || []),
        shippedAt: order.shippedAt ?? null,
        dueAt: order.dueAt,
      },
    });
    return {
      id: row.id,
      quotationId: row.quotationId,
      status: row.status as any,
      allocations: JSON.parse(row.allocations || "[]"),
      backorders: JSON.parse(row.backorders || "[]"),
      shippedAt: row.shippedAt ?? undefined,
      dueAt: row.dueAt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(): Promise<FulfillmentOrder[]> {
    const rows = await prisma.fulfillmentOrder.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({
      id: row.id,
      quotationId: row.quotationId,
      status: row.status as any,
      allocations: JSON.parse(row.allocations || "[]"),
      backorders: JSON.parse(row.backorders || "[]"),
      shippedAt: row.shippedAt ?? undefined,
      dueAt: row.dueAt,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async findById(id: string): Promise<FulfillmentOrder | null> {
    const row = await prisma.fulfillmentOrder.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      quotationId: row.quotationId,
      status: row.status as any,
      allocations: JSON.parse(row.allocations || "[]"),
      backorders: JSON.parse(row.backorders || "[]"),
      shippedAt: row.shippedAt ?? undefined,
      dueAt: row.dueAt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async update(id: string, patch: Partial<FulfillmentOrder>): Promise<FulfillmentOrder> {
    const data: any = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.allocations !== undefined) data.allocations = JSON.stringify(patch.allocations);
    if (patch.backorders !== undefined) data.backorders = JSON.stringify(patch.backorders);
    if (patch.shippedAt !== undefined) data.shippedAt = patch.shippedAt;
    if (patch.dueAt !== undefined) data.dueAt = patch.dueAt;

    const row = await prisma.fulfillmentOrder.update({
      where: { id },
      data,
    });
    return {
      id: row.id,
      quotationId: row.quotationId,
      status: row.status as any,
      allocations: JSON.parse(row.allocations || "[]"),
      backorders: JSON.parse(row.backorders || "[]"),
      shippedAt: row.shippedAt ?? undefined,
      dueAt: row.dueAt,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const quotationRepository = new PrismaQuotationRepository();
export const customerRepository = new PrismaCustomerRepository();
export const approvalRepository = new PrismaApprovalRepository();
export const invoiceRepository = new PrismaInvoiceRepository();
export const fulfillmentRepository = new PrismaFulfillmentRepository();
