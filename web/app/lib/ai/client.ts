/**
 * Server-side OpenAI integration for SprintParty AI.
 *
 * This module must only ever be imported from server code (the API route).
 * `OPENAI_API_KEY` is read from the server environment here and nowhere else,
 * is never returned to a caller, and is never logged.
 */

import OpenAI from "openai";
import { AiError } from "./errors";
import {
  OPENAI_MAX_OUTPUT_TOKENS,
  OPENAI_MODEL,
  OPENAI_TIMEOUT_MS,
  resolveOpenAiApiKey,
} from "./config";
import type { StoryReadiness, StoryReview, StoryReviewInput } from "./types";

/**
 * Persona + guardrails. Kept deliberately strict about *not* inventing facts and
 * *not* estimating, per the SprintParty refinement product spec.
 */
const SYSTEM_INSTRUCTIONS = `You are acting as an experienced Scrum Master who is also a ServiceNow technical architect, helping a team run backlog refinement on a single user story.

Your job: help the team decide whether the story is ready to estimate and surface what they should discuss. You are NOT estimating the story. Never provide or imply a story point value, a t-shirt size, an hours figure, or any other effort number.

Rules:
- Work only from the story text provided. Do not invent requirements, systems, integrations, users, or constraints that are not stated or clearly implied.
- When something is unknown or ambiguous, say so explicitly instead of guessing.
- If a field is empty, treat it as missing information, not as licence to speculate.
- Prefer concrete, answerable questions the team can actually resolve in the session.
- Keep every item short and practical: one or two sentences, no filler, no restating the story back.
- If an array has no genuine items, return an empty array. Do not pad lists.
- readiness: "ready" only if the story is clear, testable, and has acceptance criteria; "needs_clarification" if it is mostly there but has open questions; "not_ready" if key information is missing or the story is too large or too vague to estimate.
- splitRecommendation: if the story is appropriately sized, say so in one sentence; otherwise suggest concrete seams it could be split along.`;

/**
 * JSON Schema enforced on the model via Structured Outputs. Mirrors
 * `StoryReview` in ./types exactly.
 */
const STORY_REVIEW_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "readiness",
    "summary",
    "questions",
    "missingInformation",
    "risks",
    "dependencies",
    "qaConsiderations",
    "splitRecommendation",
  ],
  properties: {
    readiness: {
      type: "string",
      enum: ["ready", "needs_clarification", "not_ready"],
      description: "Overall readiness of the story for estimation.",
    },
    summary: {
      type: "string",
      description: "Short, plain-language summary of the story as written.",
    },
    questions: {
      type: "array",
      items: { type: "string" },
      description: "Questions the team should discuss during refinement.",
    },
    missingInformation: {
      type: "array",
      items: { type: "string" },
      description: "Concrete information that is absent and needed before estimation.",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Risks and unknowns worth calling out.",
    },
    dependencies: {
      type: "array",
      items: { type: "string" },
      description: "Likely dependencies: systems, teams, sequencing.",
    },
    qaConsiderations: {
      type: "array",
      items: { type: "string" },
      description: "QA and testing considerations.",
    },
    splitRecommendation: {
      type: "string",
      description: "Practical guidance on whether and how to split the story.",
    },
  },
};

/** Build the (credential-free) OpenAI client, or fail with a safe error. */
function createClient(): OpenAI {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    throw new AiError(
      "AI_NOT_CONFIGURED",
      "SprintParty AI is not configured on the server.",
      503,
      "Set OPENAI_API_KEY in web/.env.local and restart the dev server.",
    );
  }
  return new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 1,
  });
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Defensively coerce the parsed model output into a well-formed `StoryReview`. */
function normalizeReview(value: unknown): StoryReview {
  const raw = (value ?? {}) as Record<string, unknown>;
  const readiness: StoryReadiness =
    raw.readiness === "ready" || raw.readiness === "not_ready"
      ? raw.readiness
      : "needs_clarification";

  return {
    readiness,
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    questions: toStringArray(raw.questions),
    missingInformation: toStringArray(raw.missingInformation),
    risks: toStringArray(raw.risks),
    dependencies: toStringArray(raw.dependencies),
    qaConsiderations: toStringArray(raw.qaConsiderations),
    splitRecommendation:
      typeof raw.splitRecommendation === "string"
        ? raw.splitRecommendation.trim()
        : "",
  };
}

function buildInput(story: StoryReviewInput): string {
  return [
    `Story number: ${story.number.trim() || "(none)"}`,
    `Short description: ${story.shortDescription.trim()}`,
    "",
    "Description:",
    story.description.trim() || "(empty)",
    "",
    "Acceptance criteria:",
    story.acceptanceCriteria.trim() || "(empty)",
  ].join("\n");
}

/** Map an OpenAI SDK failure onto a safe `AiError`. Never rethrows raw. */
function mapOpenAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  if (error instanceof OpenAI.APIError) {
    // Log status/code only — never the request body or headers.
    console.error("[sprintparty-ai] OpenAI API error", {
      status: error.status,
      code: error.code,
    });

    if (error.status === 401 || error.status === 403) {
      return new AiError(
        "AI_UPSTREAM_ERROR",
        "The AI service rejected the request. Check the server API key configuration.",
        502,
      );
    }
    if (error.status === 404) {
      return new AiError(
        "AI_UPSTREAM_ERROR",
        `The configured AI model ("${OPENAI_MODEL}") is not available for this account.`,
        502,
        "Set OPENAI_MODEL in the server environment to a model you can access.",
      );
    }
    if (error.status === 429) {
      return new AiError(
        "AI_RATE_LIMITED",
        "The AI service is rate limited right now. Try again in a moment.",
        429,
      );
    }
    return new AiError(
      "AI_UPSTREAM_ERROR",
      "The AI service returned an error while reviewing the story.",
      502,
    );
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiError(
      "AI_TIMEOUT",
      "The AI request timed out. Try again.",
      504,
    );
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AiError(
      "AI_UPSTREAM_ERROR",
      "Could not reach the AI service.",
      502,
    );
  }

  console.error(
    "[sprintparty-ai] Unexpected error during story review:",
    error instanceof Error ? error.message : "unknown error",
  );
  return new AiError(
    "AI_UNKNOWN",
    "An unexpected error occurred while contacting the AI service.",
    500,
  );
}

/**
 * Run one refinement review against the OpenAI Responses API and return a
 * structured `StoryReview`. Logs token usage (never story content) for each
 * call. Throws `AiError` on every failure path.
 */
export async function reviewStory(story: StoryReviewInput): Promise<StoryReview> {
  const client = createClient();

  let response;
  try {
    response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      input: buildInput(story),
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: "story_review",
          strict: true,
          schema: STORY_REVIEW_SCHEMA,
        },
      },
    });
  } catch (error) {
    throw mapOpenAiError(error);
  }

  // Usage observability: model + token counts only. No story content, no key.
  const usage = response.usage;
  console.info("[sprintparty-ai] story-review call complete", {
    model: response.model || OPENAI_MODEL,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  });

  if (response.status === "incomplete") {
    throw new AiError(
      "AI_BAD_RESPONSE",
      "The AI response was cut off before it finished. Try again.",
      502,
      response.incomplete_details?.reason,
    );
  }

  const text = response.output_text?.trim();
  if (!text) {
    throw new AiError(
      "AI_BAD_RESPONSE",
      "The AI did not return a usable review.",
      502,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError(
      "AI_BAD_RESPONSE",
      "The AI returned a response that could not be parsed as JSON.",
      502,
    );
  }

  return normalizeReview(parsed);
}
