"use client";

import { useState } from "react";
import {
  isStoryReviewError,
  type StoryReadiness,
  type StoryReview,
  type StoryReviewInput,
  type StoryReviewResponse,
} from "@/app/lib/ai/types";

type PanelStatus = "idle" | "loading" | "error" | "done";

const READINESS_META: Record<
  StoryReadiness,
  { label: string; className: string; dot: string }
> = {
  ready: {
    label: "Ready to estimate",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  needs_clarification: {
    label: "Needs clarification",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  not_ready: {
    label: "Not ready",
    className: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
  },
};

/**
 * SprintParty AI refinement panel. Renders next to the active Planning Poker
 * story. Calls `POST /api/ai/story-review` only when the Scrum Master clicks
 * "Review Story" — never on mount. The OpenAI key stays server-side; this
 * component only ever sees the structured review or a safe error message.
 *
 * The parent remounts this (via `key={story.id}`) when the active story
 * changes, so local state resets automatically.
 */
export function AiReviewPanel(props: StoryReviewInput) {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [review, setReview] = useState<StoryReview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runReview() {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ai/story-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: props.number,
          shortDescription: props.shortDescription,
          description: props.description,
          acceptanceCriteria: props.acceptanceCriteria,
        }),
      });

      const body = (await res.json()) as StoryReviewResponse;

      if (!res.ok || isStoryReviewError(body)) {
        const message = isStoryReviewError(body)
          ? body.error.detail
            ? `${body.error.message} (${body.error.detail})`
            : body.error.message
          : "The AI review failed. Try again.";
        setErrorMessage(message);
        setStatus("error");
        return;
      }

      setReview(body.review);
      setStatus("done");
    } catch {
      setErrorMessage(
        "Could not reach the server. Check your connection and try again.",
      );
      setStatus("error");
    }
  }

  const isLoading = status === "loading";

  return (
    <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            SprintParty
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">SprintParty AI</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          Refinement assist
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        An AI Scrum Master reviews the story as written — it surfaces questions and
        gaps for the team to discuss. It does not estimate story points.
      </p>

      <button
        type="button"
        onClick={runReview}
        disabled={isLoading}
        className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading
          ? "Reviewing story…"
          : status === "done"
            ? "Review again"
            : "Review Story"}
      </button>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Asking the AI to review this story…
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-semibold">AI review failed</p>
          <p className="mt-1 leading-5">{errorMessage}</p>
        </div>
      )}

      {status === "done" && review && (
        <ReviewResult review={review} />
      )}

      {status === "idle" && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Nothing is sent to the AI until you click Review Story.
        </p>
      )}
    </aside>
  );
}

/* -------------------------------------------------------------------------- */

function ReviewResult({ review }: { review: StoryReview }) {
  const readiness = READINESS_META[review.readiness];

  return (
    <div className="mt-4 space-y-4">
      <div
        className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${readiness.className}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${readiness.dot}`} />
        {readiness.label}
      </div>

      {review.summary && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Summary
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            {review.summary}
          </p>
        </div>
      )}

      <ReviewList title="Suggested Discussion Questions" items={review.questions} />
      <ReviewList title="Missing Information" items={review.missingInformation} />
      <ReviewList title="Risks / Unknowns" items={review.risks} />
      <ReviewList title="Dependencies" items={review.dependencies} />
      <ReviewList title="QA Considerations" items={review.qaConsiderations} />

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Split Recommendation
        </p>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          {review.splitRecommendation || "No split recommendation provided."}
        </p>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        AI-generated. Treat as prompts for discussion, not decisions.
      </p>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-slate-400">None noted.</p>
      )}
    </div>
  );
}
