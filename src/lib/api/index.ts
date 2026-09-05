import { apiClient } from "./client";
import type { User, Product, Warehouse, SubscriptionPlan } from "../../modules/shared/types";
import type { GovernanceConfig } from "../../modules/discount-governance/service";

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

/* ---------------------------------------------- PLANS API CLIENT */
export const plansApi = {
  list: () => apiClient<SubscriptionPlan[]>("/api/plans"),
  update: (plan: SubscriptionPlan) =>
    apiClient<SubscriptionPlan>("/api/plans", {
      method: "PATCH",
      body: JSON.stringify(plan),
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
