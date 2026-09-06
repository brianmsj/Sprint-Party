/**
 * Local, dependency-free store for the SprintParty prototype.
 *
 * Product model: a room is a *persistent* planning session for a team. A room is
 * not created per story — it holds a sequence of stories the team estimates one
 * at a time, plus the history of completed ones.
 *
 * Everything here is intentionally small and framework-agnostic so it can be
 * swapped for Supabase (realtime rooms, stories and votes) later without
 * touching the UI: components depend only on the exported types and functions.
 */

export const FIBONACCI_DECK = ["1", "2", "3", "5", "8", "13", "21", "?"] as const;

export type FibonacciCard = (typeof FIBONACCI_DECK)[number];

export type StoryStatus = "voting" | "completed";

/**
 * Where a story came from. The Planning Poker engine is source-agnostic — it
 * never branches on this — but adapters (ServiceNow today; Jira / Azure DevOps
 * later) stamp it so the UI can show the external reference and we can wire up
 * write-back per source in the future.
 */
export type StorySource = "manual" | "servicenow";

export interface StoryOrigin {
  source: StorySource;
  /** Stable external identifier (ServiceNow `sys_id`, Jira id, …). */
  externalId?: string;
  /** Human-facing external reference (ServiceNow `number`, e.g. `STRY0010002`). */
  externalNumber?: string;
  /** Estimate the source system already carried, if any. */
  externalPoints?: number | null;
}

/** How the room drives its story list once no story is active. */
export type RoomFlow = "manual" | "queue";

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Story {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string;
  /** Provenance — defaults to `{ source: "manual" }`. */
  origin: StoryOrigin;
  createdAt: number;
  completedAt: number | null;
  status: StoryStatus;
  /** Votes stay hidden in the UI until this is `true`. */
  revealed: boolean;
  /** participantId -> selected card. */
  votes: Record<string, FibonacciCard>;
}

export interface Room {
  slug: string;
  /** Optional friendly name; `""` when the host didn't provide one. */
  name: string;
  hostName: string;
  createdAt: number;
  /**
   * `"manual"`: when no story is active, prompt the host to add one (default).
   * `"queue"`: the room was seeded from a pre-populated queue; when the queue is
   * exhausted, show the "Planning complete" summary instead of an add form.
   */
  flow: RoomFlow;
  participants: Participant[];
  /** Every story ever added, in creation order (history + current). */
  stories: Story[];
  /** The story currently being voted on, or `null` when none is active. */
  activeStoryId: string | null;
}

export interface CreateRoomInput {
  hostName: string;
  roomName: string;
  /** Optionally seed the room with a story queue (e.g. from ServiceNow). */
  stories?: AddStoryInput[];
  /** Defaults to `"queue"` when `stories` is non-empty, otherwise `"manual"`. */
  flow?: RoomFlow;
}

export interface AddStoryInput {
  title: string;
  userStory: string;
  acceptanceCriteria: string;
  /** Defaults to `{ source: "manual" }`. */
  origin?: StoryOrigin;
}

const STORAGE_KEY = "sprintparty:rooms";

const ADJECTIVES = [
  "agile",
  "bold",
  "brave",
  "bright",
  "brisk",
  "calm",
  "clever",
  "cosmic",
  "daring",
  "eager",
  "fluent",
  "gentle",
  "jolly",
  "keen",
  "lively",
  "lucky",
  "mighty",
  "nimble",
  "plucky",
  "quick",
  "rapid",
  "sharp",
  "snappy",
  "stellar",
  "sunny",
  "swift",
  "witty",
  "zesty",
] as const;

const NOUNS = [
  "badger",
  "comet",
  "crane",
  "eagle",
  "falcon",
  "finch",
  "fox",
  "gecko",
  "hawk",
  "heron",
  "ibex",
  "koala",
  "lynx",
  "marmot",
  "moose",
  "narwhal",
  "otter",
  "panda",
  "puffin",
  "quokka",
  "raven",
  "sloth",
  "stoat",
  "tapir",
  "tiger",
  "wren",
  "yak",
] as const;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Produces a short, human-readable slug such as `agile-fox-4821`. */
export function generateSlug(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${randomItem(ADJECTIVES)}-${randomItem(NOUNS)}-${suffix}`;
}

/* -------------------------------------------------------------------------- */
/*  Storage layer                                                            */
/* -------------------------------------------------------------------------- */

type RoomMap = Record<string, Room>;

/**
 * Parsed-value cache so `loadRoom` returns a stable reference while the
 * underlying storage string is unchanged — required for `useSyncExternalStore`
 * consumers, and a natural seam for a Supabase-backed cache later.
 */
let cache: { raw: string | null; map: RoomMap } = { raw: null, map: {} };

function readAll(): RoomMap {
  if (typeof window === "undefined") return {};

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw !== cache.raw) {
    try {
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const map: RoomMap = {};
      for (const [slug, value] of Object.entries(parsed)) {
        map[slug] = normalizeRoom(slug, value);
      }
      cache = { raw, map };
    } catch {
      cache = { raw, map: {} };
    }
  }

  return cache.map;
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to room changes (this tab's writes + other tabs via `storage`). */
export function subscribeRooms(listener: () => void): () => void {
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

function writeAll(rooms: RoomMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Ignore write failures (private mode, quota exceeded, etc.).
  }
  emit();
}

export function loadRoom(slug: string): Room | null {
  return readAll()[slug] ?? null;
}

export function saveRoom(room: Room): void {
  writeAll({ ...readAll(), [room.slug]: room });
}

/* -------------------------------------------------------------------------- */
/*  Migration / normalization                                                */
/* -------------------------------------------------------------------------- */

type LegacyParticipant = {
  id?: string;
  name?: string;
  isHost?: boolean;
  vote?: FibonacciCard | null;
};

/** Anything that might be sitting in localStorage from a previous version. */
type StoredRoom = {
  slug?: string;
  name?: string;
  createdAt?: number;
  hostName?: string;
  flow?: string;
  participants?: LegacyParticipant[];
  stories?: unknown[];
  activeStoryId?: string | null;
  // Legacy one-story-per-room fields:
  storyTitle?: string;
  userStory?: string;
  acceptanceCriteria?: string;
  revealed?: boolean;
};

/**
 * Accepts whatever is in localStorage (including the earlier one-story-per-room
 * shape) and returns a valid current-shape `Room`.
 */
function normalizeRoom(slug: string, value: unknown): Room {
  const raw = (value ?? {}) as StoredRoom;

  const participants: Participant[] = Array.isArray(raw.participants)
    ? raw.participants.map((p, index) => ({
        id: p?.id ?? (p?.isHost ? "host" : randomId("p")),
        name: p?.name ?? (index === 0 ? (raw.hostName ?? "Host") : "Guest"),
        isHost: Boolean(p?.isHost) || index === 0,
      }))
    : [
        {
          id: "host",
          name: raw.hostName ?? "Host",
          isHost: true,
        },
      ];

  // Already current shape.
  if (Array.isArray(raw.stories)) {
    const stories = raw.stories.map(normalizeStory);
    return {
      slug: raw.slug ?? slug,
      name: raw.name ?? "",
      hostName: raw.hostName ?? participants[0]?.name ?? "Host",
      createdAt: raw.createdAt ?? Date.now(),
      flow: raw.flow === "queue" ? "queue" : "manual",
      participants,
      stories,
      activeStoryId:
        raw.activeStoryId && stories.some((s) => s.id === raw.activeStoryId)
          ? raw.activeStoryId
          : null,
    };
  }

  // Legacy shape: fold the single inline story into the stories array.
  const legacyVotes: Record<string, FibonacciCard> = {};
  if (Array.isArray(raw.participants)) {
    raw.participants.forEach((p, index) => {
      const id = p?.id ?? (index === 0 ? "host" : randomId("p"));
      if (p?.vote) legacyVotes[id] = p.vote;
    });
  }

  const legacyStory: Story | null = raw.storyTitle
    ? {
        id: randomId("s"),
        title: raw.storyTitle,
        userStory: raw.userStory ?? "",
        acceptanceCriteria: raw.acceptanceCriteria ?? "",
        origin: { source: "manual" },
        createdAt: raw.createdAt ?? Date.now(),
        completedAt: null,
        status: "voting",
        revealed: Boolean(raw.revealed),
        votes: legacyVotes,
      }
    : null;

  return {
    slug: raw.slug ?? slug,
    name: "",
    hostName: raw.hostName ?? participants[0]?.name ?? "Host",
    createdAt: raw.createdAt ?? Date.now(),
    flow: "manual",
    participants,
    stories: legacyStory ? [legacyStory] : [],
    activeStoryId: legacyStory ? legacyStory.id : null,
  };
}

function normalizeOrigin(value: unknown): StoryOrigin {
  const raw = (value ?? {}) as Partial<StoryOrigin>;
  return {
    source: raw.source === "servicenow" ? "servicenow" : "manual",
    externalId:
      typeof raw.externalId === "string" ? raw.externalId : undefined,
    externalNumber:
      typeof raw.externalNumber === "string" ? raw.externalNumber : undefined,
    externalPoints:
      typeof raw.externalPoints === "number" ? raw.externalPoints : null,
  };
}

function normalizeStory(value: unknown): Story {
  const raw = (value ?? {}) as Partial<Story>;
  return {
    id: raw.id ?? randomId("s"),
    title: raw.title ?? "Untitled story",
    userStory: raw.userStory ?? "",
    acceptanceCriteria: raw.acceptanceCriteria ?? "",
    origin: normalizeOrigin(raw.origin),
    createdAt: raw.createdAt ?? Date.now(),
    completedAt: raw.completedAt ?? null,
    status: raw.status === "completed" ? "completed" : "voting",
    revealed: Boolean(raw.revealed),
    votes:
      raw.votes && typeof raw.votes === "object"
        ? (raw.votes as Record<string, FibonacciCard>)
        : {},
  };
}

/* -------------------------------------------------------------------------- */
/*  Room creation + story lifecycle (pure — callers persist with saveRoom)   */
/* -------------------------------------------------------------------------- */

/** Build a fresh `Story` from an `AddStoryInput` (shared by create + add). */
function buildStory(input: AddStoryInput): Story {
  return {
    id: randomId("s"),
    title: input.title.trim(),
    userStory: input.userStory.trim(),
    acceptanceCriteria: input.acceptanceCriteria.trim(),
    origin: input.origin ?? { source: "manual" },
    createdAt: Date.now(),
    completedAt: null,
    status: "voting",
    revealed: false,
    votes: {},
  };
}

export function createRoom(input: CreateRoomInput): Room {
  const existing = readAll();

  let slug = generateSlug();
  while (existing[slug]) {
    slug = generateSlug();
  }

  const hostName = input.hostName.trim();
  const seededStories = (input.stories ?? []).map(buildStory);
  const flow: RoomFlow =
    input.flow ?? (seededStories.length > 0 ? "queue" : "manual");

  const room: Room = {
    slug,
    name: input.roomName.trim(),
    hostName,
    createdAt: Date.now(),
    flow,
    participants: [{ id: "host", name: hostName, isHost: true }],
    stories: seededStories,
    activeStoryId: seededStories[0]?.id ?? null,
  };

  saveRoom(room);
  return room;
}

export function activeStory(room: Room): Story | null {
  if (!room.activeStoryId) return null;
  return room.stories.find((story) => story.id === room.activeStoryId) ?? null;
}

export function completedStories(room: Room): Story[] {
  return room.stories.filter((story) => story.status === "completed");
}

/** Appends a new story and makes it the active one. */
export function addStory(room: Room, input: AddStoryInput): Room {
  const story = buildStory(input);
  return {
    ...room,
    stories: [...room.stories, story],
    activeStoryId: story.id,
  };
}

/**
 * Appends a batch of stories in the given order (used to seed a room from a
 * Planning Queue). Queue order is preserved; if nothing is active yet, the first
 * appended story becomes active. The room is marked `flow: "queue"` because a
 * batch seed is always queue-driven — when it is exhausted the room shows the
 * "Planning complete" summary rather than an add-story prompt.
 */
export function addStories(room: Room, inputs: AddStoryInput[]): Room {
  if (inputs.length === 0) return room;
  const built = inputs.map(buildStory);
  return {
    ...room,
    flow: "queue",
    stories: [...room.stories, ...built],
    activeStoryId: room.activeStoryId ?? built[0].id,
  };
}

function mapActiveStory(room: Room, fn: (story: Story) => Story): Room {
  if (!room.activeStoryId) return room;
  return {
    ...room,
    stories: room.stories.map((story) =>
      story.id === room.activeStoryId ? fn(story) : story,
    ),
  };
}

/** Toggles a participant's vote on the active story. */
export function setVote(
  room: Room,
  participantId: string,
  card: FibonacciCard,
): Room {
  return mapActiveStory(room, (story) => {
    const votes = { ...story.votes };
    if (votes[participantId] === card) {
      delete votes[participantId];
    } else {
      votes[participantId] = card;
    }
    return { ...story, votes };
  });
}

export function setRevealed(room: Room, revealed: boolean): Room {
  return mapActiveStory(room, (story) => ({ ...story, revealed }));
}

/** New Round: clears votes on the active story but keeps it active. */
export function resetActiveVotes(room: Room): Room {
  return mapActiveStory(room, (story) => ({
    ...story,
    votes: {},
    revealed: false,
  }));
}

/**
 * Next Story: completes the active story, then automatically advances to the
 * next story that is still `"voting"` (queue order preserved). When none remain,
 * `activeStoryId` becomes `null` — a manual room then shows the Add Story form,
 * a queue room shows the "Planning complete" summary.
 */
export function completeActiveStory(room: Room): Room {
  const completed = mapActiveStory(room, (story) => ({
    ...story,
    status: "completed",
    completedAt: Date.now(),
  }));

  const next = completed.stories.find((story) => story.status === "voting");

  return { ...completed, activeStoryId: next ? next.id : null };
}

/** Stories still awaiting estimation, in queue order. */
export function pendingStories(room: Room): Story[] {
  return room.stories.filter((story) => story.status === "voting");
}

/**
 * True when a queue-seeded room has estimated every story it was given.
 * Always false for manual rooms (the host may keep adding stories).
 */
export function isPlanningComplete(room: Room): boolean {
  return (
    room.flow === "queue" &&
    room.activeStoryId === null &&
    room.stories.length > 0 &&
    room.stories.every((story) => story.status === "completed")
  );
}

/** 1-based position of a story within the room's full list. */
export function storyPosition(
  room: Room,
  storyId: string,
): { index: number; total: number } {
  return {
    index: room.stories.findIndex((story) => story.id === storyId) + 1,
    total: room.stories.length,
  };
}

/** The single agreed card when every cast vote matches, else `null`. */
export function voteConsensus(
  votes: Record<string, FibonacciCard>,
): FibonacciCard | null {
  const values = Object.values(votes);
  if (values.length === 0) return null;
  const [first] = values;
  return values.every((value) => value === first) ? first : null;
}

/* -------------------------------------------------------------------------- */
/*  Display helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Two-letter avatar initials for a participant name. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function roomLabel(room: Room): string {
  return room.name.trim() || `${room.hostName}'s room`;
}

/** Splits stored acceptance criteria into trimmed, non-empty lines. */
export function criteriaLines(acceptanceCriteria: string): string[] {
  return acceptanceCriteria
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
