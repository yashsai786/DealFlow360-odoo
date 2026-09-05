import type { Role } from "../shared/types";

export type Permission =
  | "quotation.create"
  | "quotation.edit"
  | "quotation.submit"
  | "quotation.confirm"
  | "approval.decide"
  | "approval.finance"
  | "fulfillment.manage"
  | "billing.manage"
  | "invoice.payment"
  | "dealhealth.view"
  | "reports.view"
  | "admin.configure"
  | "portal.use";

const MATRIX: Record<Role, Permission[]> = {
  SALES_REP: [
    "quotation.create",
    "quotation.edit",
    "quotation.submit",
    "quotation.confirm",
    "dealhealth.view",
    "reports.view",
  ],
  SALES_MANAGER: [
    "quotation.create",
    "quotation.edit",
    "quotation.submit",
    "quotation.confirm",
    "approval.decide",
    "dealhealth.view",
    "reports.view",
  ],
  FINANCE: [
    "approval.decide",
    "approval.finance",
    "fulfillment.manage",
    "billing.manage",
    "invoice.payment",
    "dealhealth.view",
    "reports.view",
  ],
  ADMIN: [
    "quotation.create",
    "quotation.edit",
    "quotation.submit",
    "quotation.confirm",
    "approval.decide",
    "approval.finance",
    "fulfillment.manage",
    "billing.manage",
    "invoice.payment",
    "dealhealth.view",
    "reports.view",
    "admin.configure",
  ],
  CUSTOMER: ["portal.use"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

/** Thrown by application services when a role attempts a forbidden action. */
export class UnauthorizedAction extends Error {
  constructor(permission: Permission) {
    super(`You do not have permission to perform this action (${permission}).`);
    this.name = "UnauthorizedAction";
  }
}

export function assertCan(role: Role, permission: Permission) {
  if (!can(role, permission)) throw new UnauthorizedAction(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  SALES_REP: "Sales Representative",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance & Operations",
  ADMIN: "Administrator",
  CUSTOMER: "Customer",
};
