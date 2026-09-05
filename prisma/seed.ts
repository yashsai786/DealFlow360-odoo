import { PrismaClient } from "@prisma/client";
import {
  USERS,
  CUSTOMERS,
  PRODUCTS,
  WAREHOUSES,
  INVENTORY,
  PLANS,
  QUOTATIONS,
  APPROVALS,
  ORDERS,
  SUBSCRIPTIONS,
  INVOICES,
  AUDIT,
} from "../src/infrastructure/seed";
import { DEFAULT_CONFIG } from "../src/modules/discount-governance/service";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding SQLite database with DealFlow360 enterprise dataset...");

  // Clean all tables
  await prisma.auditEntry.deleteMany({});
  await prisma.domainEvent.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.fulfillmentOrder.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.subscriptionPlan.deleteMany({});
  await prisma.governanceConfig.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});

  // 1. Customers
  for (const c of CUSTOMERS) {
    await prisma.customer.create({ data: c });
  }

  // 2. Users
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        customerId: u.customerId || null,
      },
    });
  }

  // 3. Products
  for (const p of PRODUCTS) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: p.price,
        cost: p.cost,
        taxPct: p.taxPct,
        description: p.description,
        cycle: p.cycle || null,
      },
    });
  }

  // 4. Warehouses
  for (const w of WAREHOUSES) {
    await prisma.warehouse.create({
      data: {
        id: w.id,
        name: w.name,
        location: w.location,
        shipmentCost: w.shipmentCost,
      },
    });
  }

  // 5. Inventory
  for (const i of INVENTORY) {
    await prisma.inventoryItem.create({
      data: {
        id: `${i.warehouseId}_${i.productId}`,
        warehouseId: i.warehouseId,
        productId: i.productId,
        available: i.available,
        reserved: i.reserved,
        replenishmentDays: i.replenishmentDays,
      },
    });
  }

  // 6. Subscription Plans
  for (const pl of PLANS) {
    await prisma.subscriptionPlan.create({
      data: {
        id: pl.id,
        name: pl.name,
        cycle: pl.cycle,
        price: pl.price,
        prorationEnabled: pl.prorationEnabled,
        cancellationPolicy: pl.cancellationPolicy,
      },
    });
  }

  // 7. Governance config (seed with defaults)
  await prisma.governanceConfig.upsert({
    where: { id: "default" },
    update: { config: JSON.stringify(DEFAULT_CONFIG) },
    create: { id: "default", config: JSON.stringify(DEFAULT_CONFIG) },
  });

  // 8. Quotations
  for (const q of QUOTATIONS) {
    await prisma.quotation.create({
      data: {
        id: q.id,
        number: q.number,
        customerId: q.customerId,
        ownerId: q.ownerId,
        stage: q.stage,
        lines: JSON.stringify(q.lines || []),
        messages: JSON.stringify(q.messages || []),
        requests: JSON.stringify(q.requests || []),
        dismissedRecommendations: JSON.stringify(q.dismissedRecommendations || []),
        requestedDeliveryDate: q.requestedDeliveryDate || null,
        promisedDeliveryDate: q.promisedDeliveryDate || null,
        nudgedAt: q.nudgedAt || null,
        escalated: Boolean(q.escalated),
      },
    });
  }

  // 7. Approvals
  for (const a of APPROVALS) {
    await prisma.approval.create({
      data: {
        id: a.id,
        quotationId: a.quotationId,
        status: a.status,
        steps: JSON.stringify(a.steps || []),
        riskLevel: a.riskLevel,
        submittedBy: a.submittedBy,
      },
    });
  }

  // 8. Orders
  for (const o of ORDERS) {
    await prisma.fulfillmentOrder.create({
      data: {
        id: o.id,
        quotationId: o.quotationId,
        status: o.status,
        allocations: JSON.stringify(o.allocations || []),
        backorders: JSON.stringify(o.backorders || []),
        dueAt: o.dueAt,
        shippedAt: o.shippedAt || null,
      },
    });
  }

  // 9. Subscriptions
  for (const s of SUBSCRIPTIONS) {
    await prisma.subscription.create({
      data: {
        id: s.id,
        customerId: s.customerId,
        quotationId: s.quotationId,
        planId: s.planId,
        qty: s.qty,
        unitPrice: s.unitPrice,
        cycle: s.cycle,
        startDate: s.startDate,
        nextBillDate: s.nextBillDate,
        status: s.status,
        adjustments: JSON.stringify(s.adjustments || []),
      },
    });
  }

  // 10. Invoices
  for (const inv of INVOICES) {
    await prisma.invoice.create({
      data: {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        quotationId: inv.quotationId,
        amount: inv.amount,
        status: inv.status,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
        payments: JSON.stringify(inv.payments || []),
      },
    });
  }

  // 11. Audit entries
  for (const au of AUDIT) {
    await prisma.auditEntry.create({
      data: {
        id: au.id,
        entity: au.entity,
        entityId: au.entityId,
        actor: au.actor,
        action: au.action,
        reason: au.reason || null,
      },
    });
  }

  console.log("Enterprise dataset seeded successfully into SQLite (prisma/dev.db).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
