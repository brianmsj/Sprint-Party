"use client";

import { useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoom } from "@/app/lib/rooms";
import {
  clearQueue,
  loadQueue,
  moveInQueue,
  queuedStoryToAddStoryInput,
  removeFromQueue,
  subscribeQueue,
  type QueuedStory,
} from "@/app/lib/planningQueue";

const HOST_NAME_KEY = "sprintparty:hostName";

/** Stable empty reference for the server snapshot of `useSyncExternalStore`. */
const EMPTY: QueuedStory[] = [];

function readStoredHostName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(HOST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function PlanningQueuePage() {
  const router = useRouter();

  const queue = useSyncExternalStore(subscribeQueue, loadQueue, () => EMPTY);
  const mounted = useSyncExternalStore(
    subscribeQueue,
    () => true,
    () => false,
  );

  const [hostName, setHostName] = useState<string>(readStoredHostName);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (queue.length === 0) return;

    if (!hostName.trim()) {
      setError("Enter your name to host this SprintParty.");
      return;
    }

    setStarting(true);
    try {
      window.localStorage.setItem(HOST_NAME_KEY, hostName.trim());
    } catch {
      // Non-fatal — just means we can't prefill next time.
    }

    const room = createRoom({
      hostName: hostName.trim(),
      roomName: "ServiceNow refinement",
      flow: "queue",
      stories: queue.map(queuedStoryToAddStoryInput),
    });

    clearQueue();
    router.push(`/room/${room.slug}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <WorkspaceHeader />

      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Planning Queue
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Choose the stories your team will refine in this SprintParty.
        </p>

        {!mounted ? (
          <p className="py-16 text-center text-slate-500">Loading queue…</p>
        ) : queue.length === 0 ? (
          <EmptyQueue />
        ) : (
          <>
            <form
              onSubmit={handleStart}
              className="mt-6 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-semibold text-slate-700">
                    {queue.length} {queue.length === 1 ? "story" : "stories"}{" "}
                    ready
                  </p>
                  <label
                    htmlFor="hostName"
                    className="mt-3 block text-xs font-semibold text-slate-500"
                  >
                    Host name
                  </label>
                  <input
                    id="hostName"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Brian"
                    value={hostName}
                    onChange={(event) => {
                      setHostName(event.target.value);
                      if (error) setError(null);
                    }}
                    className="mt-1 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  />
                  {error && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      clearQueue();
                      setExpanded(null);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear queue
                  </button>
                  <button
                    type="submit"
                    disabled={starting || queue.length === 0}
                    className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {starting ? "Starting…" : "Start SprintParty"}
                  </button>
                </div>
              </div>
            </form>

            <ol className="mt-6 space-y-3">
              {queue.map((story, index) => (
                <QueueRow
                  key={story.key}
                  story={story}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === queue.length - 1}
                  isOpen={expanded === story.key}
                  onToggle={() =>
                    setExpanded((prev) =>
                      prev === story.key ? null : story.key,
                    )
                  }
                  onMoveUp={() => moveInQueue(story.key, "up")}
                  onMoveDown={() => moveInQueue(story.key, "down")}
                  onRemove={() => {
                    removeFromQueue(story.key);
                    setExpanded((prev) => (prev === story.key ? null : prev));
                  }}
                />
              ))}
            </ol>

            <p className="mt-4 text-xs text-slate-500">
              Starting a SprintParty creates a room using the existing SprintParty
              voting engine, seeded with these stories in this order. The queue is
              cleared once the room opens.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function WorkspaceHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            SprintParty
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-lg font-semibold text-slate-600">
            SprintParty for ServiceNow
          </span>
        </div>
        <Link
          href="/servicenow/stories"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to stories
        </Link>
      </div>
    </header>
  );
}

function EmptyQueue() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-slate-900">
        Your planning queue is empty
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Pick some stories from ServiceNow and choose{" "}
        <span className="font-semibold">Add to Planning Queue</span>.
      </p>
      <Link
        href="/servicenow/stories"
        className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Browse ServiceNow stories
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function QueueRow({
  story,
  position,
  isFirst,
  isLast,
  isOpen,
  onToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  story: QueuedStory;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
          {position}
        </span>

        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={isOpen}
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-500">
              {story.externalNumber || "—"}
            </span>
            {story.storyPoints === null ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                Unestimated
              </span>
            ) : (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                {story.storyPoints} pts
              </span>
            )}
          </span>
          <span className="mt-1 block font-medium text-slate-900">
            {story.title || "Untitled story"}
          </span>
          <span className="mt-1 text-xs text-slate-400">
            {isOpen ? "Hide details" : "Show details"}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Move up" disabled={isFirst} onClick={onMoveUp}>
            ↑
          </IconButton>
          <IconButton label="Move down" disabled={isLast} onClick={onMoveDown}>
            ↓
          </IconButton>
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailBlock title="Description" body={story.description} />
            <DetailBlock
              title="Acceptance Criteria"
              body={story.acceptanceCriteria}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {body ? (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">
          {body}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-slate-400">Not provided.</p>
      )}
    </div>
  );
}
