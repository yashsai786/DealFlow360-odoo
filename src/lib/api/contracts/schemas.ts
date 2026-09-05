import { z } from "zod";

/* ------------------------------------------------ GENERIC ENVELOPES */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export function apiSuccess<T>(data: T, metaOrStatus?: any, status = 200): Response {
  let meta: any = undefined;
  let statusCode = status;
  if (typeof metaOrStatus === "number") {
    statusCode = metaOrStatus;
  } else {
    meta = metaOrStatus;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(meta ? { meta } : {}),
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export function apiError(
  codeOrMessage: string,
  messageOrStatus?: string | number,
  status = 400,
  details?: any
): Response {
  let code = "BAD_REQUEST";
  let message = codeOrMessage;
  let statusCode = status;

  if (typeof messageOrStatus === "string") {
    code = codeOrMessage;
    message = messageOrStatus;
    statusCode = status;
  } else if (typeof messageOrStatus === "number") {
    message = codeOrMessage;
    statusCode = messageOrStatus;
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/* ------------------------------------------------ AUTH SCHEMAS */
export const LoginRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const SignupRequestSchema = z.object({
  name: z.string().min(2, "Name must have at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN", "CUSTOMER"]),
  customerId: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

/* -------------------------------------------- CUSTOMER SCHEMAS */
export const CreateCustomerSchema = z.object({
  name: z.string().min(2),
  tier: z.enum(["Bronze", "Silver", "Gold"]),
  industry: z.string(),
  contactEmail: z.string().email(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

/* --------------------------------------------- PRODUCT SCHEMAS */
export const CreateProductSchema = z.object({
  name: z.string().min(2),
  category: z.enum(["Hardware", "Services", "Subscriptions"]),
  unit: z.string(),
  price: z.number().positive(),
  cost: z.number().nonnegative(),
  taxPct: z.number().min(0).max(100),
  description: z.string(),
  cycle: z.enum(["Monthly", "Quarterly", "Yearly"]).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

/* ------------------------------------------- QUOTATION SCHEMAS */
export const CreateQuotationSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
});

export const UpdateQuotationSchema = z.object({
  stage: z.string().optional(),
  requestedDeliveryDate: z.string().optional(),
  promisedDeliveryDate: z.string().optional(),
  escalated: z.boolean().optional(),
  requests: z.array(z.any()).optional(),
  messages: z.array(z.any()).optional(),
});

export const AddQuotationLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  unitPrice: z.number().positive().optional(),
  discountPct: z.number().min(0).max(100).default(0),
});

export const UpdateQuotationLineSchema = z.object({
  qty: z.number().int().positive().optional(),
  unitPrice: z.number().positive().optional(),
  discountPct: z.number().min(0).max(100).optional(),
});

export const BulkDeleteQuotationsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one quotation ID must be provided"),
});

/* ---------------------------------- DISCOUNT GOVERNANCE SCHEMAS */
export const EvaluateLineDiscountSchema = z.object({
  tier: z.enum(["Bronze", "Silver", "Gold"]),
  productId: z.string(),
  discountPct: z.number().min(0).max(100),
});

export const EvaluateRiskSchema = z.object({
  quotationId: z.string(),
});

/* -------------------------------------------- APPROVAL SCHEMAS */
export const ApprovalDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN", "REJECT", "APPROVED", "RETURNED", "REJECTED"]),
  reason: z.string().optional(),
}).refine(
  (data) => {
    const isReturnOrReject = ["RETURN", "RETURNED", "REJECT", "REJECTED"].includes(data.decision);
    if (isReturnOrReject && !data.reason?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: "A valid reason is required when returning or rejecting a quotation",
    path: ["reason"],
  }
);

/* ----------------------------------------- FULFILLMENT SCHEMAS */
export const FulfillmentOverrideSchema = z.object({
  allocations: z.array(
    z.object({
      warehouseId: z.string(),
      productId: z.string(),
      qty: z.number().int().positive(),
      shipmentCost: z.number().nonnegative(),
    })
  ),
});

export const ReplenishInventorySchema = z.object({
  warehouseId: z.string(),
  productId: z.string(),
  quantity: z.number().int().positive(),
});

export const AdjustInventorySchema = z.object({
  productId: z.string(),
  delta: z.number().int(),
});

/* ---------------------------------------- SUBSCRIPTION SCHEMAS */
export const CreateSubscriptionSchema = z.object({
  customerId: z.string(),
  quotationId: z.string(),
  planId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().positive(),
  cycle: z.enum(["Monthly", "Quarterly", "Yearly"]),
});

export const ModifySubscriptionSchema = z.object({
  targetSeats: z.number().int().positive(),
  effectiveDate: z.string().optional(),
});

/* --------------------------------------------- INVOICE SCHEMAS */
export const RecordPaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero"),
  method: z.string().min(1, "Payment method is required"),
  recordedBy: z.string().optional(),
});

/* ---------------------------------------------- PORTAL SCHEMAS */
export const CounterDiscountRequestSchema = z.object({
  lineId: z.string(),
  requestedDiscountPct: z.number().min(0).max(100),
  note: z.string().min(1, "A note describing the discount counter is required"),
});

export const PortalMessageSchema = z.object({
  body: z.string().min(1, "Message body cannot be empty"),
  lineId: z.string().optional(),
});

/* ----------------------------------------- DEAL HEALTH SCHEMAS */
export const NudgeActionSchema = z.object({
  note: z.string().optional(),
});

export const EscalateActionSchema = z.object({
  reason: z.string().min(1, "Escalation reason is required"),
});
