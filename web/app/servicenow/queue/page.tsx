"use client";

import { useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/ui/AppShell";
import { Button } from "@/app/components/ui/Button";
import { Field, inputClassName } from "@/app/components/ui/Field";
import { Panel } from "@/app/components/ui/Panel";
import { StatusPill } from "@/app/components/ui/StatusPill";
import {
  addStories,
  createRoom,
  loadRoom,
  roomLabel,
  saveRoom,
  type Room,
} from "@/app/lib/rooms";
import {
  clearQueue,
  loadQueue,
  moveInQueue,
  queuedStoryToAddStoryInput,
  removeFromQueue,
  subscribeQueue,
  type QueuedStory,
} from "@/app/lib/planningQueue";
import {
  readRoomParam,
  readStoredHostName,
  rememberHostName,
  withRoomParam,
} from "@/app/lib/session";

/** Stable empty reference for the server snapshot of `useSyncExternalStore`. */
const EMPTY: QueuedStory[] = [];

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

  // The SprintParty session this queue belongs to (created on `/create`).
  const [roomSlug] = useState<string | null>(() => readRoomParam());
  const [sessionRoom] = useState<Room | null>(() =>
    roomSlug ? loadRoom(roomSlug) : null,
  );

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (queue.length === 0) return;

    const inputs = queue.map(queuedStoryToAddStoryInput);

    // Primary flow: a session room already exists — seed it, don't make a new one.
    if (sessionRoom) {
      setStarting(true);
      saveRoom(addStories(sessionRoom, inputs));
      clearQueue();
      router.push(`/room/${sessionRoom.slug}`);
      return;
    }

    // Fallback: queue reached directly with no session — create the room now.
    if (!hostName.trim()) {
      setError("Enter your name to host this SprintParty.");
      return;
    }

    setStarting(true);
    rememberHostName(hostName);

    const room = createRoom({
      hostName: hostName.trim(),
      roomName: "ServiceNow refinement",
      flow: "queue",
      stories: inputs,
    });

    clearQueue();
    router.push(`/room/${room.slug}`);
  }

  return (
    <AppShell
      breadcrumb="ServiceNow"
      actions={
        <Button
          href={withRoomParam("/servicenow/stories", roomSlug)}
          variant="ghost"
          size="sm"
        >
          Back to stories
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Planning Queue</h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Order the stories your team will refine in this session. Start when
          you&apos;re ready.
        </p>
      </div>

      {!mounted ? (
        <p className="py-16 text-center text-sm text-fg-muted">Loading queue…</p>
      ) : queue.length === 0 ? (
        <EmptyQueue roomSlug={roomSlug} />
      ) : (
        <form onSubmit={handleStart} className="mt-6">
          {/* Start bar */}
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                {queue.length} {queue.length === 1 ? "story" : "stories"} ready
              </p>
              {sessionRoom ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                  Starting in
                  <span className="text-fg-secondary">
                    {roomLabel(sessionRoom)}
                  </span>
                  <span className="font-mono text-fg-faint">
                    {sessionRoom.slug}
                  </span>
                </p>
              ) : (
                <div className="mt-2 max-w-xs">
                  <Field id="hostName" label="Host name" error={error ?? undefined}>
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
                      className={inputClassName(Boolean(error))}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={() => {
                  clearQueue();
                  setExpanded(null);
                }}
              >
                Clear queue
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                glow
                disabled={starting || queue.length === 0}
              >
                {starting ? "Starting…" : "Start SprintParty"}
              </Button>
            </div>
          </Panel>

          {/* Ordered story rows — compact list, hairline dividers */}
          <Panel className="mt-4 overflow-hidden">
            <ol className="divide-y divide-line">
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
          </Panel>

          <p className="mt-3 text-xs text-fg-faint">
            Start SprintParty opens your session with these stories active in
            this order. The queue is cleared once the session opens.
          </p>
        </form>
      )}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function EmptyQueue({ roomSlug }: { roomSlug: string | null }) {
  return (
    <Panel className="mt-6 px-6 py-16 text-center">
      <h2 className="text-sm font-semibold text-fg">Your queue is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
        Pick stories from ServiceNow and choose{" "}
        <span className="text-fg-secondary">Add to Planning Queue</span>.
      </p>
      <Button
        href={withRoomParam("/servicenow/stories", roomSlug)}
        variant="primary"
        size="md"
        className="mt-6"
      >
        Browse ServiceNow stories
      </Button>
    </Panel>
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
    <li className="transition-colors hover:bg-surface-hover">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <span className="w-5 shrink-0 text-center font-mono text-xs text-fg-faint">
          {position}
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm py-1 text-left"
        >
          <span className="hidden shrink-0 font-mono text-xs text-fg-muted sm:inline">
            {story.externalNumber || "—"}
          </span>
          <span className="truncate text-sm text-fg">
            {story.title || "Untitled story"}
          </span>
          {story.storyPoints !== null && (
            <StatusPill tone="neutral" className="shrink-0">
              {story.storyPoints} pts
            </StatusPill>
          )}
          <span
            className={`ml-auto shrink-0 text-fg-faint transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
        </button>

        <div className="flex shrink-0 items-center">
          <IconButton label="Move up" disabled={isFirst} onClick={onMoveUp}>
            ↑
          </IconButton>
          <IconButton label="Move down" disabled={isLast} onClick={onMoveDown}>
            ↓
          </IconButton>
          <IconButton label="Remove from queue" onClick={onRemove} danger>
            ✕
          </IconButton>
        </div>
      </div>

      {isOpen && (
        <div className="grid gap-5 border-t border-line bg-bg/40 px-4 py-4 sm:grid-cols-2 sm:pl-12">
          <DetailBlock title="Description" body={story.description} />
          <DetailBlock
            title="Acceptance criteria"
            body={story.acceptanceCriteria}
          />
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm text-fg-muted transition-colors hover:bg-surface-active hover:text-fg disabled:pointer-events-none disabled:opacity-25 ${
        danger ? "hover:bg-danger-soft hover:text-danger" : ""
      }`}
    >
      {children}
    </button>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-fg-muted">
        {title}
      </p>
      {body ? (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-fg-secondary">
          {body}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-fg-faint">Not provided.</p>
      )}
    </div>
  );
}
