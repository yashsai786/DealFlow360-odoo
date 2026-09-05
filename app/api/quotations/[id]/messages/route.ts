import { resolveActor } from "@/application/resolveActor";
import { quotationRepository, auditRepository, domainEventRepository } from "@/infrastructure/repositories/prismaRepositories";
import { enforceQuotationOwnership } from "@/application/authorizationGuard";
import { apiSuccess, apiError } from "@/lib/api/contracts/schemas";
import type { NegotiationMessage } from "@/modules/shared/types";

interface RouteContext {
  params: {
    id: string;
  };
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await resolveActor(req);
    const quotationId = context.params.id;
    const body = await req.json().catch(() => ({}));
    const messageText = typeof body?.body === "string" ? body.body.trim() : "";

    if (!messageText) {
      return apiError("VALIDATION_ERROR", "Message body cannot be empty", 400);
    }

    const quotation = await quotationRepository.findById(quotationId);
    if (!quotation) {
      return apiError("NOT_FOUND", `Quotation '${quotationId}' not found`, 404);
    }

    enforceQuotationOwnership(actor, quotation, false);

    const newMessage: NegotiationMessage = {
      id: uid("msg"),
      author: actor.name,
      role: actor.role,
      body: messageText,
      quotationId: quotation.id,
      at: now(),
    };

    const updatedMessages = [...(quotation.messages || []), newMessage];
    const updatedQuotation = await quotationRepository.update(quotation.id, {
      messages: updatedMessages,
    });

    await auditRepository.record({
      id: uid("aud"),
      entity: "Quotation",
      entityId: quotation.id,
      actor: actor.name,
      action: "Sent message",
      reason: messageText.slice(0, 100),
      at: now(),
    });

    await domainEventRepository.emit({
      id: uid("evt"),
      name: "NegotiationMessageSent",
      payload: quotation.number,
      at: now(),
    });

    return apiSuccess({
      quotation: updatedQuotation,
      message: newMessage,
    });
  } catch (err: any) {
    const status =
      err?.message?.includes("Access denied") || err?.message?.includes("isolation")
        ? 403
        : err?.message?.includes("not found")
        ? 404
        : 500;
    return apiError("MESSAGE_SEND_ERROR", err?.message || "Failed to send message", status);
  }
}
