import { apiClient } from "./client";
import type {
  User,
  Product,
  Warehouse,
  InventoryItem,
  SubscriptionPlan,
  Subscription,
  Quotation,
  DiscountEvaluation,
  Approval,
  Invoice,
  FulfillmentOrder,
  Recommendation,
  AuditEntry,
} from "../../modules/shared/types";
import type { GovernanceConfig } from "../../modules/discount-governance/service";
import type { UpsellConfig } from "../../modules/recommendations/service";

/* ------------------------------------------------ AUTH API CLIENT */
export const authApi = {
  getSession: () => apiClient<User>("/api/auth/session"),
  login: (credentials: { email?: string; userId?: string; password?: string }) =>
    apiClient<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  logout: () => apiClient<{ message: string }>("/api/auth/logout", { method: "POST" }),
  signup: (data: { name: string; email: string; organization: string; role?: string; password?: string }) =>
    apiClient<User>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

/* ------------------------------------------------ USERS API CLIENT */
export const usersApi = {
  check: (idOrEmail: string) =>
    apiClient<{ registered: boolean; user?: { id: string; email: string; name: string } }>(
      `/api/users/check?id=${encodeURIComponent(idOrEmail)}`
    ),
  list: () => apiClient<User[]>("/api/users"),
  getProfile: () => apiClient<User>("/api/users/profile"),
  updateProfile: (patch: Partial<User>) =>
    apiClient<User>("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

/* ----------------------------------------------- PRODUCTS API CLIENT */
export const productsApi = {
  list: () => apiClient<Product[]>("/api/products"),
  upsert: (product: Product) =>
    apiClient<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(product),
    }),
};

/* ----------------------------------------------- WAREHOUSES API CLIENT */
export const warehousesApi = {
  list: () => apiClient<Warehouse[]>("/api/warehouses"),
  update: (warehouse: Warehouse) =>
    apiClient<Warehouse>("/api/warehouses", {
      method: "PATCH",
      body: JSON.stringify(warehouse),
    }),
};

/* ---------------------------------------------- INVENTORY API CLIENT */
export const inventoryApi = {
  list: () => apiClient<InventoryItem[]>("/api/inventory"),
  upsert: (item: InventoryItem) =>
    apiClient<InventoryItem>("/api/inventory", {
      method: "POST",
      body: JSON.stringify(item),
    }),
};

/* ---------------------------------------------- PLANS API CLIENT */
export const plansApi = {
  list: () => apiClient<SubscriptionPlan[]>("/api/plans"),
  create: (plan: SubscriptionPlan) =>
    apiClient<SubscriptionPlan>("/api/plans", {
      method: "POST",
      body: JSON.stringify(plan),
    }),
  update: (plan: SubscriptionPlan) =>
    apiClient<SubscriptionPlan>("/api/plans", {
      method: "PATCH",
      body: JSON.stringify(plan),
    }),
  delete: (id: string) =>
    apiClient<{ deleted: boolean; id: string }>(`/api/plans?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

/* -------------------------------------- SUBSCRIPTIONS API CLIENT */
export const subscriptionsApi = {
  list: () => apiClient<Subscription[]>("/api/subscriptions"),
  create: (subscription: Subscription) =>
    apiClient<Subscription>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  update: (id: string, patch: Partial<Subscription>) =>
    apiClient<Subscription>("/api/subscriptions", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  calculateProration: (subscriptionId: string, newQty: number, apply = false) =>
    apiClient<{
      subscriptionId: string;
      oldQty: number;
      newQty: number;
      proration: any;
      applied: boolean;
      subscription: Subscription;
    }>("/api/subscriptions/proration", {
      method: "POST",
      body: JSON.stringify({ subscriptionId, newQty, apply }),
    }),
  getBreakdown: (quotationId: string) =>
    apiClient<any>("/api/subscriptions/breakdown", {
      method: "POST",
      body: JSON.stringify({ quotationId }),
    }),
  getSchedule: (subscriptionId: string, periods = 6) =>
    apiClient<{
      subscriptionId: string;
      cycle: string;
      qty: number;
      unitPrice: number;
      periods: number;
      schedule: any[];
    }>("/api/subscriptions/schedule", {
      method: "POST",
      body: JSON.stringify({ subscriptionId, periods }),
    }),
  cancelSubscription: (subscriptionId: string) =>
    apiClient<{
      subscriptionId: string;
      status: string;
      refund: any;
      creditNoteIssued: boolean;
      adjustments: any[];
    }>("/api/subscriptions/cancel", {
      method: "POST",
      body: JSON.stringify({ subscriptionId }),
    }),
};

/* --------------------------------------- FULFILLMENT API CLIENT */
export const fulfillmentApi = {
  list: () => apiClient<FulfillmentOrder[]>("/api/fulfillment"),
  create: (order: FulfillmentOrder) =>
    apiClient<FulfillmentOrder>("/api/fulfillment", {
      method: "POST",
      body: JSON.stringify(order),
    }),
  update: (id: string, patch: Partial<FulfillmentOrder>) =>
    apiClient<FulfillmentOrder>("/api/fulfillment", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  calculateSplit: (quotationId: string) =>
    apiClient<{
      quotationId: string;
      splitPlan: any;
      warehouseBreakdown: any[];
    }>("/api/fulfillment/split", {
      method: "POST",
      body: JSON.stringify({ quotationId }),
    }),
  checkConsolidation: (orderId: string, arrivalWarehouseId?: string, arrivalProductId?: string, arrivalQty?: number) =>
    apiClient<{
      orderId: string;
      promptAvailable: boolean;
      promptMessage: string;
      consolidatableBackorders: any[];
    }>("/api/fulfillment/consolidate", {
      method: "POST",
      body: JSON.stringify({ orderId, arrivalWarehouseId, arrivalProductId, arrivalQty }),
    }),
};


/* ------------------------------------------- GOVERNANCE API CLIENT */
export const governanceApi = {
  load: () => apiClient<GovernanceConfig>("/api/governance"),
  save: (config: GovernanceConfig) =>
    apiClient<GovernanceConfig>("/api/governance", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
};

/* -------------------------------------- RECOMMENDATIONS API CLIENT */
export const recommendationsApi = {
  get: (quotationId: string, config?: UpsellConfig) =>
    apiClient<{
      quotationId: string;
      count: number;
      recommendations: Recommendation[];
    }>("/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ quotationId, config }),
    }),
  dismiss: (quotationId: string, productId: string) =>
    apiClient<{
      quotationId: string;
      dismissedProductId: string;
      dismissedRecommendations: string[];
      success: boolean;
    }>("/api/recommendations/dismiss", {
      method: "POST",
      body: JSON.stringify({ quotationId, productId }),
    }),
  getConfig: () => apiClient<UpsellConfig>("/api/recommendations"),
  saveConfig: (config: Partial<UpsellConfig>) =>
    apiClient<UpsellConfig>("/api/recommendations", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
};

/* ------------------------------------------- QUOTATIONS API CLIENT */
export const quotationsApi = {
  list: (params?: { search?: string; stage?: string; customerId?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.stage && params.stage !== "all") query.set("stage", params.stage);
    if (params?.customerId) query.set("customerId", params.customerId);
    const qs = query.toString();
    return apiClient<Quotation[]>(`/api/quotations${qs ? `?${qs}` : ""}`);
  },
  getById: (id: string) => apiClient<Quotation>(`/api/quotations/${id}`),
  create: (customerId: string) =>
    apiClient<Quotation>("/api/quotations", {
      method: "POST",
      body: JSON.stringify({ customerId }),
    }),
  update: (id: string, patch: Partial<Quotation>) =>
    apiClient<Quotation>(`/api/quotations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  addLine: (
    id: string,
    line: { productId: string; qty: number; unitPrice?: number; discountPct?: number }
  ) =>
    apiClient<Quotation>(`/api/quotations/${id}/lines`, {
      method: "POST",
      body: JSON.stringify(line),
    }),
  updateLine: (
    id: string,
    lineId: string,
    patch: { qty?: number; unitPrice?: number; discountPct?: number }
  ) =>
    apiClient<Quotation>(`/api/quotations/${id}/lines/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removeLine: (id: string, lineId: string) =>
    apiClient<Quotation>(`/api/quotations/${id}/lines/${lineId}`, {
      method: "DELETE",
    }),
  submit: (id: string) =>
    apiClient<{
      quotation: Quotation;
      autoApproved: boolean;
      evaluation: DiscountEvaluation;
      approval?: Approval;
    }>(`/api/quotations/${id}/submit`, {
      method: "POST",
    }),
  confirm: (id: string) =>
    apiClient<{ quotation: Quotation; invoice?: Invoice; fulfillmentOrder?: FulfillmentOrder }>(
      `/api/quotations/${id}/confirm`,
      {
        method: "POST",
      }
    ),
  delete: (id: string) =>
    apiClient<{ id: string; deleted: boolean }>(`/api/quotations/${id}`, {
      method: "DELETE",
    }),
  bulkDelete: (ids: string[]) =>
    apiClient<{ deletedCount: number; deletedIds: string[] }>("/api/quotations/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

/* -------------------------------------------- APPROVALS API CLIENT */
export const approvalsApi = {
  list: (params?: { status?: string; quotationId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.quotationId) query.set("quotationId", params.quotationId);
    const qs = query.toString();
    return apiClient<Approval[]>(`/api/approvals${qs ? `?${qs}` : ""}`);
  },
  getById: (id: string) => apiClient<Approval>(`/api/approvals/${id}`),
  decide: (
    id: string,
    decision: "APPROVED" | "RETURNED" | "REJECTED" | "APPROVE" | "RETURN" | "REJECT",
    reason?: string
  ) =>
    apiClient<{
      approval: Approval;
      quotation: Quotation | null;
      chainComplete: boolean;
      nextRole?: string;
    }>(`/api/approvals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),
};

/* ----------------------------------------------- AUDIT API CLIENT */
export const auditApi = {
  list: (params?: { entity?: string; entityId?: string; actor?: string }) => {
    const query = new URLSearchParams();
    if (params?.entity) query.set("entity", params.entity);
    if (params?.entityId) query.set("entityId", params.entityId);
    if (params?.actor) query.set("actor", params.actor);
    const qs = query.toString();
    return apiClient<AuditEntry[]>(`/api/audit${qs ? `?${qs}` : ""}`);
  },
};


