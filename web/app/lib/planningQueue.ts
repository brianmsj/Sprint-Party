/**
 * The Planning Queue: an ordered, deduplicated list of stories a team has picked
 * to refine in their next SprintParty, independent of where those stories came
 * from (ServiceNow today; Jira / Azure DevOps later).
 *
 * Storage mirrors `rooms.ts` — a localStorage-backed value with a parsed cache
 * and a `subscribe` hook — so `useSyncExternalStore` can read it and so the
 * whole module can later be swapped for Supabase without touching callers.
 */

import type { AddStoryInput, StorySource } from "./rooms";

export interface QueuedStory {
  /** Dedupe key, `"<source>:<externalId>"` — stable across re-adds. */
  key: string;
  source: StorySource;
  /** External system id (ServiceNow `sys_id`). */
  externalId: string;
  /** External reference shown to people (ServiceNow `number`, e.g. `STRY0010002`). */
  externalNumber: string;
  /** `short_description`. */
  title: string;
  /** `description`, already normalized to plain text by the source adapter. */
  description: string;
  /** `acceptance_criteria`, already normalized to plain text. */
  acceptanceCriteria: string;
  /** `story_points`, or `null` when unestimated. */
  storyPoints: number | null;
  addedAt: number;
}

const STORAGE_KEY = "sprintparty:planning-queue";

/* -------------------------------------------------------------------------- */
/*  Storage layer                                                            */
/* -------------------------------------------------------------------------- */

let cache: { raw: string | null; value: QueuedStory[] } = {
  raw: null,
  value: [],
};

function normalizeEntry(value: unknown): QueuedStory | null {
  const raw = (value ?? {}) as Partial<QueuedStory>;
  if (!raw.externalId) return null;

  const source: StorySource = raw.source === "servicenow" ? "servicenow" : "manual";

  return {
    key: typeof raw.key === "string" ? raw.key : `${source}:${raw.externalId}`,
    source,
    externalId: raw.externalId,
    externalNumber: raw.externalNumber ?? "",
    title: raw.title ?? "",
    description: raw.description ?? "",
    acceptanceCriteria: raw.acceptanceCriteria ?? "",
    storyPoints:
      typeof raw.storyPoints === "number" ? raw.storyPoints : null,
    addedAt: typeof raw.addedAt === "number" ? raw.addedAt : Date.now(),
  };
}

function readQueue(): QueuedStory[] {
  if (typeof window === "undefined") return [];

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw !== cache.raw) {
    try {
      const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];
      const value = Array.isArray(parsed)
        ? parsed
            .map(normalizeEntry)
            .filter((entry): entry is QueuedStory => entry !== null)
        : [];
      cache = { raw, value };
    } catch {
      cache = { raw, value: [] };
    }
  }

  return cache.value;
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to queue changes (this tab's writes + other tabs via `storage`). */
export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function writeQueue(next: QueuedStory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore write failures (private mode, quota, …).
  }
  emit();
}

/* -------------------------------------------------------------------------- */
/*  Public API (pure reads + explicit mutations)                             */
/* -------------------------------------------------------------------------- */

export function loadQueue(): QueuedStory[] {
  return readQueue();
}

/**
 * Append stories to the end of the queue, preserving order and skipping any
 * whose `key` is already queued. Safe to call repeatedly with overlapping sets.
 */
export function addStoriesToQueue(stories: QueuedStory[]): void {
  const current = readQueue();
  const seen = new Set(current.map((story) => story.key));

  const additions = stories.filter((story) => {
    if (seen.has(story.key)) return false;
    seen.add(story.key);
    return true;
  });

  if (additions.length === 0) return;
  writeQueue([...current, ...additions]);
}

export function removeFromQueue(key: string): void {
  const current = readQueue();
  const next = current.filter((story) => story.key !== key);
  if (next.length !== current.length) writeQueue(next);
}

export function clearQueue(): void {
  if (readQueue().length === 0) return;
  writeQueue([]);
}

/** Move a story one position toward the front or back. No-op at the ends. */
export function moveInQueue(key: string, direction: "up" | "down"): void {
  const current = readQueue();
  const index = current.findIndex((story) => story.key === key);
  if (index === -1) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= current.length) return;

  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  writeQueue(next);
}

/* -------------------------------------------------------------------------- */
/*  Mapping into the generic Planning Poker story model                      */
/* -------------------------------------------------------------------------- */

/**
 * Convert a queued story into the engine's `AddStoryInput`. This is the only
 * place the field mapping lives:
 *
 *   short_description  -> title
 *   description        -> userStory
 *   acceptance_criteria-> acceptanceCriteria
 *   number / sys_id / story_points -> origin.*
 */
export function queuedStoryToAddStoryInput(story: QueuedStory): AddStoryInput {
  return {
    title: story.title,
    userStory: story.description,
    acceptanceCriteria: story.acceptanceCriteria,
    origin: {
      source: story.source,
      externalId: story.externalId,
      externalNumber: story.externalNumber,
      externalPoints: story.storyPoints,
    },
  };
}
