import type { AiErrorCode } from "./types";

/**
 * Raised anywhere inside the SprintParty AI integration. Carries a stable
 * machine `code`, the HTTP `status` the API route should return, and an
 * optional `detail` string that is always safe to show a user.
 *
 * Nothing here ever carries a credential or a raw upstream error object.
 */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly detail?: string;

  constructor(
    code: AiErrorCode,
    message: string,
    status: number,
    detail?: string,
  ) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}
