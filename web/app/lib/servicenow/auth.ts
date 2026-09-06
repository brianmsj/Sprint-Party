/**
 * ServiceNow authentication — SERVER ONLY.
 *
 * This is the single place that knows *how* SprintParty authenticates to
 * ServiceNow. Today it reads a username / password from server environment
 * variables and builds an HTTP Basic header. To move to OAuth later, replace the
 * body of `getServiceNowConnection` (e.g. exchange a stored refresh token for a
 * bearer token and return `Authorization: Bearer …`). The REST client, the API
 * route, and the entire UI stay unchanged.
 */

import { ServiceNowError } from "./errors";

export interface ServiceNowConnection {
  /** Instance base URL, guaranteed to have no trailing slash. */
  instanceUrl: string;
  /** Headers to attach to every ServiceNow REST call (auth + accept). */
  headers: Record<string, string>;
}

/**
 * Resolve the base URL and auth headers needed to call ServiceNow.
 *
 * @throws {ServiceNowError} `SERVICENOW_NOT_CONFIGURED` when run in the browser
 *   or when any of the three environment variables is missing.
 */
export async function getServiceNowConnection(): Promise<ServiceNowConnection> {
  if (typeof window !== "undefined") {
    // Defensive: this module must never run in browser code.
    throw new ServiceNowError(
      "SERVICENOW_NOT_CONFIGURED",
      "ServiceNow credentials can only be used on the server.",
      500,
    );
  }

  const instanceUrl = process.env.SERVICENOW_INSTANCE_URL?.trim().replace(
    /\/+$/,
    "",
  );
  const username = process.env.SERVICENOW_USERNAME?.trim();
  const password = process.env.SERVICENOW_PASSWORD;

  const missing: string[] = [];
  if (!instanceUrl) missing.push("SERVICENOW_INSTANCE_URL");
  if (!username) missing.push("SERVICENOW_USERNAME");
  if (!password) missing.push("SERVICENOW_PASSWORD");

  if (!instanceUrl || !username || !password) {
    throw new ServiceNowError(
      "SERVICENOW_NOT_CONFIGURED",
      "The ServiceNow integration is not configured on the server.",
      500,
      `Missing environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and fill them in.",
    );
  }

  const basic = Buffer.from(`${username}:${password}`).toString("base64");

  return {
    instanceUrl,
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
  };
}
