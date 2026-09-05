import {
  approvalRepository,
  quotationRepository,
  auditRepository,
  domainEventRepository,
} from "../infrastructure/repositories/prismaRepositories";
import type {
  User,
  Approval,
  ApprovalStep,
  ApprovalStepStatus,
  Quotation,
} from "../modules/shared/types";
import { assertCan } from "../modules/identity/service";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

export class ApprovalApplicationService {
  async list(
    actor: User,
    filter?: { status?: string; quotationId?: string }
  ): Promise<Approval[]> {
    if (actor.role === "CUSTOMER") {
      throw new Error("Access denied: Customers cannot view internal approvals.");
    }
    return await approvalRepository.list(filter);
  }

  async getById(id: string, actor: User): Promise<Approval> {
    if (actor.role === "CUSTOMER") {
      throw new Error("Access denied: Customers cannot view internal approvals.");
    }
    const approval = await approvalRepository.findById(id);
    if (!approval) {
      throw new Error(`Approval '${id}' not found`);
    }
    return approval;
  }

  async decide(
    approvalId: string,
    rawDecision: string,
    reason: string | undefined,
    actor: User
  ): Promise<{
    approval: Approval;
    quotation: Quotation | null;
    chainComplete: boolean;
    nextRole?: string;
  }> {
    if (actor.role === "CUSTOMER") {
      throw new Error("Access denied: Customers cannot make approval decisions.");
    }

    assertCan(actor.role, "approval.decide");

    const upper = rawDecision.toUpperCase();
    const decision: "APPROVED" | "RETURNED" | "REJECTED" =
      upper === "APPROVE" || upper === "APPROVED"
        ? "APPROVED"
        : upper === "RETURN" || upper === "RETURNED"
        ? "RETURNED"
        : upper === "REJECT" || upper === "REJECTED"
        ? "REJECTED"
        : (upper as any);

    if (decision !== "APPROVED" && !reason?.trim()) {
      throw new Error("A reason is required when returning or rejecting a quotation.");
    }

    const approval = await approvalRepository.findById(approvalId);
    if (!approval) {
      throw new Error(`Approval '${approvalId}' not found`);
    }

    const stepIndex = approval.steps.findIndex((s) => s.status === "PENDING");
    if (stepIndex < 0) {
      throw new Error("This approval workflow has already been completed.");
    }

    const step = approval.steps[stepIndex]!;
    if (actor.role !== "ADMIN" && step.role !== actor.role) {
      throw new Error(`This step is waiting on ${step.role.replace("_", " ")}.`);
    }

    const steps: ApprovalStep[] = approval.steps.map((s, idx) => {
      if (idx === stepIndex) {
        return {
          ...s,
          status: decision,
          decidedBy: actor.name,
          decidedAt: now(),
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        };
      }
      return s;
    });

    const chainComplete = steps.every((s) => s.status === "APPROVED");
    const status: ApprovalStepStatus =
      decision === "APPROVED" ? (chainComplete ? "APPROVED" : "PENDING") : decision;

    const updatedApproval = await approvalRepository.update(approvalId, {
      steps,
      status,
    });

    let updatedQuotation: Quotation | null = null;
    const quotation = await quotationRepository.findById(approval.quotationId);

    if (quotation) {
      if (decision === "APPROVED" && chainComplete) {
        updatedQuotation = await quotationRepository.update(quotation.id, { stage: "APPROVED" });
        await domainEventRepository.emit({
          id: uid("evt"),
          name: "QuotationApproved",
          payload: quotation.number,
          at: now(),
        });
      } else if (decision === "RETURNED") {
        updatedQuotation = await quotationRepository.update(quotation.id, { stage: "DRAFT" });
        await domainEventRepository.emit({
          id: uid("evt"),
          name: "ApprovalReturned",
          payload: quotation.number,
          at: now(),
        });
      } else if (decision === "REJECTED") {
        updatedQuotation = await quotationRepository.update(quotation.id, { stage: "CANCELLED" });
        await domainEventRepository.emit({
          id: uid("evt"),
          name: "ApprovalRejected",
          payload: quotation.number,
          at: now(),
        });
      } else {
        updatedQuotation = quotation;
      }

      await auditRepository.record({
        id: uid("aud"),
        action:
          decision === "APPROVED"
            ? `${step.role.replace("_", " ")} approved`
            : decision === "RETURNED"
            ? "Returned for revision"
            : "Rejected",
        entity: "Approval",
        entityId: quotation.id,
        actor: actor.name,
        reason: reason?.trim(),
        at: now(),
      });
    }

    const nextRole = steps.find((s) => s.status === "PENDING")?.role;

    return {
      approval: updatedApproval,
      quotation: updatedQuotation,
      chainComplete,
      nextRole,
    };
  }
}

export const approvalApplicationService = new ApprovalApplicationService();
