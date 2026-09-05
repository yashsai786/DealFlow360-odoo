import {
  quotationRepository,
  customerRepository,
  productRepository,
  approvalRepository,
  invoiceRepository,
  fulfillmentRepository,
  auditRepository,
  domainEventRepository,
  governanceRepository,
} from "../infrastructure/repositories/prismaRepositories";
import type {
  User,
  Quotation,
  QuotationLine,
  QuotationStage,
  Approval,
  Invoice,
  FulfillmentOrder,
  DiscountEvaluation,
  Product,
  AuditEntry,
} from "../modules/shared/types";
import { assertCan } from "../modules/identity/service";
import { canTransition, calculateTotals, round } from "../modules/quotations/service";
import { calculateBlendedRisk } from "../modules/discount-governance/service";
import {
  requirePermission,
  enforceQuotationOwnership,
  enforceCustomerIsolation,
} from "./authorizationGuard";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

export class QuotationApplicationService {
  async list(
    actor: User,
    filters?: { customerId?: string; stage?: string; search?: string }
  ): Promise<Quotation[]> {
    const effectiveFilters: { customerId?: string; ownerId?: string; stage?: string; search?: string } = {
      ...filters,
    };

    // Enforce strict customer data isolation & sales rep assignment isolation
    if (actor.role === "CUSTOMER") {
      if (!actor.customerId) return [];
      effectiveFilters.customerId = actor.customerId;
    } else if (actor.role === "SALES_REP") {
      effectiveFilters.ownerId = actor.id;
    }

    return await quotationRepository.list(effectiveFilters);
  }

  async getById(id: string, actor: User): Promise<Quotation> {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) {
      throw new Error(`Quotation '${id}' not found`);
    }

    // Strict customer and ownership validation
    enforceQuotationOwnership(actor, quotation, false);

    return quotation;
  }

  async create(customerId: string, actor: User): Promise<Quotation> {
    requirePermission(actor, "quotation.create");

    // Check if customer exists
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer '${customerId}' not found`);
    }

    const nextSeq = await quotationRepository.getNextSequence();
    const quotation: Quotation = {
      id: uid("q"),
      number: `Q-${nextSeq}`,
      customerId,
      ownerId: actor.role === "CUSTOMER" ? "u-rep1" : actor.id,
      stage: "DRAFT",
      lines: [],
      createdAt: now(),
      updatedAt: now(),
      messages: [],
      requests: [],
      dismissedRecommendations: [],
    };

    const created = await quotationRepository.create(quotation);

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: created.id,
      actor: actor.name,
      action: "Created quotation",
      at: now(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "QuotationCreated",
      payload: created.number,
      at: now(),
    });

    return created;
  }

  async update(id: string, patch: Partial<Quotation>, actor: User): Promise<Quotation> {
    const quotation = await this.getById(id, actor);
    enforceQuotationOwnership(actor, quotation, true);

    // If stage transition is attempted, validate state machine
    if (patch.stage && patch.stage !== quotation.stage) {
      if (!canTransition(quotation.stage, patch.stage as QuotationStage)) {
        throw new Error(`Invalid stage transition from ${quotation.stage} to ${patch.stage}`);
      }
    }

    const updated = await quotationRepository.update(id, patch);
    return updated;
  }

  async addLine(
    id: string,
    lineInput: { productId: string; qty: number; unitPrice?: number; discountPct?: number },
    actor: User
  ): Promise<Quotation> {
    const quotation = await this.getById(id, actor);
    enforceQuotationOwnership(actor, quotation, true);

    // Fetch product details
    const products = await productRepository.list();
    const product = products.find((p) => p.id === lineInput.productId);
    if (!product) {
      throw new Error(`Product '${lineInput.productId}' not found`);
    }

    const existingIndex = quotation.lines.findIndex((l) => l.productId === lineInput.productId);
    let updatedLines: QuotationLine[];

    if (existingIndex >= 0 && quotation.lines[existingIndex]) {
      const existing = quotation.lines[existingIndex]!;
      updatedLines = quotation.lines.map((l, i) =>
        i === existingIndex ? { ...l, qty: l.qty + lineInput.qty } : l
      );
    } else {
      const newLine: QuotationLine = {
        id: uid("l"),
        productId: lineInput.productId,
        qty: lineInput.qty,
        unitPrice: lineInput.unitPrice ?? product.price,
        discountPct: lineInput.discountPct ?? 0,
        taxPct: product.taxPct,
      };
      updatedLines = [...quotation.lines, newLine];
    }

    const updated = await quotationRepository.update(id, { lines: updatedLines });

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: id,
      actor: actor.name,
      action: `Added ${product.name} × ${lineInput.qty}`,
      at: now(),
    });

    return updated;
  }

  async updateLine(
    id: string,
    lineId: string,
    patch: { qty?: number; unitPrice?: number; discountPct?: number },
    actor: User
  ): Promise<Quotation> {
    const quotation = await this.getById(id, actor);
    enforceQuotationOwnership(actor, quotation, true);

    const lineExists = quotation.lines.some((l) => l.id === lineId);
    if (!lineExists) {
      throw new Error(`Line '${lineId}' not found in quotation`);
    }

    const updatedLines = quotation.lines.map((l) => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        ...(patch.qty !== undefined ? { qty: Math.max(1, patch.qty) } : {}),
        ...(patch.unitPrice !== undefined ? { unitPrice: patch.unitPrice } : {}),
        ...(patch.discountPct !== undefined
          ? { discountPct: Math.max(0, Math.min(100, patch.discountPct)) }
          : {}),
      };
    });

    const updated = await quotationRepository.update(id, { lines: updatedLines });

    if (patch.discountPct !== undefined) {
      await auditRepository.record({
        id: uid("au"),
        entity: "Quotation",
        entityId: id,
        actor: actor.name,
        action: `Discount changed to ${patch.discountPct}%`,
        at: now(),
      });
    }

    return updated;
  }

  async removeLine(id: string, lineId: string, actor: User): Promise<Quotation> {
    const quotation = await this.getById(id, actor);
    enforceQuotationOwnership(actor, quotation, true);

    const updatedLines = quotation.lines.filter((l) => l.id !== lineId);
    const updated = await quotationRepository.update(id, { lines: updatedLines });

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: id,
      actor: actor.name,
      action: "Removed a line",
      at: now(),
    });

    return updated;
  }

  async submitForApproval(
    id: string,
    actor: User
  ): Promise<{
    quotation: Quotation;
    autoApproved: boolean;
    evaluation: DiscountEvaluation;
    approval?: Approval;
  }> {
    requirePermission(actor, "quotation.submit");
    const quotation = await this.getById(id, actor);
    enforceQuotationOwnership(actor, quotation, true);

    if (quotation.lines.length === 0) {
      throw new Error("Add at least one product line before submitting.");
    }

    // Retrieve customer tier
    const customer = await customerRepository.findById(quotation.customerId);
    const tier = customer?.tier ?? "Bronze";

    // Products map for calculation
    const productsList = await productRepository.list();
    const productMap: Record<string, Product> = Object.fromEntries(
      productsList.map((p) => [p.id, p])
    );

    // Governance config
    const governanceConfig = await governanceRepository.load();

    // Call domain discount governance engine
    const evaluation = calculateBlendedRisk(quotation, tier, productMap, governanceConfig);

    await domainEventRepository.emit({
      id: uid("e"),
      name: "DiscountRiskDetected",
      payload: `${quotation.number} · ${evaluation.riskLevel}`,
      at: now(),
    });

    // Auto-approve if within policy
    if (evaluation.approvalChain.length === 0) {
      const updated = await quotationRepository.update(id, { stage: "APPROVED" });

      await auditRepository.record({
        id: uid("au"),
        entity: "Quotation",
        entityId: id,
        actor: actor.name,
        action: "Auto-approved — inside discount policy",
        at: now(),
      });

      await domainEventRepository.emit({
        id: uid("e"),
        name: "QuotationApproved",
        payload: quotation.number,
        at: now(),
      });

      return { quotation: updated, autoApproved: true, evaluation };
    }

    // High/Medium risk: creates approval workflow
    const approval: Approval = {
      id: uid("a"),
      quotationId: id,
      status: "PENDING",
      riskLevel: evaluation.riskLevel,
      submittedBy: actor.id,
      submittedAt: now(),
      steps: evaluation.approvalChain.map((role) => ({ role, status: "PENDING" })),
    };

    await approvalRepository.create(approval);

    const updated = await quotationRepository.update(id, { stage: "PENDING_APPROVAL" });

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: id,
      actor: actor.name,
      action: "Submitted for approval",
      at: now(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "QuotationSubmittedForApproval",
      payload: quotation.number,
      at: now(),
    });

    return { quotation: updated, autoApproved: false, evaluation, approval };
  }

  async confirm(
    id: string,
    actor: User
  ): Promise<{ quotation: Quotation; invoice?: Invoice; fulfillmentOrder?: FulfillmentOrder }> {
    assertCan(actor.role, "quotation.confirm");
    const quotation = await this.getById(id, actor);

    if (quotation.stage !== "APPROVED") {
      throw new Error(`Cannot confirm quotation in stage '${quotation.stage}'. It must be APPROVED.`);
    }

    const updated = await quotationRepository.update(id, { stage: "CONFIRMED" });

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: id,
      actor: actor.name,
      action: "Quotation confirmed",
      at: now(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "QuotationConfirmed",
      payload: quotation.number,
      at: now(),
    });

    // Downstream generation
    const productsList = await productRepository.list();
    const productMap: Record<string, Product> = Object.fromEntries(
      productsList.map((p) => [p.id, p])
    );
    const totals = calculateTotals(quotation.lines, productMap);

    let invoice: Invoice | undefined;
    if (totals.oneTimeTotal > 0) {
      const invoices = await invoiceRepository.list();
      invoice = await invoiceRepository.create({
        id: uid("i"),
        number: `INV-${5003 + invoices.length}`,
        customerId: quotation.customerId,
        quotationId: id,
        amount: round(totals.oneTimeTotal * 1.08),
        status: "UNPAID",
        issuedAt: now(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        payments: [],
      });

      await domainEventRepository.emit({
        id: uid("e"),
        name: "InvoiceCreated",
        payload: invoice.number,
        at: now(),
      });
    }

    let fulfillmentOrder: FulfillmentOrder | undefined;
    const hasHardware = quotation.lines.some((l) => productMap[l.productId]?.category === "Hardware");
    if (hasHardware) {
      fulfillmentOrder = await fulfillmentRepository.create({
        id: uid("fo"),
        quotationId: id,
        status: "AWAITING",
        allocations: [],
        backorders: [],
        createdAt: now(),
        dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      });

      await domainEventRepository.emit({
        id: uid("e"),
        name: "FulfillmentOrderCreated",
        payload: `FO for ${quotation.number}`,
        at: now(),
      });
    }

    return { quotation: updated, invoice, fulfillmentOrder };
  }

  async delete(id: string, actor: User): Promise<{ id: string; deleted: boolean }> {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) {
      throw new Error(`Quotation '${id}' not found`);
    }

    enforceQuotationOwnership(actor, quotation, true);

    if (quotation.stage !== "DRAFT") {
      throw new Error(
        `Cannot delete quotation in stage '${quotation.stage}'. Only DRAFT quotations can be deleted.`
      );
    }

    await quotationRepository.delete(id);

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: id,
      actor: actor.name,
      action: "Draft quotation deleted",
      at: now(),
    });

    await domainEventRepository.emit({
      id: uid("e"),
      name: "QuotationDraftDeleted",
      payload: quotation.number,
      at: now(),
    });

    return { id, deleted: true };
  }

  async deleteMany(
    ids: string[],
    actor: User
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    assertCan(actor.role, "quotation.edit");
    if (!ids || ids.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }

    const allTarget = await Promise.all(ids.map((id) => quotationRepository.findById(id)));
    const existing = allTarget.filter((q): q is Quotation => q !== null);

    for (const q of existing) {
      if (actor.role === "CUSTOMER" && q.customerId !== actor.customerId) {
        throw new Error("Access denied: You can only delete your own draft quotations.");
      }
      if (q.stage !== "DRAFT") {
        throw new Error(
          `Quotation '${q.number}' is in stage '${q.stage}'. Only DRAFT quotations can be deleted.`
        );
      }
    }

    const validIds = existing.map((q) => q.id);
    const deletedCount = await quotationRepository.deleteMany(validIds);

    await auditRepository.record({
      id: uid("au"),
      entity: "Quotation",
      entityId: "bulk-delete",
      actor: actor.name,
      action: `Bulk deleted ${deletedCount} draft quotations`,
      reason: existing.map((q) => q.number).join(", "),
      at: now(),
    });

    for (const q of existing) {
      await domainEventRepository.emit({
        id: uid("e"),
        name: "QuotationDraftDeleted",
        payload: q.number,
        at: now(),
      });
    }

    return { deletedCount, deletedIds: validIds };
  }

  async nudge(
    id: string,
    note?: string,
    actor?: User
  ): Promise<{ quotation: Quotation; audit: AuditEntry }> {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) {
      throw new Error(`Quotation '${id}' not found`);
    }

    const timestamp = now();
    const updated = await quotationRepository.update(id, { nudgedAt: timestamp });
    const actorName = actor?.name || "Deal Intelligence";

    const audit: AuditEntry = {
      id: uid("aud"),
      entity: "Quotation",
      entityId: quotation.id,
      actor: actorName,
      action: "Nudged deal owner",
      reason: note?.trim() || "Automated deal health inactivity nudge",
      at: timestamp,
    };
    const savedAudit = await auditRepository.record(audit);

    await domainEventRepository.emit({
      id: uid("evt"),
      name: "DealHealthAlertCreated",
      payload: `${quotation.number} · owner nudged`,
      at: timestamp,
    });

    return { quotation: updated, audit: savedAudit };
  }

  async escalate(
    id: string,
    reason?: string,
    actor?: User
  ): Promise<{ quotation: Quotation; audit: AuditEntry }> {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) {
      throw new Error(`Quotation '${id}' not found`);
    }

    const timestamp = now();
    const updated = await quotationRepository.update(id, { escalated: true });
    const actorName = actor?.name || "Deal Intelligence";

    const audit: AuditEntry = {
      id: uid("aud"),
      entity: "Quotation",
      entityId: quotation.id,
      actor: actorName,
      action: "Escalated to management",
      reason: reason?.trim() || "Automated deal health anomaly escalation",
      at: timestamp,
    };
    const savedAudit = await auditRepository.record(audit);

    await domainEventRepository.emit({
      id: uid("evt"),
      name: "DealHealthAlertCreated",
      payload: `${quotation.number} · escalated`,
      at: timestamp,
    });

    return { quotation: updated, audit: savedAudit };
  }
}

export const quotationApplicationService = new QuotationApplicationService();

