import { useSyncExternalStore } from "react";
import type {
  Approval,
  ApprovalStep,
  AuditEntry,
  Customer,
  CustomerTier,
  DomainEvent,
  FulfillmentOrder,
  InventoryItem,
  Invoice,
  NegotiationRequest,
  Product,
  ProductCategory,
  Quotation,
  QuotationLine,
  QuotationStage,
  RecommendationRule,
  Role,
  Subscription,
  SubscriptionPlan,
  User,
  Warehouse,
} from "../modules/shared/types";
import {
  APPROVALS,
  AUDIT,
  CUSTOMERS,
  EVENTS,
  INVENTORY,
  INVOICES,
  ORDERS,
  PLANS,
  PRODUCTS,
  QUOTATIONS,
  SUBSCRIPTIONS,
  USERS,
  WAREHOUSES,
} from "./seed";
import {
  CATEGORY_CEILINGS,
  TIER_CEILINGS,
  calculateBlendedRisk,
  type GovernanceConfig,
} from "../modules/discount-governance/service";
import { DEFAULT_UPSELL_CONFIG } from "../modules/recommendations/service";
import { calculateTotals, canTransition, round } from "../modules/quotations/service";
import {
  calculateWarehouseSplit,
  canConsolidate,
  createBackorders,
  type SplitPlan,
} from "../modules/fulfillment/service";
import { addCycle, calculateProration, calculateCancellationRefund, reconcile } from "../modules/billing/service";
import { assertCan } from "../modules/identity/service";
import {
  ApprovalRequired,
  InsufficientStock,
  InvalidPayment,
  InvalidStateTransition,
  SubscriptionModificationInvalid,
} from "../lib/errors";
import { productsApi, usersApi, warehousesApi, inventoryApi, plansApi, governanceApi, quotationsApi, subscriptionsApi, approvalsApi } from "../lib/api";

export interface AppState {
  session: User | null;
  users: User[];
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  plans: SubscriptionPlan[];
  quotations: Quotation[];
  approvals: Approval[];
  orders: FulfillmentOrder[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  audit: AuditEntry[];
  events: DomainEvent[];
  governance: GovernanceConfig;
}

const STORAGE_KEY = "dealflow360_app_state_v1";

function loadState(): AppState {
  const defaults: AppState = {
    session: USERS[0] ?? null,
    users: USERS,
    customers: CUSTOMERS,
    products: PRODUCTS,
    warehouses: WAREHOUSES,
    inventory: INVENTORY,
    plans: PLANS,
    quotations: QUOTATIONS,
    approvals: APPROVALS,
    orders: ORDERS,
    subscriptions: SUBSCRIPTIONS,
    invoices: INVOICES,
    audit: AUDIT,
    events: EVENTS,
    governance: { tierCeilings: { ...TIER_CEILINGS }, categoryCeilings: { ...CATEGORY_CEILINGS } },
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : defaults.users,
          session: parsed.session !== undefined ? parsed.session : defaults.session,
        };
      }
    } catch (e) {
      console.warn("[DealFlow360] Could not read local state:", e);
    }
  }
  return defaults;
}

function saveState(s: AppState) {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("[DealFlow360] Could not persist local state:", e);
    }
  }
}

let state: AppState = loadState();

const listeners = new Set<() => void>();
const notify = () => {
  saveState(state);
  listeners.forEach((l) => l());
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  notify();
}

export function useAppState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/* ------------------------------------------------------------------ helpers */

export function productMap(s: AppState = state): Record<string, Product> {
  return Object.fromEntries(s.products.map((p) => [p.id, p]));
}
export function customerMap(s: AppState = state): Record<string, Customer> {
  return Object.fromEntries(s.customers.map((c) => [c.id, c]));
}
export function userMap(s: AppState = state): Record<string, User> {
  return Object.fromEntries(s.users.map((u) => [u.id, u]));
}

export function tierOf(s: AppState, quotation: Quotation): CustomerTier {
  return s.customers.find((c) => c.id === quotation.customerId)?.tier ?? "Bronze";
}

export function evaluate(s: AppState, quotation: Quotation) {
  return calculateBlendedRisk(quotation, tierOf(s, quotation), productMap(s), s.governance);
}

export function totalsOf(s: AppState, quotation: Quotation) {
  return calculateTotals(quotation.lines, productMap(s));
}

export function splitFor(s: AppState, order: FulfillmentOrder): SplitPlan {
  const quotation = s.quotations.find((q) => q.id === order.quotationId);
  if (!quotation)
    return { allocations: [], shortages: [], shipmentCount: 0, shippingCost: 0 };
  return calculateWarehouseSplit(quotation, productMap(s), s.warehouses, s.inventory);
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function record(action: string, entity: string, entityId: string, reason?: string) {
  const actor = state.session?.name ?? "System";
  const entry: AuditEntry = {
    id: uid("au"),
    entity,
    entityId,
    actor,
    action,
    at: now(),
    ...(reason ? { reason } : {}),
  };
  state = { ...state, audit: [entry, ...state.audit] };
}

function emit(name: string, payload: string) {
  state = {
    ...state,
    events: [{ id: uid("e"), name, payload, at: now() }, ...state.events].slice(0, 120),
  };
}

function replaceQuotation(quotation: Quotation) {
  state = {
    ...state,
    quotations: state.quotations.map((q) => (q.id === quotation.id ? quotation : q)),
  };
}

function touch(quotation: Quotation): Quotation {
  return { ...quotation, updatedAt: now() };
}

function transition(quotation: Quotation, to: QuotationStage): Quotation {
  if (quotation.stage !== to && !canTransition(quotation.stage, to))
    throw InvalidStateTransition(quotation.stage, to);
  return { ...quotation, stage: to, updatedAt: now() };
}

function requireSession() {
  if (!state.session) throw ApprovalRequired("Please sign in again to continue.");
  return state.session;
}

let isSyncing = false;

export const identityActions = {
  async login(email: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: password || "" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg =
          errorData.error?.message ||
          errorData.error ||
          (response.status === 401 ? "Invalid email address or password." : "Login failed.");
        throw new Error(errMsg);
      }

      const resData = await response.json();
      const authenticatedUser: User = resData.data || resData;

      const exists = state.users.some((u) => u.id === authenticatedUser.id);
      set({
        users: exists ? state.users : [...state.users, authenticatedUser],
        session: authenticatedUser,
      });
      record("Signed in", "Session", authenticatedUser.id);
      emit("UserSignedIn", `${authenticatedUser.name} (${authenticatedUser.role})`);
      return authenticatedUser;
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      throw err;
    }
  },
  async signup(name: string, email: string, role: Role, customerId?: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      throw new Error("This email / ID is already registered.");
    }
    const newUser = {
      id: uid("u"),
      name: name.trim(),
      email: normalizedEmail,
      role,
      password,
      ...(role === "CUSTOMER" && customerId ? { customerId } : {}),
    };

    // Make API call to backend
    try {
      const response = await fetch("/api/users/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || errorData.error || (response.status === 409 ? "This email / ID is already registered." : `Failed to sign up (${response.status})`);
        throw new Error(errMsg);
      }
      const resData = await response.json();
      const createdUser = resData.data || resData;
      
      set({
        users: [...state.users, createdUser],
        session: createdUser,
      });
      record("Registered account", "User", createdUser.id);
      emit("UserRegistered", `${createdUser.name} as ${createdUser.role}`);
      return createdUser;
    } catch (err: any) {
      console.error("[Auth] Signup error:", err);
      throw err;
    }
  },
  async updateProfile(userId: string, updates: { name?: string; email?: string }) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;
    const updatedUser: User = {
      ...user,
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.email ? { email: updates.email.trim().toLowerCase() } : {}),
    };

    try {
      const response = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      });
      if (!response.ok) throw new Error("Failed to update profile on backend");
      
      const serverUser = await response.json();
      const updatedUsers = state.users.map((u) => (u.id === userId ? serverUser : u));
      set({
        users: updatedUsers,
        session: state.session?.id === userId ? serverUser : state.session,
      });
      record("Updated profile details", "User", userId);
      emit("UserProfileUpdated", serverUser.name);
      return serverUser;
    } catch (err) {
      console.error("[Auth] Update profile error:", err);
      return null;
    }
  },
  async syncWithDatabase() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      // Sync users from DB (merge new DB-only users into local state)
      const dbUsers = await usersApi.list();
      const knownIds = new Set(state.users.map((u) => u.id));
      const newUsers = dbUsers.filter((u) => !knownIds.has(u.id));
      if (newUsers.length > 0) set({ users: [...state.users, ...newUsers] });

      // Sync products — DB is authoritative
      const dbProducts = await productsApi.list();
      if (dbProducts.length > 0) set({ products: dbProducts });

      // Sync warehouses — DB is authoritative
      const dbWarehouses = await warehousesApi.list();
      if (dbWarehouses.length > 0) set({ warehouses: dbWarehouses });

      // Sync inventory — DB is authoritative
      const dbInventory = await inventoryApi.list();
      if (dbInventory && dbInventory.length > 0) {
        set({ inventory: dbInventory });
      }

      // Sync subscription plans — DB is authoritative
      const dbPlans = await plansApi.list();
      if (dbPlans.length > 0) set({ plans: dbPlans });

      // Sync subscriptions — DB is authoritative
      const dbSubscriptions = await subscriptionsApi.list();
      if (dbSubscriptions && dbSubscriptions.length > 0) {
        set({ subscriptions: dbSubscriptions });
      }

      // Sync governance config — DB is authoritative over seed defaults
      const dbGovernance = await governanceApi.load();
      set({ governance: dbGovernance });

      // Sync quotations — DB is authoritative
      const dbQuotations = await quotationsApi.list();
      if (dbQuotations && dbQuotations.length > 0) {
        set({ quotations: dbQuotations });
      }

      // Sync approvals — DB is authoritative
      const dbApprovals = await approvalsApi.list();
      if (dbApprovals && dbApprovals.length > 0) {
        set({ approvals: dbApprovals });
      }
    } catch (error) {
      console.error("[DealFlow360] syncWithDatabase failed:", error);
    } finally {
      isSyncing = false;
    }
  },
  logout() {
    if (state.session) {
      record("Signed out", "Session", state.session.id);
      emit("UserSignedOut", state.session.name);
    }
    set({ session: null });
  },
  switchUser(userId: string) {
    const user = state.users.find((u) => u.id === userId);
    if (user) {
      set({ session: user });
      record(`Switched persona to ${user.name}`, "Session", user.id);
      emit("UserSwitched", `${user.name} (${user.role})`);
    }
    return user ?? null;
  },
};

/* ------------------------------------------------------------ quotations */

export const quotationActions = {
  async create(customerId: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.create");
    try {
      const created = await quotationsApi.create(customerId);
      state = { ...state, quotations: [created, ...state.quotations.filter((q) => q.id !== created.id)] };
      record("Created quotation", "Quotation", created.id);
      emit("QuotationCreated", created.number);
      notify();
      return created;
    } catch (err: any) {
      console.error("[QuotationActions] create error:", err);
      throw err;
    }
  },

  async addLine(quotationId: string, productId: string, qty = 1) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    const product = state.products.find((p) => p.id === productId);
    try {
      const updated = await quotationsApi.addLine(quotationId, { productId, qty });
      replaceQuotation(updated);
      if (product) record(`Added ${product.name} × ${qty}`, "Quotation", quotationId);
      notify();
      return updated;
    } catch (err: any) {
      console.error("[QuotationActions] addLine error:", err);
      throw err;
    }
  },

  async updateLine(quotationId: string, lineId: string, patch: Partial<QuotationLine>) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    try {
      const updated = await quotationsApi.updateLine(quotationId, lineId, {
        qty: patch.qty,
        unitPrice: patch.unitPrice,
        discountPct: patch.discountPct,
      });
      replaceQuotation(updated);
      if (patch.discountPct !== undefined) {
        record(`Discount changed to ${patch.discountPct}%`, "Quotation", quotationId);
      }
      notify();
      return updated;
    } catch (err: any) {
      console.error("[QuotationActions] updateLine error:", err);
      throw err;
    }
  },

  async removeLine(quotationId: string, lineId: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    try {
      const updated = await quotationsApi.removeLine(quotationId, lineId);
      replaceQuotation(updated);
      record("Removed a line", "Quotation", quotationId);
      notify();
      return updated;
    } catch (err: any) {
      console.error("[QuotationActions] removeLine error:", err);
      throw err;
    }
  },

  async moveLine(quotationId: string, lineId: string, direction: -1 | 1) {
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return;
    const index = quotation.lines.findIndex((l) => l.id === lineId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= quotation.lines.length) return;
    const lines = [...quotation.lines];
    const moved = lines[index]!;
    lines[index] = lines[target]!;
    lines[target] = moved;
    const updated = await quotationsApi.update(quotationId, { lines } as any);
    replaceQuotation(updated);
    notify();
    return updated;
  },

  async submitForApproval(quotationId: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.submit");
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return null;
    if (quotation.lines.length === 0)
      throw ApprovalRequired("Add at least one product line before submitting.");

    try {
      const res = await quotationsApi.submit(quotationId);
      replaceQuotation(res.quotation);
      if (res.approval) {
        state = {
          ...state,
          approvals: [res.approval, ...state.approvals.filter((a) => a.quotationId !== quotationId)],
        };
      }
      if (res.autoApproved) {
        record("Auto-approved — inside discount policy", "Quotation", quotationId);
        emit("QuotationApproved", res.quotation.number);
      } else {
        record("Submitted for approval", "Quotation", quotationId);
        emit("QuotationSubmittedForApproval", res.quotation.number);
      }
      notify();
      return res;
    } catch (err: any) {
      console.error("[QuotationActions] submitForApproval error:", err);
      throw err;
    }
  },

  async confirm(quotationId: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.confirm");
    try {
      const res = await quotationsApi.confirm(quotationId);
      replaceQuotation(res.quotation);
      if (res.invoice) {
        state = { ...state, invoices: [res.invoice, ...state.invoices] };
        emit("InvoiceCreated", res.invoice.number);
      }
      if (res.fulfillmentOrder) {
        state = { ...state, orders: [res.fulfillmentOrder, ...state.orders] };
      }
      record("Quotation confirmed", "Quotation", quotationId);
      emit("QuotationConfirmed", res.quotation.number);
      notify();
      return res;
    } catch (err: any) {
      console.error("[QuotationActions] confirm error:", err);
      throw err;
    }
  },

  async refresh() {
    try {
      const quotations = await quotationsApi.list();
      set({ quotations });
      return quotations;
    } catch (err) {
      console.error("[QuotationActions] refresh error:", err);
    }
  },

  async delete(quotationId: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    const quote = state.quotations.find((q) => q.id === quotationId);
    if (!quote) return;
    try {
      await quotationsApi.delete(quotationId);
      state = {
        ...state,
        quotations: state.quotations.filter((q) => q.id !== quotationId),
        approvals: state.approvals.filter((a) => a.quotationId !== quotationId),
      };
      record("Draft quotation deleted", "Quotation", quotationId);
      emit("QuotationDraftDeleted", quote.number);
      notify();
    } catch (err: any) {
      console.error("[QuotationActions] delete error:", err);
      throw err;
    }
  },

  async bulkDelete(quotationIds: string[]) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    if (!quotationIds || quotationIds.length === 0) return { deletedCount: 0, deletedIds: [] };
    try {
      const res = await quotationsApi.bulkDelete(quotationIds);
      const deletedSet = new Set(res.deletedIds);
      state = {
        ...state,
        quotations: state.quotations.filter((q) => !deletedSet.has(q.id)),
        approvals: state.approvals.filter((a) => !deletedSet.has(a.quotationId)),
      };
      record(`Bulk deleted ${res.deletedCount} draft quotations`, "Quotation", "bulk");
      emit("QuotationDraftDeleted", `${res.deletedCount} drafts`);
      notify();
      return res;
    } catch (err: any) {
      console.error("[QuotationActions] bulkDelete error:", err);
      throw err;
    }
  },

  addRecommendation(quotationId: string, productId: string) {
    const quotation = state.quotations.find((q) => q.id === quotationId);
    const product = state.products.find((p) => p.id === productId);
    if (!quotation || !product) return;
    const qty = quotation.lines[0]?.qty ?? 1;
    quotationActions.addLine(quotationId, productId, qty);
    emit("RecommendationAdded", `${quotation.number} · ${product.name}`);
    notify();
  },

  dismissRecommendation(quotationId: string, productId: string) {
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return;
    replaceQuotation({
      ...quotation,
      dismissedRecommendations: [...quotation.dismissedRecommendations, productId],
    });
    notify();
  },

  nudge(quotationId: string) {
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return;
    replaceQuotation({ ...quotation, nudgedAt: now() });
    record("Nudged deal owner", "Quotation", quotationId);
    emit("DealHealthAlertCreated", `${quotation.number} · owner nudged`);
    notify();
  },

  escalate(quotationId: string) {
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return;
    replaceQuotation({ ...quotation, escalated: true });
    record("Escalated to management", "Quotation", quotationId);
    emit("DealHealthAlertCreated", `${quotation.number} · escalated`);
    notify();
  },
};

/* -------------------------------------------------------------- approvals */

export const approvalActions = {
  async decide(
    approvalId: string,
    decision: "APPROVED" | "RETURNED" | "REJECTED",
    reason?: string,
  ) {
    const user = requireSession();
    assertCan(user.role, "approval.decide");
    const approval = state.approvals.find((a) => a.id === approvalId);
    if (!approval) throw new Error("Approval not found");
    const stepIndex = approval.steps.findIndex((s) => s.status === "PENDING");
    if (stepIndex < 0) throw new Error("This approval workflow has already been completed.");
    const step = approval.steps[stepIndex]!;
    if (user.role !== "ADMIN" && step.role !== user.role)
      throw ApprovalRequired(`This step is waiting on ${step.role.replace("_", " ")}.`);
    if (decision !== "APPROVED" && !reason?.trim())
      throw ApprovalRequired("A reason is required when returning or rejecting a quotation.");

    try {
      const res = await approvalsApi.decide(approvalId, decision, reason);
      if (res.approval) {
        state = {
          ...state,
          approvals: state.approvals.map((a) => (a.id === approvalId ? res.approval : a)),
        };
      }
      if (res.quotation) {
        replaceQuotation(res.quotation);
      }
      record(
        decision === "APPROVED"
          ? `${step.role.replace("_", " ")} approved`
          : decision === "RETURNED"
            ? "Returned for revision"
            : "Rejected",
        "Approval",
        approval.quotationId,
        reason,
      );
      if (decision === "APPROVED" && res.chainComplete) {
        emit("QuotationApproved", res.quotation?.number ?? approval.quotationId);
      } else if (decision === "RETURNED") {
        emit("ApprovalReturned", res.quotation?.number ?? approval.quotationId);
      } else if (decision === "REJECTED") {
        emit("ApprovalRejected", res.quotation?.number ?? approval.quotationId);
      }
      notify();
      return { chainComplete: res.chainComplete, nextRole: res.nextRole };
    } catch (err: any) {
      console.error("[ApprovalActions] decide error:", err);
      throw err;
    }
  },
};

/* ------------------------------------------------------------ fulfillment */

export const fulfillmentActions = {
  acceptSplit(orderId: string) {
    const user = requireSession();
    assertCan(user.role, "fulfillment.manage");
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const plan = splitFor(state, order);
    if (plan.allocations.length === 0)
      throw InsufficientStock("No stock is currently available to allocate for this order.");

    // First unreserve any previous allocations for this order
    const baseInventory = state.inventory.map((item) => {
      const prevAllocated = order.allocations
        .filter((a) => a.warehouseId === item.warehouseId && a.productId === item.productId)
        .reduce((sum, a) => sum + a.qty, 0);
      return prevAllocated ? { ...item, reserved: Math.max(0, item.reserved - prevAllocated) } : item;
    });

    const inventory = baseInventory.map((item) => {
      const allocated = plan.allocations
        .filter((a) => a.warehouseId === item.warehouseId && a.productId === item.productId)
        .reduce((sum, a) => sum + a.qty, 0);
      return allocated ? { ...item, reserved: item.reserved + allocated } : item;
    });
    const backorders = createBackorders(plan.shortages);

    state = {
      ...state,
      inventory,
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              allocations: plan.allocations,
              backorders,
              status: backorders.length ? "BACKORDERED" : "ALLOCATED",
            }
          : o,
      ),
    };
    record("Accepted suggested warehouse split", "Fulfillment", orderId);
    emit("FulfillmentSplitCreated", `${orderId} · ${plan.shipmentCount} shipments`);
    if (backorders.length) emit("BackorderCreated", `${orderId} · ${backorders[0]!.qty} units`);
    notify();
    return { backorders, plan };
  },

  overrideSplit(orderId: string, allocations: { warehouseId: string; productId: string; qty: number }[]) {
    const user = requireSession();
    assertCan(user.role, "fulfillment.manage");
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;

    // First unreserve any previous allocations for this order to calculate true free stock
    const baseInventory = state.inventory.map((item) => {
      const prevAllocated = order.allocations
        .filter((a) => a.warehouseId === item.warehouseId && a.productId === item.productId)
        .reduce((sum, a) => sum + a.qty, 0);
      return prevAllocated ? { ...item, reserved: Math.max(0, item.reserved - prevAllocated) } : item;
    });

    for (const a of allocations) {
      const item = baseInventory.find(
        (i) => i.warehouseId === a.warehouseId && i.productId === a.productId,
      );
      const free = (item?.available ?? 0) - (item?.reserved ?? 0);
      if (a.qty > free)
        throw InsufficientStock(
          `${state.warehouses.find((w) => w.id === a.warehouseId)?.name} only has ${free} units free.`,
        );
    }
    const enriched = allocations
      .filter((a) => a.qty > 0)
      .map((a) => ({
        ...a,
        shipmentCost: state.warehouses.find((w) => w.id === a.warehouseId)?.shipmentCost ?? 0,
      }));
    const quotation = state.quotations.find((q) => q.id === order.quotationId);
    const products = productMap(state);
    const shortages = (quotation?.lines ?? [])
      .filter((l) => products[l.productId]?.category === "Hardware")
      .map((l) => ({
        productId: l.productId,
        qty:
          l.qty -
          enriched.filter((a) => a.productId === l.productId).reduce((s, a) => s + a.qty, 0),
      }))
      .filter((s) => s.qty > 0);

    state = {
      ...state,
      inventory: baseInventory.map((item) => {
        const allocated = enriched
          .filter((a) => a.warehouseId === item.warehouseId && a.productId === item.productId)
          .reduce((sum, a) => sum + a.qty, 0);
        return allocated ? { ...item, reserved: item.reserved + allocated } : item;
      }),
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              allocations: enriched,
              backorders: createBackorders(shortages),
              status: shortages.length ? "BACKORDERED" : "ALLOCATED",
            }
          : o,
      ),
    };
    record("Manually overrode warehouse allocation", "Fulfillment", orderId);
    emit("FulfillmentSplitCreated", `${orderId} · manual override`);
    notify();
  },

  async replenish(warehouseId: string, productId: string, qty: number) {
    const user = requireSession();
    assertCan(user.role, "fulfillment.manage");
    const current = state.inventory.find((i) => i.warehouseId === warehouseId && i.productId === productId);
    const newAvailable = (current?.available ?? 0) + qty;
    const item: InventoryItem = {
      warehouseId,
      productId,
      available: newAvailable,
      reserved: current?.reserved ?? 0,
      replenishmentDays: current?.replenishmentDays ?? 7,
    };
    try {
      await inventoryApi.upsert(item);
    } catch (err) {
      console.error("[Inventory] Replenish persist failed:", err);
    }
    state = {
      ...state,
      inventory: state.inventory.some((i) => i.warehouseId === warehouseId && i.productId === productId)
        ? state.inventory.map((i) => (i.warehouseId === warehouseId && i.productId === productId ? item : i))
        : [...state.inventory, item],
    };
    record(`Replenished ${qty} units`, "Inventory", `${warehouseId}/${productId}`);
    emit("StockReplenished", `${warehouseId} · ${qty} units`);
    notify();
  },

  consolidate(orderId: string, backorderId: string) {
    const user = requireSession();
    assertCan(user.role, "fulfillment.manage");
    const order = state.orders.find((o) => o.id === orderId);
    const backorder = order?.backorders.find((b) => b.id === backorderId);
    if (!order || !backorder) return;
    if (!canConsolidate(backorder, state.inventory))
      throw InsufficientStock("Stock is still insufficient to consolidate this backorder.");

    let remaining = backorder.qty;
    const inventory = state.inventory.map((item) => {
      if (item.productId !== backorder.productId || remaining <= 0) return item;
      const free = item.available - item.reserved;
      const take = Math.min(free, remaining);
      remaining -= take;
      return { ...item, reserved: item.reserved + take };
    });
    const allocations = [...order.allocations];
    const warehouse = state.warehouses[0]!;
    allocations.push({
      warehouseId: warehouse.id,
      productId: backorder.productId,
      qty: backorder.qty,
      shipmentCost: warehouse.shipmentCost,
    });

    state = {
      ...state,
      inventory,
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              inventoryVersion: undefined,
              allocations,
              backorders: o.backorders.map((b) =>
                b.id === backorderId ? { ...b, status: "CONSOLIDATED" as const } : b,
              ),
              status: "ALLOCATED",
            }
          : o,
      ) as FulfillmentOrder[],
    };
    record("Consolidated backorder into shipment", "Fulfillment", orderId);
    emit("BackorderConsolidated", `${orderId}`);
    notify();
  },

  ship(orderId: string) {
    const user = requireSession();
    assertCan(user.role, "fulfillment.manage");
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.allocations.length === 0)
      throw InsufficientStock("Allocate stock before marking this order as shipped.");
    state = {
      ...state,
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, status: "SHIPPED", shippedAt: now() } : o,
      ),
    };
    const quotation = state.quotations.find((q) => q.id === order.quotationId);
    if (quotation && quotation.stage === "FULFILLMENT") {
      replaceQuotation(transition(quotation, "INVOICED"));
    }
    record("Marked order as shipped", "Fulfillment", orderId);
    emit("OrderShipped", orderId);
    notify();
  },
};

/* ---------------------------------------------------------------- billing */

export const billingActions = {
  recordPayment(invoiceId: string, amount: number, method: string) {
    const user = requireSession();
    assertCan(user.role, "invoice.payment");
    const invoice = state.invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;
    if (!(amount > 0)) throw InvalidPayment("Enter a payment amount greater than zero.");
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    if (amount > round(invoice.amount - paid) + 0.01)
      throw InvalidPayment("Payment exceeds the outstanding balance on this invoice.");

    const payment = {
      id: uid("pay"),
      amount: round(amount),
      method,
      at: now(),
      recordedBy: user.name,
    };
    const status = reconcile(invoice, [payment]);
    state = {
      ...state,
      invoices: state.invoices.map((i) =>
        i.id === invoiceId ? { ...i, payments: [...i.payments, payment], status } : i,
      ),
    };
    if (status === "PAID") {
      const quotation = state.quotations.find((q) => q.id === invoice.quotationId);
      if (quotation && quotation.stage === "INVOICED") replaceQuotation(transition(quotation, "PAID"));
    }
    record(`Recorded payment of ${payment.amount.toFixed(2)}`, "Payment", invoiceId);
    emit("PaymentRecorded", `${invoice.number} · ${payment.amount.toFixed(2)}`);
    notify();
    return status;
  },

  async modifySubscription(subscriptionId: string, qty: number) {
    const user = requireSession();
    assertCan(user.role, "billing.manage");
    const sub = state.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return;
    if (sub.status === "CANCELLED")
      throw SubscriptionModificationInvalid("A cancelled subscription cannot be modified.");
    if (qty < 1) throw SubscriptionModificationInvalid("Quantity must be at least one seat.");
    const plan = state.plans.find((p) => p.id === sub.planId);
    const proration = calculateProration(sub, qty, sub.unitPrice, plan);
    const adjustment =
      proration.kind === "NONE"
        ? null
        : {
            id: uid("adj"),
            kind: proration.kind,
            amount: Math.abs(proration.difference),
            note: `${qty - sub.qty > 0 ? "Added" : "Removed"} ${Math.abs(qty - sub.qty)} seats with ${proration.daysRemaining} of ${proration.daysInCycle} days remaining.`,
            at: now(),
          };
    const adjustments = adjustment ? [adjustment, ...sub.adjustments] : sub.adjustments;
    try {
      await subscriptionsApi.update(subscriptionId, { qty, adjustments });
    } catch (err) {
      console.error("[Subscription] Failed to persist seat modification:", err);
    }
    state = {
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.id === subscriptionId
          ? { ...s, qty, adjustments }
          : s,
      ),
    };
    record(`Changed seats to ${qty}`, "Subscription", subscriptionId);
    emit("ProrationCalculated", `${subscriptionId} · ${proration.difference.toFixed(2)}`);
    emit("SubscriptionModified", subscriptionId);
    notify();
    return proration;
  },

  async setSubscriptionStatus(subscriptionId: string, status: Subscription["status"]) {
    const user = requireSession();
    assertCan(user.role, "billing.manage");
    const sub = state.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return;
    const plan = state.plans.find((p) => p.id === sub.planId);

    let adjustments = sub.adjustments;
    let nextBillDate = sub.nextBillDate;

    if (status === "CANCELLED") {
      const refund = calculateCancellationRefund(sub, plan);
      if (refund.isRefundable) {
        const refundAdj = {
          id: uid("adj"),
          kind: "CREDIT" as const,
          amount: refund.refundAmount,
          note: `Cancellation Refund: ₹${refund.refundAmount} (${refund.refundRatePct}% of ${refund.daysRemaining} unused days)`,
          at: now(),
        };
        adjustments = [refundAdj, ...adjustments];
        record(`Refund of ₹${refund.refundAmount} calculated for cancellation`, "Subscription", subscriptionId);
        emit("SubscriptionRefundIssued", `${subscriptionId} · ₹${refund.refundAmount}`);
      }
    } else if (status === "ACTIVE") {
      nextBillDate = addCycle(now(), sub.cycle);
    }

    try {
      await subscriptionsApi.update(subscriptionId, { status, nextBillDate, adjustments });
    } catch (err) {
      console.error("[Subscription] Failed to persist status update:", err);
    }

    state = {
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.id === subscriptionId
          ? {
              ...s,
              status,
              nextBillDate,
              adjustments,
            }
          : s,
      ),
    };
    record(`Subscription ${status.toLowerCase()}`, "Subscription", subscriptionId);
    emit(status === "CANCELLED" ? "SubscriptionCancelled" : "SubscriptionModified", subscriptionId);
    notify();
  },
};

/* ------------------------------------------------------------ negotiation */

export const negotiationActions = {
  submitRequest(
    quotationId: string,
    input: { lineId: string; requestedDiscountPct: number; note: string }[],
    comment: string,
    requestedDeliveryDate?: string,
  ) {
    const user = requireSession();
    assertCan(user.role, "portal.use");
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) return;
    if (user.customerId !== quotation.customerId)
      throw ApprovalRequired("This quotation belongs to another account.");

    const requests: NegotiationRequest[] = input.map((r) => ({
      id: uid("r"),
      lineId: r.lineId,
      requestedDiscountPct: r.requestedDiscountPct,
      note: r.note,
      status: "OPEN",
      at: now(),
    }));
    const messages = comment.trim()
      ? [
          ...quotation.messages,
          {
            id: uid("m"),
            author: user.name,
            role: user.role,
            body: comment.trim(),
            at: now(),
          },
        ]
      : quotation.messages;

    const next: Quotation = {
      ...quotation,
      requests: [...quotation.requests, ...requests],
      messages,
      stage: quotation.stage === "CONFIRMED" ? quotation.stage : "NEGOTIATION",
      updatedAt: now(),
      ...(requestedDeliveryDate ? { requestedDeliveryDate } : {}),
    };
    replaceQuotation(next);
    record("Customer submitted a negotiation request", "Quotation", quotationId, comment);
    emit("NegotiationRequested", quotation.number);
    notify();
  },

  reply(quotationId: string, body: string) {
    const user = requireSession();
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation || !body.trim()) return;
    replaceQuotation({
      ...quotation,
      messages: [
        ...quotation.messages,
        { id: uid("m"), author: user.name, role: user.role, body: body.trim(), at: now() },
      ],
      updatedAt: now(),
    });
    notify();
  },

  /**
   * Accepting a counter-discount rewrites the line, re-runs governance and
   * re-routes the quote to approval when the new terms break policy.
   */
  respond(quotationId: string, requestId: string, accept: boolean, note: string) {
    const user = requireSession();
    assertCan(user.role, "quotation.edit");
    const quotation = state.quotations.find((q) => q.id === quotationId);
    const request = quotation?.requests.find((r) => r.id === requestId);
    if (!quotation || !request) return null;

    let lines = quotation.lines;
    if (accept) {
      lines = quotation.lines.map((l) =>
        l.id === request.lineId ? { ...l, discountPct: request.requestedDiscountPct } : l,
      );
    }
    let next: Quotation = {
      ...quotation,
      lines,
      requests: quotation.requests.map((r) =>
        r.id === requestId ? { ...r, status: accept ? "ACCEPTED" : "DECLINED" } : r,
      ),
      messages: [
        ...quotation.messages,
        {
          id: uid("m"),
          author: user.name,
          role: user.role,
          body: note.trim() || (accept ? "Revised terms accepted." : "We cannot apply that discount."),
          lineId: request.lineId,
          at: now(),
        },
      ],
      updatedAt: now(),
    };

    const evaluation = calculateBlendedRisk(
      next,
      tierOf(state, next),
      productMap(state),
      state.governance,
    );
    let reapproval = false;
    if (accept && evaluation.approvalChain.length > 0) {
      reapproval = true;
      next = { ...next, stage: "PENDING_APPROVAL" };
      const approval: Approval = {
        id: uid("a"),
        quotationId,
        status: "PENDING",
        riskLevel: evaluation.riskLevel,
        submittedBy: user.id,
        submittedAt: now(),
        steps: evaluation.approvalChain.map((role) => ({ role, status: "PENDING" as const })),
      };
      state = {
        ...state,
        approvals: [approval, ...state.approvals.filter((a) => a.quotationId !== quotationId)],
      };
      emit("QuotationReapprovalTriggered", `${quotation.number} · ${evaluation.riskLevel}`);
    } else if (accept) {
      next = { ...next, stage: "APPROVED" };
      emit("NegotiationAccepted", quotation.number);
    }

    replaceQuotation(next);
    record(
      accept ? `Accepted counter discount of ${request.requestedDiscountPct}%` : "Declined counter discount",
      "Negotiation",
      quotationId,
      note,
    );
    notify();
    return { reapproval, evaluation };
  },

  /**
   * Customer Portal confirmation action (B8).
   * If final terms exceed approval thresholds, automatically re-enters approval flow (B4).
   * Otherwise, moves directly to fulfillment and invoice generation.
   */
  async customerConfirm(quotationId: string) {
    const user = requireSession();
    assertCan(user.role, "portal.confirm");
    const quotation = state.quotations.find((q) => q.id === quotationId);
    if (!quotation) throw new Error("Quotation not found");
    if (user.role === "CUSTOMER" && user.customerId && quotation.customerId !== user.customerId) {
      throw ApprovalRequired("This quotation belongs to another customer account.");
    }

    // Evaluate governance thresholds against current terms
    const evaluation = calculateBlendedRisk(
      quotation,
      tierOf(state, quotation),
      productMap(state),
      state.governance,
    );

    // If terms exceed approval ceilings, quotation automatically re-enters approval flow from B4
    if (evaluation.approvalChain.length > 0) {
      const updated: Quotation = {
        ...quotation,
        stage: "PENDING_APPROVAL",
        updatedAt: now(),
      };
      replaceQuotation(updated);

      const approval: Approval = {
        id: uid("a"),
        quotationId,
        status: "PENDING",
        riskLevel: evaluation.riskLevel,
        submittedBy: user.id,
        submittedAt: now(),
        steps: evaluation.approvalChain.map((role) => ({ role, status: "PENDING" as const })),
      };

      state = {
        ...state,
        approvals: [approval, ...state.approvals.filter((a) => a.quotationId !== quotationId)],
      };

      record(
        "Quotation confirmed by customer; terms exceed discount threshold -> re-entered approval queue",
        "Quotation",
        quotationId,
        `Risk: ${evaluation.riskLevel} (${evaluation.reasons.join(", ")})`
      );
      emit("QuotationReapprovalTriggered", `${quotation.number} · ${evaluation.riskLevel}`);
      notify();

      try {
        await quotationsApi.update(quotationId, { stage: "PENDING_APPROVAL" });
      } catch (err) {
        console.warn("[CustomerPortal] Could not sync re-approval stage to DB:", err);
      }

      return {
        routedTo: "APPROVAL" as const,
        riskLevel: evaluation.riskLevel,
        evaluation,
        quotation: updated,
      };
    }

    // Otherwise, terms are within safe limits -> moves directly to fulfillment!
    const updated: Quotation = {
      ...quotation,
      stage: "CONFIRMED",
      updatedAt: now(),
    };
    replaceQuotation(updated);

    // Create Invoice if total > 0
    const totals = totalsOf(state, updated);
    let invoice: Invoice | undefined;
    if (totals.total > 0) {
      invoice = {
        id: uid("i"),
        number: `INV-${5000 + state.invoices.length + 1}`,
        customerId: quotation.customerId,
        quotationId,
        amount: totals.total,
        status: "UNPAID",
        issuedAt: now(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        payments: [],
      };
      state = { ...state, invoices: [invoice, ...state.invoices] };
      emit("InvoiceCreated", invoice.number);
    }

    // Create Fulfillment Order if hardware exists
    const prods = productMap(state);
    const hasHardware = quotation.lines.some((l) => prods[l.productId]?.category === "Hardware");
    let fulfillmentOrder: FulfillmentOrder | undefined;
    if (hasHardware) {
      fulfillmentOrder = {
        id: uid("fo"),
        quotationId,
        status: "AWAITING",
        allocations: [],
        backorders: [],
        createdAt: now(),
        dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      };
      state = { ...state, orders: [fulfillmentOrder, ...state.orders] };
      emit("FulfillmentScheduled", fulfillmentOrder.id);
    }

    record("Quotation confirmed by customer; moving directly to fulfillment", "Quotation", quotationId);
    emit("QuotationConfirmed", quotation.number);
    notify();

    try {
      await quotationsApi.confirm(quotationId);
    } catch (err) {
      console.warn("[CustomerPortal] Could not sync confirmation to DB:", err);
    }

    return {
      routedTo: "FULFILLMENT" as const,
      quotation: updated,
      invoice,
      fulfillmentOrder,
    };
  },
};

/* ------------------------------------------------------------------ admin */

export const adminActions = {
  async saveProduct(product: Product) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const saved = await productsApi.upsert(product);
    const exists = state.products.some((p) => p.id === saved.id);
    set({
      products: exists
        ? state.products.map((p) => (p.id === saved.id ? saved : p))
        : [...state.products, saved],
    });
    record(exists ? `Updated ${saved.name}` : `Created ${saved.name}`, "Product", saved.id);
  },

  async setTierCeiling(tier: CustomerTier, pct: number) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const updated = { ...state.governance, tierCeilings: { ...state.governance.tierCeilings, [tier]: pct } };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`${tier} ceiling set to ${pct}%`, "DiscountRule", tier);
  },

  async setCategoryCeiling(category: ProductCategory, pct: number) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const updated = { ...state.governance, categoryCeilings: { ...state.governance.categoryCeilings, [category]: pct } };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`${category} ceiling set to ${pct}%`, "DiscountRule", category);
  },

  async saveWarehouse(warehouse: Warehouse) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const saved = await warehousesApi.update(warehouse);
    set({ warehouses: state.warehouses.map((w) => (w.id === saved.id ? saved : w)) });
    record(`Updated ${saved.name}`, "Warehouse", saved.id);
  },

  async createPlan(plan: SubscriptionPlan) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const saved = await plansApi.create(plan);
    set({ plans: [...state.plans, saved] });
    record(`Created subscription plan ${saved.name}`, "SubscriptionPlan", saved.id);
    return saved;
  },

  async deletePlan(planId: string) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    await plansApi.delete(planId);
    set({ plans: state.plans.filter((p) => p.id !== planId) });
    record(`Deleted subscription plan ${planId}`, "SubscriptionPlan", planId);
  },

  async savePlan(plan: SubscriptionPlan) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const saved = await plansApi.update(plan);
    set({ plans: state.plans.map((p) => (p.id === saved.id ? saved : p)) });
    record(`Updated ${saved.name}`, "SubscriptionPlan", saved.id);
    return saved;
  },

  async saveStock(warehouseId: string, productId: string, available: number, replenishmentDays: number = 7) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const existing = state.inventory.find((i) => i.warehouseId === warehouseId && i.productId === productId);
    const reserved = existing?.reserved ?? 0;
    const item: InventoryItem = {
      warehouseId,
      productId,
      available: Math.max(0, available),
      reserved,
      replenishmentDays: Math.max(0, replenishmentDays),
    };
    const saved = await inventoryApi.upsert(item);
    const exists = state.inventory.some((i) => i.warehouseId === warehouseId && i.productId === productId);
    set({
      inventory: exists
        ? state.inventory.map((i) => (i.warehouseId === warehouseId && i.productId === productId ? saved : i))
        : [...state.inventory, saved],
    });
    const pName = state.products.find((p) => p.id === productId)?.name || productId;
    const wName = state.warehouses.find((w) => w.id === warehouseId)?.name || warehouseId;
    record(`Stock updated for ${pName} at ${wName}: ${saved.available} units`, "Inventory", `${warehouseId}_${productId}`);
    return saved;
  },

  async setUpsellMargin(minMarginPct: number) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const currentUpsell = state.governance.upsellConfig ?? DEFAULT_UPSELL_CONFIG;
    const updated: GovernanceConfig = {
      ...state.governance,
      upsellConfig: {
        ...currentUpsell,
        minMarginPct,
      },
    };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`Updated minimum upsell margin to ${minMarginPct}%`, "Governance", "upsell");
    notify();
  },

  async togglePromotedProduct(productId: string) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const currentUpsell = state.governance.upsellConfig ?? DEFAULT_UPSELL_CONFIG;
    const current = new Set(currentUpsell.promotedProductIds || []);
    if (current.has(productId)) current.delete(productId);
    else current.add(productId);

    const updated: GovernanceConfig = {
      ...state.governance,
      upsellConfig: {
        ...currentUpsell,
        promotedProductIds: Array.from(current),
      },
    };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`Toggled promoted status for ${productId}`, "Governance", "upsell");
    notify();
  },

  async addPairingRule(rule: RecommendationRule) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const currentUpsell = state.governance.upsellConfig ?? DEFAULT_UPSELL_CONFIG;
    const updated: GovernanceConfig = {
      ...state.governance,
      upsellConfig: {
        ...currentUpsell,
        rules: [rule, ...(currentUpsell.rules || [])],
      },
    };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`Added recommendation pairing rule`, "Governance", "upsell");
    notify();
  },

  async deletePairingRule(index: number) {
    const user = requireSession();
    assertCan(user.role, "admin.configure");
    const currentUpsell = state.governance.upsellConfig ?? DEFAULT_UPSELL_CONFIG;
    const updatedRules = (currentUpsell.rules || []).filter((_, i) => i !== index);
    const updated: GovernanceConfig = {
      ...state.governance,
      upsellConfig: {
        ...currentUpsell,
        rules: updatedRules,
      },
    };
    await governanceApi.save(updated);
    set({ governance: updated });
    record(`Deleted recommendation pairing rule`, "Governance", "upsell");
    notify();
  },
};
