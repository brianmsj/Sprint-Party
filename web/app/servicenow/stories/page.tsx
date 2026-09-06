"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/ui/AppShell";
import { Button } from "@/app/components/ui/Button";
import { Panel } from "@/app/components/ui/Panel";
import { StatusPill, type PillTone } from "@/app/components/ui/StatusPill";
import {
  addStoriesToQueue,
  loadQueue,
  subscribeQueue,
} from "@/app/lib/planningQueue";
import { readRoomParam, withRoomParam } from "@/app/lib/session";
import { serviceNowStoryToQueued } from "@/app/lib/servicenow/adapter";
import {
  isServiceNowError,
  type ServiceNowStoriesResponse,
  type ServiceNowStory,
} from "@/app/lib/servicenow/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; detail?: string; code?: string }
  | { status: "ready"; stories: ServiceNowStory[] };

export default function ServiceNowStoriesPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  // Slug of the SprintParty session being built (from `?room=`), if any.
  const [roomSlug] = useState<string | null>(() => readRoomParam());

  const queueCount = useSyncExternalStore(
    subscribeQueue,
    () => loadQueue().length,
    () => 0,
  );

  const fetchStories = useCallback(async (): Promise<LoadState> => {
    try {
      const res = await fetch("/api/servicenow/stories", { cache: "no-store" });
      const body = (await res.json()) as ServiceNowStoriesResponse;

      if (!res.ok || isServiceNowError(body)) {
        const err = isServiceNowError(body) ? body.error : undefined;
        return {
          status: "error",
          message: err?.message ?? `Request failed with HTTP ${res.status}.`,
          detail: err?.detail,
          code: err?.code,
        };
      }

      return { status: "ready", stories: body.stories };
    } catch (cause) {
      return {
        status: "error",
        message: "Could not reach SprintParty's ServiceNow API route.",
        detail: cause instanceof Error ? cause.message : undefined,
      };
    }
  }, []);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    setSelected(new Set());
    setExpanded(null);
    setState(await fetchStories());
  }, [fetchStories]);

  useEffect(() => {
    let active = true;
    void fetchStories().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [fetchStories]);

  const stories = state.status === "ready" ? state.stories : [];

  const toggleSelected = useCallback((sysId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sysId)) next.delete(sysId);
      else next.add(sysId);
      return next;
    });
  }, []);

  const selectedCount = selected.size;
  const connection = useMemo(() => connectionFor(state.status), [state.status]);

  const handleAddToQueue = useCallback(() => {
    if (state.status !== "ready" || selected.size === 0) return;
    // Preserve on-screen order for this batch; the queue store dedupes by key
    // and appends, so clicking twice never creates duplicates.
    const picked = state.stories.filter((story) => selected.has(story.sysId));
    addStoriesToQueue(picked.map(serviceNowStoryToQueued));
    router.push(withRoomParam("/servicenow/queue", roomSlug));
  }, [router, roomSlug, selected, state]);

  return (
    <AppShell
      breadcrumb="ServiceNow"
      actions={
        <>
          <StatusPill tone={connection.tone} dot>
            {connection.label}
          </StatusPill>
          {queueCount > 0 && (
            <Button
              href={withRoomParam("/servicenow/queue", roomSlug)}
              variant="ghost"
              size="sm"
            >
              Queue · {queueCount}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose stories to refine
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Straight from your ServiceNow{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-fg-secondary">
            rm_story
          </code>{" "}
          table. Select the ones your team should estimate next.
        </p>
      </div>

      {/* Sticky selection toolbar */}
      <div className="sticky top-14 z-30 -mx-5 mt-6 border-y border-line bg-bg-elevated/85 px-5 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-secondary">
            <span className="font-medium text-fg">{selectedCount}</span>{" "}
            {selectedCount === 1 ? "story" : "stories"} selected
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            glow={selectedCount > 0}
            disabled={selectedCount === 0}
            onClick={handleAddToQueue}
          >
            Add to Planning Queue
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {state.status === "loading" && <LoadingState />}

        {state.status === "error" && (
          <ErrorState
            message={state.message}
            detail={state.detail}
            code={state.code}
            onRetry={() => void reload()}
          />
        )}

        {state.status === "ready" && stories.length === 0 && <EmptyState />}

        {state.status === "ready" && stories.length > 0 && (
          <StoryList
            stories={stories}
            selected={selected}
            expanded={expanded}
            onToggleSelected={toggleSelected}
            onToggleExpanded={(sysId) =>
              setExpanded((prev) => (prev === sysId ? null : sysId))
            }
          />
        )}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function connectionFor(status: LoadState["status"]): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "ready":
      return { label: "Connected", tone: "success" };
    case "loading":
      return { label: "Connecting…", tone: "warning" };
    case "error":
    default:
      return { label: "Disconnected", tone: "danger" };
  }
}

/* -------------------------------------------------------------------------- */

function StoryList({
  stories,
  selected,
  expanded,
  onToggleSelected,
  onToggleExpanded,
}: {
  stories: ServiceNowStory[];
  selected: Set<string>;
  expanded: string | null;
  onToggleSelected: (sysId: string) => void;
  onToggleExpanded: (sysId: string) => void;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="hidden grid-cols-[2.5rem_9rem_1fr_6rem] gap-3 border-b border-line px-4 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-fg-muted sm:grid">
        <span className="sr-only">Select</span>
        <span aria-hidden />
        <span>Number</span>
        <span>Short description</span>
        <span>Points</span>
      </div>
      <ul className="divide-y divide-line">
        {stories.map((story) => (
          <StoryRow
            key={story.sysId || story.number}
            story={story}
            isOpen={expanded === story.sysId}
            isChecked={selected.has(story.sysId)}
            onToggleSelected={onToggleSelected}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
      </ul>
    </Panel>
  );
}

function StoryRow({
  story,
  isOpen,
  isChecked,
  onToggleSelected,
  onToggleExpanded,
}: {
  story: ServiceNowStory;
  isOpen: boolean;
  isChecked: boolean;
  onToggleSelected: (sysId: string) => void;
  onToggleExpanded: (sysId: string) => void;
}) {
  return (
    <li
      className={`transition-colors ${isChecked ? "bg-accent-soft/40" : "hover:bg-surface-hover"}`}
    >
      <div className="grid grid-cols-[2.5rem_1fr] items-start gap-3 px-4 py-3 sm:grid-cols-[2.5rem_9rem_1fr_6rem] sm:items-center">
        <label className="flex h-full items-center pt-0.5 sm:pt-0">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line-strong bg-bg accent-accent"
            checked={isChecked}
            onChange={() => onToggleSelected(story.sysId)}
            aria-label={`Select story ${story.number || story.shortDescription}`}
          />
        </label>

        <button
          type="button"
          onClick={() => onToggleExpanded(story.sysId)}
          aria-expanded={isOpen}
          className="col-start-2 flex items-center gap-1.5 rounded-sm text-left font-mono text-xs text-fg-secondary sm:col-start-auto"
        >
          <span
            className={`text-fg-faint transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
          {story.number || "—"}
        </button>

        <button
          type="button"
          onClick={() => onToggleExpanded(story.sysId)}
          className="col-start-2 rounded-sm text-left text-sm text-fg sm:col-start-auto"
        >
          {story.shortDescription || (
            <span className="text-fg-faint">Untitled story</span>
          )}
        </button>

        <div className="col-start-2 sm:col-start-auto">
          {story.storyPoints === null ? (
            <StatusPill tone="neutral">Unestimated</StatusPill>
          ) : (
            <StatusPill tone="accent">{story.storyPoints} pts</StatusPill>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="grid gap-5 border-t border-line bg-bg/40 px-4 py-4 sm:grid-cols-2 sm:pl-[3.25rem]">
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

/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y divide-line">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="flex items-center gap-4 px-4 py-4">
            <span className="h-4 w-4 shrink-0 rounded bg-surface-active" />
            <span className="h-3.5 w-24 shrink-0 rounded bg-surface-active" />
            <span className="h-3.5 flex-1 rounded bg-surface" />
            <span className="h-3.5 w-16 shrink-0 rounded bg-surface-active" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EmptyState() {
  return (
    <Panel className="px-6 py-16 text-center">
      <h2 className="text-sm font-semibold text-fg">No stories found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
        SprintParty reached ServiceNow, but{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-fg-secondary">
          rm_story
        </code>{" "}
        returned no records. Add Agile stories in ServiceNow, then refresh.
      </p>
    </Panel>
  );
}

function ErrorState({
  message,
  detail,
  code,
  onRetry,
}: {
  message: string;
  detail?: string;
  code?: string;
  onRetry: () => void;
}) {
  return (
    <Panel tone="danger" className="px-6 py-10 text-center">
      <h2 className="text-sm font-semibold text-danger">
        Couldn&apos;t load ServiceNow stories
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-fg-secondary">{message}</p>
      {detail && (
        <p className="mx-auto mt-2 max-w-lg text-xs text-fg-muted">{detail}</p>
      )}
      {code && (
        <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-wide text-danger/80">
          {code}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="mt-5"
      >
        Try again
      </Button>
    </Panel>
  );
}
