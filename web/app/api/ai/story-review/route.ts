import { NextResponse } from "next/server";
import { reviewStory } from "@/app/lib/ai/client";
import { AiError } from "@/app/lib/ai/errors";
import { MAX_FIELD_CHARS } from "@/app/lib/ai/config";
import type {
  StoryReviewError,
  StoryReviewInput,
  StoryReviewSuccess,
} from "@/app/lib/ai/types";

// Talks to OpenAI with server-only credentials — never cache, always run live.
export const dynamic = "force-dynamic";
export const revalidate = 0;
// The OpenAI SDK needs Node APIs; keep this off the Edge runtime.
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function errorResponse(error: AiError) {
  const body: StoryReviewError = {
    error: {
      code: error.code,
      message: error.message,
      detail: error.detail,
    },
  };
  return NextResponse.json(body, { status: error.status, headers: NO_STORE });
}

/**
 * Validate and normalize the request body into a `StoryReviewInput`.
 *
 * `shortDescription` and `description` are required (the model needs something
 * real to react to). `number` and `acceptanceCriteria` are optional — a manual
 * story may have no external number, and "no acceptance criteria" is itself a
 * useful signal for the review. Every field is length-capped so a single call
 * stays bounded.
 */
function parseInput(payload: unknown): StoryReviewInput {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Request body must be a JSON object.",
      400,
    );
  }

  const record = payload as Record<string, unknown>;

  const readField = (key: keyof StoryReviewInput, required: boolean): string => {
    const value = record[key];
    if (value === undefined || value === null) {
      if (required) {
        throw new AiError(
          "AI_INVALID_INPUT",
          `Missing required field: "${key}".`,
          400,
        );
      }
      return "";
    }
    if (typeof value !== "string") {
      throw new AiError(
        "AI_INVALID_INPUT",
        `Field "${key}" must be a string.`,
        400,
      );
    }
    if (value.length > MAX_FIELD_CHARS) {
      throw new AiError(
        "AI_INVALID_INPUT",
        `Field "${key}" is too long (max ${MAX_FIELD_CHARS} characters).`,
        400,
      );
    }
    return value;
  };

  const shortDescription = readField("shortDescription", true).trim();
  const description = readField("description", true).trim();
  if (!shortDescription) {
    throw new AiError(
      "AI_INVALID_INPUT",
      'Field "shortDescription" cannot be empty.',
      400,
    );
  }
  if (!description) {
    throw new AiError(
      "AI_INVALID_INPUT",
      'Field "description" cannot be empty.',
      400,
    );
  }

  return {
    number: readField("number", false).trim(),
    shortDescription,
    description,
    acceptanceCriteria: readField("acceptanceCriteria", false),
  };
}

/**
 * POST /api/ai/story-review
 *
 * Body: `{ number, shortDescription, description, acceptanceCriteria }`.
 * Returns `{ review }` (see `StoryReview`) or `{ error: { code, message } }`.
 * The OpenAI API key is read only on the server and never included in any
 * response or log line.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(
      new AiError("AI_INVALID_INPUT", "Request body must be valid JSON.", 400),
    );
  }

  try {
    const input = parseInput(payload);
    const review = await reviewStory(input);
    const body: StoryReviewSuccess = { review };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AiError) {
      return errorResponse(error);
    }
    // reviewStory only throws AiError; this is a genuine surprise.
    console.error("[sprintparty-ai] Unhandled error in POST /api/ai/story-review");
    return errorResponse(
      new AiError("AI_UNKNOWN", "An unexpected error occurred.", 500),
    );
  }
}
