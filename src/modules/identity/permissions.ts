import type { Role } from "../shared/types";

export type NavTab =
  | "dashboard"
  | "quotations"
  | "pipeline"
  | "quotation-builder"
  | "approvals"
  | "fulfillment"
  | "subscriptions"
  | "invoices"
  | "deal-health"
  | "reports"
  | "governance"
  | "warehouses"
  | "admin"
  | "portal"
  | "profile";

export type PermissionAction =
  // Product Catalog
  | "product.view"
  | "product.create"
  | "product.edit"
  | "product.delete"
  // Price Lists & Governance
  | "pricelist.manage"
  | "governance.view"
  | "governance.tiers"
  | "governance.ceilings"
  | "governance.chains"
  // Quotations
  | "quotation.view_all"
  | "quotation.view_own"
  | "quotation.create"
  | "quotation.edit_all"
  | "quotation.edit_own"
  | "quotation.delete_all"
  | "quotation.delete_own"
  | "quotation.submit"
  | "quotation.confirm"
  | "quotation.negotiate"
  // Approvals
  | "approval.view_all"
  | "approval.view_own"
  | "approval.decide_manager"
  | "approval.decide_finance"
  // Fulfillment & Logistics
  | "fulfillment.view_all"
  | "fulfillment.view_own"
  | "fulfillment.manage"
  | "warehouse.view"
  | "warehouse.manage"
  | "inventory.view"
  | "inventory.manage"
  // Billing & Subscriptions
  | "billing.view_all"
  | "billing.view_own"
  | "billing.manage"
  | "invoice.view_all"
  | "invoice.view_own"
  | "invoice.manage"
  | "invoice.payment"
  | "plans.manage"
  // Deal Health & Intelligence
  | "dealhealth.view_all"
  | "dealhealth.view_own"
  | "dealhealth.nudge"
  | "dealhealth.escalate"
  // Reports
  | "reports.sales"
  | "reports.operational"
  | "reports.all"
  // Administration
  | "admin.configure"
  | "upsell.manage"
  | "audit.view"
  // Customer Portal
  | "portal.access"
  | "portal.negotiate"
  | "portal.confirm";

/** Normalizes role string to canonical domain Role */
export function normalizeRole(role: string | undefined | null): Role {
  if (!role) return "SALES_REP";
  const upper = role.toUpperCase().trim();
  if (upper === "FINANCE_OPERATIONS" || upper === "FINANCE_OPS" || upper === "FINANCE") {
    return "FINANCE";
  }
  if (upper === "SALES_MANAGER" || upper === "MANAGER") return "SALES_MANAGER";
  if (upper === "ADMIN" || upper === "ADMINISTRATOR") return "ADMIN";
  if (upper === "CUSTOMER") return "CUSTOMER";
  return "SALES_REP";
}

/** Page Access Matrix for all 5 roles */
export const PAGE_ACCESS_MATRIX: Record<Role, NavTab[]> = {
  ADMIN: [
    "dashboard",
    "quotations",
    "pipeline",
    "quotation-builder",
    "approvals",
    "fulfillment",
    "subscriptions",
    "invoices",
    "deal-health",
    "reports",
    "warehouses",
    "admin",
    "profile",
  ],
  SALES_REP: [
    "dashboard",
    "quotations",
    "pipeline",
    "quotation-builder",
    "approvals",
    "fulfillment",
    "subscriptions",
    "invoices",
    "deal-health",
    "profile",
  ],
  SALES_MANAGER: [
    "dashboard",
    "quotations",
    "pipeline",
    "quotation-builder",
    "approvals",
    "deal-health",
    "reports",
    "governance",
    "profile",
  ],
  FINANCE: [
    "dashboard",
    "quotations",
    "pipeline",
    "quotation-builder",
    "approvals",
    "fulfillment",
    "subscriptions",
    "invoices",
    "deal-health",
    "reports",
    "warehouses",
    "profile",
  ],
  CUSTOMER: ["portal", "profile"],
};

/** Action permissions matrix */
export const ACTION_PERMISSIONS_MATRIX: Record<Role, PermissionAction[]> = {
  ADMIN: [
    "product.view",
    "product.create",
    "product.edit",
    "product.delete",
    "pricelist.manage",
    "governance.view",
    "governance.tiers",
    "governance.ceilings",
    "governance.chains",
    "quotation.view_all",
    "quotation.view_own",
    "quotation.create",
    "quotation.edit_all",
    "quotation.edit_own",
    "quotation.delete_all",
    "quotation.delete_own",
    "quotation.submit",
    "quotation.confirm",
    "quotation.negotiate",
    "approval.view_all",
    "approval.view_own",
    "approval.decide_manager",
    "approval.decide_finance",
    "fulfillment.view_all",
    "fulfillment.view_own",
    "fulfillment.manage",
    "warehouse.view",
    "warehouse.manage",
    "inventory.view",
    "inventory.manage",
    "billing.view_all",
    "billing.view_own",
    "billing.manage",
    "invoice.view_all",
    "invoice.view_own",
    "invoice.manage",
    "invoice.payment",
    "plans.manage",
    "dealhealth.view_all",
    "dealhealth.view_own",
    "dealhealth.nudge",
    "dealhealth.escalate",
    "reports.sales",
    "reports.operational",
    "reports.all",
    "admin.configure",
    "upsell.manage",
    "audit.view",
  ],
  SALES_REP: [
    "product.view",
    "governance.view",
    "quotation.view_own",
    "quotation.create",
    "quotation.edit_own",
    "quotation.delete_own",
    "quotation.submit",
    "quotation.negotiate",
    "approval.view_own",
    "fulfillment.view_own",
    "billing.view_own",
    "invoice.view_own",
    "dealhealth.view_own",
  ],
  SALES_MANAGER: [
    "product.view",
    "governance.view",
    "governance.tiers",
    "governance.ceilings",
    "governance.chains",
    "quotation.view_all",
    "quotation.view_own",
    "quotation.negotiate",
    "approval.view_all",
    "approval.view_own",
    "approval.decide_manager",
    "dealhealth.view_all",
    "dealhealth.view_own",
    "dealhealth.nudge",
    "dealhealth.escalate",
    "reports.sales",
    "audit.view",
  ],
  FINANCE: [
    "product.view",
    "quotation.view_all",
    "approval.view_all",
    "approval.decide_finance",
    "fulfillment.view_all",
    "fulfillment.manage",
    "warehouse.view",
    "warehouse.manage",
    "inventory.view",
    "inventory.manage",
    "billing.view_all",
    "billing.manage",
    "invoice.view_all",
    "invoice.manage",
    "invoice.payment",
    "dealhealth.view_all",
    "reports.operational",
    "audit.view",
  ],
  CUSTOMER: ["portal.access", "portal.negotiate", "portal.confirm"],
};

export function canAccessPage(role: string | undefined | null, tab: NavTab): boolean {
  const norm = normalizeRole(role);
  return PAGE_ACCESS_MATRIX[norm]?.includes(tab) ?? false;
}

export function canPerformAction(role: string | undefined | null, action: PermissionAction): boolean {
  const norm = normalizeRole(role);
  return ACTION_PERMISSIONS_MATRIX[norm]?.includes(action) ?? false;
}

export function canAccessAdminTab(
  role: string | undefined | null,
  tab: "governance" | "catalog" | "warehouses" | "plans" | "upsell"
): boolean {
  const norm = normalizeRole(role);
  if (norm === "ADMIN") return true;
  if (norm === "SALES_MANAGER") return tab === "governance";
  if (norm === "FINANCE") return tab === "warehouses";
  return false;
}
