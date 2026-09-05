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
  NegotiationMessage,
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

    if (actor.role === "SALES_REP") {
      throw new Error("Access denied: You do not have permission to authorize commercial approval terms.");
    }

    const step = approval.steps[stepIndex]!;
    if (actor.role !== "ADMIN" && step.role !== actor.role) {
      throw new Error(`Access denied: This step is waiting on ${step.role.replace("_", " ")}.`);
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
        const approvedMsg: NegotiationMessage = {
          id: uid("msg"),
          author: `${actor.name} (${step.role.replace("_", " ")})`,
          role: actor.role,
          body: `All commercial terms approved by ${step.role.replace("_", " ")}.`,
          quotationId: quotation.id,
          at: now(),
        };
        updatedQuotation = await quotationRepository.update(quotation.id, {
          stage: "APPROVED",
          messages: [...(quotation.messages || []), approvedMsg],
        });
        await domainEventRepository.emit({
          id: uid("evt"),
          name: "QuotationApproved",
          payload: quotation.number,
          at: now(),
        });
      } else if (decision === "RETURNED") {
        const returnMsg: NegotiationMessage = {
          id: uid("msg"),
          author: `${actor.name} (${step.role.replace("_", " ")})`,
          role: actor.role,
          body: `[Revision Required by ${step.role.replace("_", " ")}]: ${reason?.trim()}`,
          quotationId: quotation.id,
          at: now(),
        };
        updatedQuotation = await quotationRepository.update(quotation.id, {
          stage: "DRAFT",
          messages: [...(quotation.messages || []), returnMsg],
        });
        await domainEventRepository.emit({
          id: uid("evt"),
          name: "ApprovalReturned",
          payload: quotation.number,
          at: now(),
        });
      } else if (decision === "REJECTED") {
        const rejectMsg: NegotiationMessage = {
          id: uid("msg"),
          author: `${actor.name} (${step.role.replace("_", " ")})`,
          role: actor.role,
          body: `[Proposal Rejected by ${step.role.replace("_", " ")}]: ${reason?.trim()}`,
          quotationId: quotation.id,
          at: now(),
        };
        updatedQuotation = await quotationRepository.update(quotation.id, {
          stage: "CANCELLED",
          messages: [...(quotation.messages || []), rejectMsg],
        });
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
