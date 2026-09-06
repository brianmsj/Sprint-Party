/**
 * Shared ServiceNow types — safe to import from both server and client code.
 * (No server-only imports belong in this file.)
 */

/**
 * A single Agile story retrieved from ServiceNow (`rm_story` table),
 * normalized by the server for display.
 */
export interface ServiceNowStory {
  /** ServiceNow `sys_id` — stable unique identifier. */
  sysId: string;
  /** Human-facing record number, e.g. `STRY0010001`. */
  number: string;
  /** `short_description` — the story title. */
  shortDescription: string;
  /** `description`, normalized to safe plain text (tags stripped, entities decoded). */
  description: string;
  /** `acceptance_criteria`, normalized to safe plain text. */
  acceptanceCriteria: string;
  /** `story_points` as a number, or `null` when blank / unestimated. */
  storyPoints: number | null;
}

/** Success payload from `GET /api/servicenow/stories`. */
export interface ServiceNowStoriesSuccess {
  stories: ServiceNowStory[];
}

export type ServiceNowErrorCode =
  | "SERVICENOW_NOT_CONFIGURED"
  | "SERVICENOW_AUTH_FAILED"
  | "SERVICENOW_UNREACHABLE"
  | "SERVICENOW_API_ERROR"
  | "SERVICENOW_UNKNOWN";

/** Error payload from `GET /api/servicenow/stories`. */
export interface ServiceNowStoriesError {
  error: {
    code: ServiceNowErrorCode;
    /** Short, user-facing summary. */
    message: string;
    /** Optional upstream detail, safe for display (never contains credentials). */
    detail?: string;
  };
}

export type ServiceNowStoriesResponse =
  | ServiceNowStoriesSuccess
  | ServiceNowStoriesError;

/** Narrowing helper for the discriminated response. */
export function isServiceNowError(
  body: ServiceNowStoriesResponse,
): body is ServiceNowStoriesError {
  return "error" in body;
}
