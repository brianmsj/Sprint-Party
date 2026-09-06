/**
 * ServiceNow REST client — SERVER ONLY.
 *
 * Knows the `rm_story` table shape and how to turn a raw Table API response into
 * `ServiceNowStory[]`. It does not know how auth works — that lives in
 * `./auth.ts` behind `getServiceNowConnection()`.
 */

import { getServiceNowConnection } from "./auth";
import { ServiceNowError } from "./errors";
import { htmlToPlainText } from "./normalize";
import type { ServiceNowStory } from "./types";

const STORY_TABLE = "rm_story";

/** The six verified fields, requested via `sysparm_fields`. */
const STORY_FIELDS = [
  "sys_id",
  "number",
  "short_description",
  "description",
  "acceptance_criteria",
  "story_points",
] as const;

const STORY_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 15_000;

interface RawStoryRecord {
  sys_id?: string;
  number?: string;
  short_description?: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: string;
}

function parseStoryPoints(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStory(record: RawStoryRecord): ServiceNowStory {
  return {
    sysId: record.sys_id ?? "",
    number: record.number ?? "",
    shortDescription: (record.short_description ?? "").trim(),
    description: htmlToPlainText(record.description),
    acceptanceCriteria: htmlToPlainText(record.acceptance_criteria),
    storyPoints: parseStoryPoints(record.story_points),
  };
}

/**
 * Fetch up to 100 Agile stories from the ServiceNow Table API.
 *
 * @throws {ServiceNowError} with a stable `code` + HTTP `status` for:
 *   - `SERVICENOW_NOT_CONFIGURED` — env vars missing
 *   - `SERVICENOW_AUTH_FAILED` — ServiceNow rejected the credentials (401/403)
 *   - `SERVICENOW_UNREACHABLE` — DNS / network failure / timeout / hibernating PDI
 *   - `SERVICENOW_API_ERROR` — any other non-2xx or unparseable response
 */
export async function fetchServiceNowStories(): Promise<ServiceNowStory[]> {
  const { instanceUrl, headers } = await getServiceNowConnection();

  const url = new URL(`${instanceUrl}/api/now/table/${STORY_TABLE}`);
  url.searchParams.set("sysparm_fields", STORY_FIELDS.join(","));
  url.searchParams.set("sysparm_limit", String(STORY_LIMIT));
  url.searchParams.set("sysparm_display_value", "false");
  url.searchParams.set("sysparm_exclude_reference_link", "true");

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ServiceNowError(
      "SERVICENOW_UNREACHABLE",
      "Could not reach the ServiceNow instance. Check SERVICENOW_INSTANCE_URL and that the instance is awake.",
      504,
      cause instanceof Error ? cause.message : undefined,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ServiceNowError(
      "SERVICENOW_AUTH_FAILED",
      "ServiceNow rejected the credentials. Check SERVICENOW_USERNAME and SERVICENOW_PASSWORD, and that the user can read rm_story.",
      502,
      `ServiceNow responded with HTTP ${response.status}.`,
    );
  }

  if (!response.ok) {
    throw new ServiceNowError(
      "SERVICENOW_API_ERROR",
      "ServiceNow returned an error while listing stories.",
      502,
      (await readServiceNowErrorDetail(response)) ??
        `ServiceNow responded with HTTP ${response.status}.`,
    );
  }

  let payload: { result?: RawStoryRecord[] };
  try {
    payload = (await response.json()) as { result?: RawStoryRecord[] };
  } catch (cause) {
    throw new ServiceNowError(
      "SERVICENOW_API_ERROR",
      "ServiceNow returned a response that could not be parsed as JSON.",
      502,
      cause instanceof Error ? cause.message : undefined,
    );
  }

  const result = Array.isArray(payload.result) ? payload.result : [];
  return result.map(toStory);
}

/** ServiceNow errors look like `{ "error": { "message", "detail" }, "status": "failure" }`. */
async function readServiceNowErrorDetail(
  response: Response,
): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; detail?: string };
    };
    const parts = [body.error?.message, body.error?.detail].filter(Boolean);
    return parts.length > 0 ? parts.join(" — ") : undefined;
  } catch {
    return undefined;
  }
}
