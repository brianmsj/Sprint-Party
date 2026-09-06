/**
 * Central configuration for the SprintParty AI integration.
 *
 * Everything model-specific lives here so it is trivial to retarget the feature
 * at a different OpenAI model without touching the route or client code.
 */

/**
 * The OpenAI model used for every SprintParty AI call.
 *
 * Requested target: `gpt-5.6-terra`. If that exact model id is not enabled for
 * your OpenAI account/org yet, override it *without a code change* by setting
 * `OPENAI_MODEL` in `web/.env.local` (server-side only), e.g.
 *
 *     OPENAI_MODEL=gpt-5.6
 *
 * The env var wins; the constant below is the default.
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra";

/**
 * Resolve the OpenAI API key from the server environment.
 *
 * The canonical name is `OPENAI_API_KEY`. `OPEN_API_KEY` is accepted as a
 * fallback because that is the name currently present in this project's
 * `.env.local`; prefer `OPENAI_API_KEY` going forward. This is the ONLY place
 * the key is read, and the value is never logged or returned to a client.
 */
export function resolveOpenAiApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_API_KEY?.trim();
  return key || undefined;
}

/**
 * Upper bound on tokens generated per call (includes reasoning tokens on
 * reasoning-capable models). Keeps a single refinement review inexpensive and
 * bounded; raise if responses come back truncated.
 */
export const OPENAI_MAX_OUTPUT_TOKENS = 3000;

/** Hard ceiling on any single free-text input field, in characters. */
export const MAX_FIELD_CHARS = 8000;

/** Wall-clock timeout for the OpenAI request, in milliseconds. */
export const OPENAI_TIMEOUT_MS = 60_000;
