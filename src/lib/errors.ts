/** Domain errors mapped to friendly copy in the UI layer. */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = code;
  }
}

export const DiscountLimitExceeded = (detail: string) =>
  new DomainError("DiscountLimitExceeded", detail);
export const ApprovalRequired = (detail: string) =>
  new DomainError("ApprovalRequired", detail);
export const InvalidStateTransition = (from: string, to: string) =>
  new DomainError(
    "InvalidStateTransition",
    `This deal cannot move from ${from.toLowerCase().replace("_", " ")} to ${to
      .toLowerCase()
      .replace("_", " ")}.`,
  );
export const InsufficientStock = (detail: string) =>
  new DomainError("InsufficientStock", detail);
export const InvalidPayment = (detail: string) => new DomainError("InvalidPayment", detail);
export const SubscriptionModificationInvalid = (detail: string) =>
  new DomainError("SubscriptionModificationInvalid", detail);
export const UnauthorizedCustomerAccess = (detail = "Unauthorized access to customer resource.") =>
  new DomainError("UnauthorizedCustomerAccess", detail);

export function friendlyMessage(error: unknown) {
  if (error instanceof DomainError || error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
