"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Panel, Eyebrow } from "@/app/components/ui/Panel";
import { StatusPill, type PillTone } from "@/app/components/ui/StatusPill";
import {
  isStoryReviewError,
  type StoryReadiness,
  type StoryReview,
  type StoryReviewInput,
  type StoryReviewResponse,
} from "@/app/lib/ai/types";

type PanelStatus = "idle" | "loading" | "error" | "done";

const READINESS: Record<
  StoryReadiness,
  { label: string; tone: PillTone; lead: string }
> = {
  ready: {
    label: "Looks ready",
    tone: "success",
    lead: "In short",
  },
  needs_clarification: {
    label: "Needs clarification",
    tone: "warning",
    lead: "One thing to clarify",
  },
  not_ready: {
    label: "Not ready",
    tone: "danger",
    lead: "The main gap",
  },
};

/**
 * SprintParty AI refinement panel — secondary to the team's own conversation.
 *
 * Calls `POST /api/ai/story-review` only when the Scrum Master clicks
 * "Review story" (never on mount). The default view stays compact: readiness,
 * one sentence, up to three questions, one risk. The full structured response
 * (unchanged on the API side) lives behind "Dig deeper".
 *
 * The parent remounts this via `key={story.id}` so state resets per story.
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
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">SprintParty AI</h2>
        </div>
        {status === "done" && review && (
          <StatusPill tone={READINESS[review.readiness].tone}>
            {READINESS[review.readiness].label}
          </StatusPill>
        )}
      </div>

      {status === "idle" && (
        <>
          <p className="mt-2 text-xs leading-5 text-fg-muted">
            An AI Scrum Master reads the story and surfaces what the team should
            discuss. It doesn&apos;t estimate points.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            fullWidth
            onClick={runReview}
            className="mt-3"
          >
            Review story
          </Button>
        </>
      )}

      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Reviewing this story…
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mt-3 rounded-md border border-danger/25 bg-danger-soft/60 p-3 text-xs leading-5 text-fg-secondary">
          <p className="font-medium text-danger">AI review failed</p>
          <p className="mt-1">{errorMessage}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={runReview}
            className="mt-2 -ml-2"
          >
            Try again
          </Button>
        </div>
      )}

      {status === "done" && review && (
        <ReviewResult review={review} onRerun={runReview} />
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

function ReviewResult({
  review,
  onRerun,
}: {
  review: StoryReview;
  onRerun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = READINESS[review.readiness];

  const lead = review.missingInformation[0] ?? review.summary;
  const questions = review.questions.slice(0, 3);
  const extraQuestions = Math.max(0, review.questions.length - questions.length);
  const watch = review.risks[0];

  return (
    <div className="mt-3 space-y-4">
      {/* One concise sentence */}
      {lead && (
        <div>
          <Eyebrow>{meta.lead}</Eyebrow>
          <p className="mt-1.5 text-sm leading-6 text-fg-secondary">{lead}</p>
        </div>
      )}

      {/* Up to three questions */}
      {questions.length > 0 && (
        <div>
          <Eyebrow>Ask the team</Eyebrow>
          <ol className="mt-2 space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-6 text-fg-secondary">
                <span className="mt-px font-mono text-xs text-fg-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
          {extraQuestions > 0 && (
            <p className="mt-1.5 text-xs text-fg-faint">
              +{extraQuestions} more in Dig deeper
            </p>
          )}
        </div>
      )}

      {/* One risk to watch */}
      {watch && (
        <div>
          <Eyebrow>
            {review.risks.length === 1
              ? "1 thing to watch"
              : `${review.risks.length} things to watch`}
          </Eyebrow>
          <p className="mt-1.5 text-sm leading-6 text-fg-secondary">{watch}</p>
        </div>
      )}

      {/* Expandable full detail */}
      <div className="border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-sm text-xs font-medium text-fg-secondary transition-colors hover:text-fg"
        >
          Dig deeper
          <span
            className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
        </button>

        {open && (
          <div className="mt-3 space-y-4">
            {review.summary && (
              <DeepBlock title="Summary" body={review.summary} />
            )}
            <DeepList title="All discussion questions" items={review.questions} />
            <DeepList title="Missing information" items={review.missingInformation} />
            <DeepList title="Risks / unknowns" items={review.risks} />
            <DeepList title="Dependencies" items={review.dependencies} />
            <DeepList title="QA considerations" items={review.qaConsiderations} />
            <DeepBlock
              title="Split recommendation"
              body={review.splitRecommendation || "No split recommendation provided."}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-3">
        <p className="text-[0.6875rem] text-fg-faint">
          AI-generated · prompts for discussion, not decisions
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRerun}
          className="-mr-2"
        >
          Re-review
        </Button>
      </div>
    </div>
  );
}

function DeepBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-1.5 text-sm leading-6 text-fg-muted">{body}</p>
    </div>
  );
}

function DeepList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {items.length > 0 ? (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-sm leading-6 text-fg-muted"
            >
              <span
                aria-hidden
                className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-fg-faint"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-fg-faint">None noted.</p>
      )}
    </div>
  );
}
