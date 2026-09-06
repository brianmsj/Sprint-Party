"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Workspace header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 lg:px-8">
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

          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${connection.className}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connection.dotClassName}`}
              aria-hidden
            />
            {connection.label}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Choose stories to refine
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          These Agile stories come straight from your ServiceNow{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            rm_story
          </code>{" "}
          table. Select the ones your team should estimate next.
        </p>

        {/* Selection toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-700">
              {selectedCount} {selectedCount === 1 ? "story" : "stories"} selected
            </p>
            {queueCount > 0 && (
              <Link
                href={withRoomParam("/servicenow/queue", roomSlug)}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                View Planning Queue ({queueCount}) →
              </Link>
            )}
          </div>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleAddToQueue}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Add to Planning Queue
          </button>
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
            <StoryTable
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
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function connectionFor(status: LoadState["status"]) {
  switch (status) {
    case "ready":
      return {
        label: "ServiceNow Connected",
        className: "bg-emerald-50 text-emerald-700",
        dotClassName: "bg-emerald-500",
      };
    case "loading":
      return {
        label: "Connecting to ServiceNow…",
        className: "bg-amber-50 text-amber-700",
        dotClassName: "bg-amber-500",
      };
    case "error":
    default:
      return {
        label: "ServiceNow Disconnected",
        className: "bg-red-50 text-red-700",
        dotClassName: "bg-red-500",
      };
  }
}

/* -------------------------------------------------------------------------- */

function StoryTable({
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="w-12 px-4 py-3">
              <span className="sr-only">Select</span>
            </th>
            <th scope="col" className="w-40 px-4 py-3">
              Number
            </th>
            <th scope="col" className="px-4 py-3">
              Short Description
            </th>
            <th scope="col" className="w-36 px-4 py-3">
              Points
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stories.map((story) => {
            const isOpen = expanded === story.sysId;
            const isChecked = selected.has(story.sysId);
            return (
              <StoryRows
                key={story.sysId || story.number}
                story={story}
                isOpen={isOpen}
                isChecked={isChecked}
                onToggleSelected={onToggleSelected}
                onToggleExpanded={onToggleExpanded}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StoryRows({
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
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-slate-50 ${
          isOpen ? "bg-slate-50" : ""
        }`}
        onClick={() => onToggleExpanded(story.sysId)}
      >
        <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            checked={isChecked}
            onChange={() => onToggleSelected(story.sysId)}
            aria-label={`Select story ${story.number || story.shortDescription}`}
          />
        </td>
        <td className="px-4 py-3 align-top font-mono text-xs font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`text-slate-400 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
              aria-hidden
            >
              ▸
            </span>
            {story.number || "—"}
          </span>
        </td>
        <td className="px-4 py-3 align-top font-medium text-slate-900">
          {story.shortDescription || (
            <span className="text-slate-400">Untitled story</span>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          {story.storyPoints === null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              Unestimated
            </span>
          ) : (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              {story.storyPoints}
            </span>
          )}
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-slate-50">
          <td colSpan={4} className="px-4 pb-5 pt-1">
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
              <DetailBlock title="Description" body={story.description} />
              <DetailBlock
                title="Acceptance Criteria"
                body={story.acceptanceCriteria}
              />
            </div>
          </td>
        </tr>
      )}
    </>
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

/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Loading stories from ServiceNow…
      </div>
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => (
          <li key={index} className="flex items-center gap-4 px-4 py-4">
            <span className="h-4 w-4 rounded bg-slate-200" />
            <span className="h-4 w-24 rounded bg-slate-200" />
            <span className="h-4 flex-1 rounded bg-slate-100" />
            <span className="h-4 w-20 rounded bg-slate-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No stories found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        SprintParty connected to ServiceNow successfully, but the{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          rm_story
        </code>{" "}
        table returned no records. Add some Agile stories in ServiceNow, then
        refresh.
      </p>
    </div>
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
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-red-800">
        Couldn&apos;t load ServiceNow stories
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-red-700">{message}</p>
      {detail && (
        <p className="mx-auto mt-2 max-w-lg text-xs text-red-600/80">{detail}</p>
      )}
      {code && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-red-500">
          {code}
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
