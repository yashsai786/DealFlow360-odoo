/**
 * Shared domain vocabulary for DealFlow360.
 * Every bounded context speaks these types; UI never invents its own shapes.
 */

export type Role =
  | "SALES_REP"
  | "SALES_MANAGER"
  | "FINANCE"
  | "ADMIN"
  | "CUSTOMER";

export type CustomerTier = "Bronze" | "Silver" | "Gold";

export type ProductCategory = "Hardware" | "Services" | "Subscriptions";

export type BillingCycle = "Monthly" | "Quarterly" | "Yearly";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Set only for CUSTOMER users — enforces data isolation. */
  customerId?: string | undefined;
}

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier;
  industry: string;
  contactEmail: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  cost: number;
  taxPct: number;
  description: string;
  cycle?: BillingCycle | undefined;
}

export interface QuotationLine {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
}

export type QuotationStage =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "NEGOTIATION"
  | "CONFIRMED"
  | "FULFILLMENT"
  | "INVOICED"
  | "PAID"
  | "CANCELLED";

export interface NegotiationMessage {
  id: string;
  author: string;
  role: Role;
  body: string;
  lineId?: string | undefined;
  quotationId?: string | undefined;
  at: string;
}

export interface NegotiationRequest {
  id: string;
  quotationId?: string | undefined;
  lineId: string;
  requestedDiscountPct: number;
  note: string;
  status: "OPEN" | "ACCEPTED" | "DECLINED";
  at: string;
}

export interface Quotation {
  id: string;
  number: string;
  customerId: string;
  ownerId: string;
  stage: QuotationStage;
  lines: QuotationLine[];
  createdAt: string;
  updatedAt: string;
  requestedDeliveryDate?: string | undefined;
  promisedDeliveryDate?: string | undefined;
  messages: NegotiationMessage[];
  requests: NegotiationRequest[];
  dismissedRecommendations: string[];
  nudgedAt?: string | undefined;
  escalated?: boolean | undefined;
}

export type ApprovalStepStatus = "PENDING" | "APPROVED" | "RETURNED" | "REJECTED";
export type ApprovalStatus = ApprovalStepStatus;
export type ApprovalDecision = "APPROVE" | "RETURN" | "REJECT";

export interface ApprovalStep {
  role: Extract<Role, "SALES_MANAGER" | "FINANCE">;
  status: ApprovalStepStatus;
  decidedBy?: string | undefined;
  reason?: string | undefined;
  decidedAt?: string | undefined;
}

export interface Approval {
  id: string;
  quotationId: string;
  status: ApprovalStepStatus;
  steps: ApprovalStep[];
  riskLevel: RiskLevel;
  submittedBy: string;
  submittedAt: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface LineEvaluation {
  lineId: string;
  productName: string;
  category: ProductCategory;
  discountPct: number;
  ceilingPct: number;
  overagePct: number;
  violating: boolean;
  lineTotal: number;
}

export interface DiscountEvaluation {
  tier: CustomerTier;
  tierCeilingPct: number;
  lines: LineEvaluation[];
  blendedDiscountPct: number;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  approvalChain: ApprovalStep["role"][];
}

export interface Totals {
  gross: number;
  discount: number;
  tax: number;
  total: number;
  oneTimeTotal: number;
  recurringTotal: number;
  margin: number;
  marginPct: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  shipmentCost: number;
}

export interface InventoryItem {
  warehouseId: string;
  productId: string;
  available: number;
  reserved: number;
  replenishmentDays: number;
}

export interface Allocation {
  warehouseId: string;
  productId: string;
  qty: number;
  shipmentCost: number;
}

export interface Backorder {
  id: string;
  productId: string;
  qty: number;
  status: "OPEN" | "CONSOLIDATED";
}

export type FulfillmentStatus = "AWAITING" | "ALLOCATED" | "SHIPPED" | "BACKORDERED";

export interface FulfillmentOrder {
  id: string;
  quotationId: string;
  status: FulfillmentStatus;
  allocations: Allocation[];
  backorders: Backorder[];
  createdAt: string;
  shippedAt?: string | undefined;
  dueAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  cycle: BillingCycle;
  price: number;
  prorationEnabled: boolean;
  cancellationPolicy: string;
}

export interface BillingAdjustment {
  id: string;
  kind: "CREDIT" | "CHARGE";
  amount: number;
  note: string;
  at: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  quotationId: string;
  planId: string;
  qty: number;
  unitPrice: number;
  cycle: BillingCycle;
  startDate: string;
  nextBillDate: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  adjustments: BillingAdjustment[];
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  at: string;
  recordedBy: string;
}

export type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  quotationId: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  payments: Payment[];
}

export interface RecommendationRule {
  triggerProductId: string;
  suggestedProductId: string;
  reason: string;
  confidence: number;
  promotion?: string | undefined;
}

export interface Recommendation {
  productId: string;
  productName: string;
  reason: string;
  marginDelta: number;
  confidence: number;
  promotion?: string | undefined;
  price: number;
}

export type DealHealthStatus = "Healthy" | "Watch" | "At Risk" | "Critical";

export interface DealHealthAlert {
  id: string;
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  issue: string;
  detail: string;
  severity: DealHealthStatus;
  detectedAt: string;
  recommendedAction: string;
}

export interface AuditEntry {
  id: string;
  entity: string;
  entityId: string;
  actor: string;
  action: string;
  reason?: string | undefined;
  at: string;
}

export interface DomainEvent {
  id: string;
  name: string;
  payload: string;
  at: string;
}
