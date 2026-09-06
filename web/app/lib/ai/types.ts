/**
 * Shared AI types — safe to import from both server and client code.
 * (No server-only imports, no SDK imports belong in this file.)
 */

/** Fields the client sends to `POST /api/ai/story-review`. */
export interface StoryReviewInput {
  /** External reference, e.g. ServiceNow `STRY0010002`. May be empty for manual stories. */
  number: string;
  /** `short_description` / story title. Required. */
  shortDescription: string;
  /** Story narrative / description. Required. */
  description: string;
  /** Acceptance criteria, free text (often one item per line). May be empty. */
  acceptanceCriteria: string;
}

export type StoryReadiness = "ready" | "needs_clarification" | "not_ready";

/**
 * The structured refinement review produced by the model. Shapes 1:1 with the
 * JSON schema enforced on the OpenAI Responses call.
 */
export interface StoryReview {
  readiness: StoryReadiness;
  /** Short, plain-language summary of the story as written. */
  summary: string;
  /** Questions the team should discuss during refinement. */
  questions: string[];
  /** Concrete information that is absent and needed before estimation. */
  missingInformation: string[];
  /** Risks and unknowns worth calling out. */
  risks: string[];
  /** Likely dependencies (systems, teams, sequencing). */
  dependencies: string[];
  /** QA / testing considerations. */
  qaConsiderations: string[];
  /** Practical guidance on whether/how to split the story. */
  splitRecommendation: string;
}

/** Success payload from `POST /api/ai/story-review`. */
export interface StoryReviewSuccess {
  review: StoryReview;
}

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_INVALID_INPUT"
  | "AI_BAD_RESPONSE"
  | "AI_RATE_LIMITED"
  | "AI_UPSTREAM_ERROR"
  | "AI_TIMEOUT"
  | "AI_UNKNOWN";

/** Error payload from `POST /api/ai/story-review`. */
export interface StoryReviewError {
  error: {
    code: AiErrorCode;
    /** Short, user-facing summary. Never contains secrets. */
    message: string;
    /** Optional extra detail, safe for display. */
    detail?: string;
  };
}

export type StoryReviewResponse = StoryReviewSuccess | StoryReviewError;

/** Narrowing helper for the discriminated response. */
export function isStoryReviewError(
  body: StoryReviewResponse,
): body is StoryReviewError {
  return "error" in body;
}
