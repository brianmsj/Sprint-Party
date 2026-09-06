import type { ServiceNowErrorCode } from "./types";

/**
 * Raised anywhere inside the ServiceNow integration. Carries a stable machine
 * `code` plus the HTTP `status` the API route should return, and an optional
 * `detail` string that is always safe to show a user (no credentials).
 */
export class ServiceNowError extends Error {
  readonly code: ServiceNowErrorCode;
  readonly status: number;
  readonly detail?: string;

  constructor(
    code: ServiceNowErrorCode,
    message: string,
    status: number,
    detail?: string,
  ) {
    super(message);
    this.name = "ServiceNowError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}
