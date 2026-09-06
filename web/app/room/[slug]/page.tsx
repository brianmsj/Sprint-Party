"use client";

import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/app/components/ui/AppShell";
import { AiReviewPanel } from "@/app/components/AiReviewPanel";
import { Button } from "@/app/components/ui/Button";
import { Panel, Eyebrow } from "@/app/components/ui/Panel";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { withRoomParam } from "@/app/lib/session";
import {
  FIBONACCI_DECK,
  activeStory,
  completeActiveStory,
  completedStories,
  criteriaLines,
  initialsFor,
  isPlanningComplete,
  loadRoom,
  pendingStories,
  resetActiveVotes,
  roomLabel,
  saveRoom,
  setRevealed,
  setVote,
  storyPosition,
  subscribeRooms,
  voteConsensus,
  type FibonacciCard,
  type Room,
  type Story,
} from "@/app/lib/rooms";

const HOST_ID = "host";

export default function RoomPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // The room store is the source of truth; this also picks up writes from other
  // tabs today and is the seam for Supabase realtime later.
  const room = useSyncExternalStore(
    subscribeRooms,
    () => loadRoom(slug),
    () => null,
  );
  const mounted = useSyncExternalStore(
    subscribeRooms,
    () => true,
    () => false,
  );

  /**
   * Apply an update to the stored room. Swapping `saveRoom` for a Supabase
   * mutation later keeps this component unchanged.
   */
  function mutateRoom(updater: (current: Room) => Room) {
    const current = loadRoom(slug);
    if (!current) return;
    saveRoom(updater(current));
  }

  if (!mounted) {
    return (
      <AppShell>
        <p className="py-24 text-center text-sm text-fg-muted">Loading room…</p>
      </AppShell>
    );
  }

  if (!room) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Room not found</h1>
          <p className="mt-3 text-sm text-fg-muted">
            No room called{" "}
            <span className="font-mono text-fg-secondary">{slug}</span> exists in
            this browser.
          </p>
          <Button href="/create" variant="primary" size="md" className="mt-6">
            Create a session
          </Button>
        </div>
      </AppShell>
    );
  }

  const story = activeStory(room);
  const history = completedStories(room);
  const planningComplete = isPlanningComplete(room);
  // One more story is still pending after the active one?
  const hasMorePending = pendingStories(room).length > 1;

  return (
    <AppShell
      breadcrumb={roomLabel(room)}
      actions={
        <>
          <StatusPill tone="neutral" className="hidden font-mono sm:inline-flex">
            {room.slug}
          </StatusPill>
          <Button href="/create" variant="ghost" size="sm">
            New
          </Button>
        </>
      }
    >
      {/* Room meta strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        {room.flow === "queue" && (
          <StatusPill tone="accent">ServiceNow queue</StatusPill>
        )}
        <span>
          {room.participants.length}{" "}
          {room.participants.length === 1 ? "participant" : "participants"}
        </span>
        {history.length > 0 && (
          <>
            <span aria-hidden className="text-fg-faint">
              ·
            </span>
            <span>{history.length} estimated</span>
          </>
        )}
      </div>

      <div className="mt-6">
        {story ? (
          <ActiveStoryView
            room={room}
            story={story}
            hasMorePending={hasMorePending}
            onVote={(card) =>
              mutateRoom((current) => setVote(current, HOST_ID, card))
            }
            onToggleReveal={() =>
              mutateRoom((current) => setRevealed(current, !story.revealed))
            }
            onNewRound={() => mutateRoom(resetActiveVotes)}
            onNextStory={() => mutateRoom(completeActiveStory)}
          />
        ) : planningComplete ? (
          <PlanningCompleteView stories={history} roomSlug={room.slug} />
        ) : (
          <EmptySessionView
            roomSlug={room.slug}
            hasHistory={history.length > 0}
          />
        )}
      </div>

      {history.length > 0 && !planningComplete && (
        <HistoryList
          stories={history}
          participantCount={room.participants.length}
        />
      )}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function ActiveStoryView({
  room,
  story,
  hasMorePending,
  onVote,
  onToggleReveal,
  onNewRound,
  onNextStory,
}: {
  room: Room;
  story: Story;
  hasMorePending: boolean;
  onVote: (card: FibonacciCard) => void;
  onToggleReveal: () => void;
  onNewRound: () => void;
  onNextStory: () => void;
}) {
  const lines = criteriaLines(story.acceptanceCriteria);
  const hostVote = story.votes[HOST_ID];
  const isQueue = room.flow === "queue";
  const position = storyPosition(room, story.id);
  const nextLabel =
    isQueue && !hasMorePending ? "Finish & view summary" : "Next story";

  const votedCount = Object.keys(story.votes).length;

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Prominent story header ------------------------------------------- */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {story.origin.externalNumber && (
            <span className="font-mono text-sm font-medium text-accent">
              {story.origin.externalNumber}
            </span>
          )}
          {story.origin.source === "servicenow" && (
            <StatusPill tone="neutral">ServiceNow</StatusPill>
          )}
          {isQueue && (
            <span className="text-xs text-fg-muted">
              Story {position.index} of {position.total}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {story.title}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Primary column: context + voting --------------------------------- */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Story context — scannable */}
          <Panel className="p-5">
            <Eyebrow>User story</Eyebrow>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-fg-secondary">
              {story.userStory || "—"}
            </p>

            <Eyebrow className="mt-5">Acceptance criteria</Eyebrow>
            {lines.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {lines.map((line, index) => (
                  <li
                    key={index}
                    className="flex gap-2.5 text-sm leading-6 text-fg-secondary"
                  >
                    <span
                      aria-hidden
                      className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-fg-faint"
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-faint">
                No acceptance criteria provided.
              </p>
            )}

            {typeof story.origin.externalPoints === "number" && (
              <p className="mt-5 text-xs text-fg-muted">
                Source estimate:{" "}
                <span className="font-mono text-fg-secondary">
                  {story.origin.externalPoints}
                </span>
              </p>
            )}
          </Panel>

          {/* Voting — the dominant surface */}
          <Panel sheen className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Eyebrow>{story.revealed ? "Estimates revealed" : "Voting"}</Eyebrow>
                <p className="mt-1 text-sm text-fg-muted">
                  {story.revealed
                    ? "Discuss the spread, then re-round or move on."
                    : "Pick your estimate. Votes stay hidden until reveal."}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap font-mono text-xs text-fg-muted">
                {votedCount}/{room.participants.length} voted
              </span>
            </div>

            {/* Fibonacci deck */}
            <div className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
              {FIBONACCI_DECK.map((card) => {
                const selected = hostVote === card;
                return (
                  <button
                    key={card}
                    type="button"
                    onClick={() => onVote(card)}
                    aria-pressed={selected}
                    className={[
                      "flex h-16 items-center justify-center rounded-lg border font-mono text-lg transition-[transform,background-color,border-color,color,box-shadow] duration-150 sm:h-20 sm:text-xl",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      selected
                        ? "-translate-y-0.5 border-accent bg-accent-soft text-accent sp-glow"
                        : "border-line bg-surface text-fg-secondary hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-hover hover:text-fg",
                    ].join(" ")}
                  >
                    {card}
                  </button>
                );
              })}
            </div>

            {story.revealed && <VoteSummary votes={story.votes} />}

            {/* Primary actions */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                size="lg"
                glow
                fullWidth
                onClick={onToggleReveal}
              >
                {story.revealed ? "Hide estimates" : "Reveal estimates"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={onNewRound}
                className="sm:w-auto"
              >
                New round
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={onNextStory}
              className="mt-2"
            >
              {nextLabel} →
            </Button>

            {/* Compact participant / vote progress */}
            <div className="mt-6 border-t border-line pt-4">
              <Eyebrow>Participants</Eyebrow>
              <ul className="mt-3 flex flex-wrap gap-2">
                {room.participants.map((participant) => (
                  <ParticipantChip
                    key={participant.id}
                    name={participant.name}
                    isHost={participant.isHost}
                    revealed={story.revealed}
                    vote={story.votes[participant.id]}
                  />
                ))}
              </ul>
            </div>
          </Panel>

          <p className="text-xs text-fg-faint">
            {isQueue
              ? "Next story advances automatically through the ServiceNow Planning Queue."
              : "Voting runs locally in this browser. Realtime multiplayer is coming next."}
          </p>
        </div>

        {/* Secondary column: AI assist ----------------------------------- */}
        <div className="lg:sticky lg:top-[4.5rem]">
          <AiReviewPanel
            key={story.id}
            number={story.origin.externalNumber ?? ""}
            shortDescription={story.title}
            description={story.userStory}
            acceptanceCriteria={story.acceptanceCriteria}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ParticipantChip({
  name,
  isHost,
  revealed,
  vote,
}: {
  name: string;
  isHost: boolean;
  revealed: boolean;
  vote: FibonacciCard | undefined;
}) {
  return (
    <li className="inline-flex items-center gap-2 rounded-md border border-line bg-surface py-1 pl-1 pr-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-surface-active text-[0.625rem] font-semibold text-fg-secondary">
        {initialsFor(name)}
      </span>
      <span className="text-xs text-fg-secondary">{name}</span>
      {isHost && (
        <span className="text-[0.625rem] uppercase tracking-wide text-fg-faint">
          host
        </span>
      )}
      {revealed ? (
        <span className="ml-0.5 font-mono text-sm font-medium text-fg">
          {vote ?? "–"}
        </span>
      ) : (
        <span
          role="img"
          aria-label={vote ? "voted" : "no vote yet"}
          className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
            vote ? "bg-accent" : "bg-line-strong"
          }`}
        />
      )}
    </li>
  );
}

function VoteSummary({ votes }: { votes: Record<string, FibonacciCard> }) {
  const counts = new Map<FibonacciCard, number>();
  for (const vote of Object.values(votes)) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  const ordered = FIBONACCI_DECK.filter((card) => counts.has(card));
  const consensus = voteConsensus(votes);

  if (ordered.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-fg-faint">No votes to show.</p>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {consensus && (
        <StatusPill tone="success" dot>
          Consensus · {consensus}
        </StatusPill>
      )}
      {ordered.map((card) => (
        <span
          key={card}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-sm text-fg-secondary"
        >
          {card}
          <span className="text-fg-faint">×{counts.get(card)}</span>
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Shown when the session has no story being estimated and the ServiceNow queue
 * has not been exhausted yet (e.g. the room was just created, or a manual/legacy
 * room ran out of stories). In the ServiceNow-first flow, stories come from the
 * backlog — never a hand-typed form — so this points the host back to selection.
 */
function EmptySessionView({
  roomSlug,
  hasHistory,
}: {
  roomSlug: string;
  hasHistory: boolean;
}) {
  return (
    <Panel className="mx-auto max-w-lg px-6 py-14 text-center">
      <Eyebrow>SprintParty for ServiceNow</Eyebrow>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        {hasHistory ? "No more stories in this session" : "No stories yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-fg-muted">
        Stories are pulled from your ServiceNow backlog. Choose the ones your
        team should refine next and add them to the Planning Queue.
      </p>
      <Button
        href={withRoomParam("/servicenow/stories", roomSlug)}
        variant="primary"
        size="md"
        className="mt-6"
      >
        Choose ServiceNow stories
      </Button>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

function PlanningCompleteView({
  stories,
  roomSlug,
}: {
  stories: Story[];
  roomSlug: string;
}) {
  return (
    <div className="pb-16">
      <Panel tone="success" className="px-6 py-8 text-center">
        <StatusPill tone="success" dot className="mx-auto">
          Planning complete
        </StatusPill>
        <p className="mx-auto mt-3 max-w-md text-sm text-fg-secondary">
          Every story from the ServiceNow Planning Queue has been estimated.
        </p>
      </Panel>

      <Panel className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-fg-muted">
                <th scope="col" className="w-36 px-4 py-2.5 font-medium">
                  Number
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Short description
                </th>
                <th scope="col" className="w-28 px-4 py-2.5 font-medium">
                  Source pts
                </th>
                <th scope="col" className="w-52 px-4 py-2.5 font-medium">
                  Team result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stories.map((story) => {
                const votes = Object.values(story.votes);
                const consensus = voteConsensus(story.votes);
                return (
                  <tr key={story.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">
                      {story.origin.externalNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-fg">{story.title}</td>
                    <td className="px-4 py-3 text-fg-muted">
                      {typeof story.origin.externalPoints === "number"
                        ? story.origin.externalPoints
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {votes.length === 0 ? (
                        <span className="text-fg-faint">No votes</span>
                      ) : consensus ? (
                        <StatusPill tone="success">
                          Consensus {consensus}
                        </StatusPill>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {votes.map((vote, index) => (
                            <span
                              key={index}
                              className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-fg-secondary"
                            >
                              {vote}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button
          href={withRoomParam("/servicenow/stories", roomSlug)}
          variant="primary"
          size="md"
        >
          Add more ServiceNow stories
        </Button>
        <Button
          href={withRoomParam("/servicenow/queue", roomSlug)}
          variant="secondary"
          size="md"
        >
          View Planning Queue
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HistoryList({
  stories,
  participantCount,
}: {
  stories: Story[];
  participantCount: number;
}) {
  return (
    <section className="mt-12 border-t border-line pb-8 pt-8">
      <Eyebrow>Session history</Eyebrow>
      <h2 className="mt-2 text-base font-semibold text-fg">
        Stories already estimated
      </h2>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {stories
          .slice()
          .reverse()
          .map((story) => {
            const votes = Object.values(story.votes);
            const consensus = voteConsensus(story.votes);
            return (
              <li
                key={story.id}
                className="flex items-center gap-3 bg-surface px-4 py-3"
              >
                {story.origin.externalNumber && (
                  <span className="hidden shrink-0 font-mono text-xs text-fg-muted sm:inline">
                    {story.origin.externalNumber}
                  </span>
                )}
                <span className="truncate text-sm text-fg">{story.title}</span>
                <span className="ml-auto shrink-0 text-xs text-fg-faint">
                  {votes.length}/{participantCount}
                </span>
                {consensus ? (
                  <StatusPill tone="success" className="shrink-0">
                    {consensus}
                  </StatusPill>
                ) : votes.length > 0 ? (
                  <StatusPill tone="neutral" className="shrink-0">
                    split
                  </StatusPill>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
