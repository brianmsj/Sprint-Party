"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Brand } from "@/app/components/Brand";
import { AiReviewPanel } from "@/app/components/AiReviewPanel";
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
      <Shell>
        <p className="py-24 text-center text-slate-500">Loading room…</p>
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Room not found</h1>
          <p className="mt-3 text-slate-600">
            We couldn&apos;t find a room called{" "}
            <span className="font-mono font-semibold">{slug}</span> in this
            browser.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700"
          >
            Create a Room
          </Link>
        </div>
      </Shell>
    );
  }

  const story = activeStory(room);
  const history = completedStories(room);
  const planningComplete = isPlanningComplete(room);
  // One more story is still pending after the active one?
  const hasMorePending = pendingStories(room).length > 1;

  return (
    <Shell>
      <header className="py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Room
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {roomLabel(room)}
          </h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-500">
            {room.slug}
          </span>
          {room.flow === "queue" && (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              ServiceNow queue
            </span>
          )}
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {room.participants.length}{" "}
            {room.participants.length === 1 ? "participant" : "participants"}
          </span>
          {history.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {history.length} estimated
            </span>
          )}
        </div>
      </header>

      {story ? (
        <ActiveStoryView
          room={room}
          story={story}
          hasMorePending={hasMorePending}
          onVote={(card) => mutateRoom((current) => setVote(current, HOST_ID, card))}
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

      {history.length > 0 && !planningComplete && (
        <HistoryList stories={history} participantCount={room.participants.length} />
      )}
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        <nav className="flex items-center justify-between">
          <Brand />
          <Link
            href="/create"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            New room
          </Link>
        </nav>
        {children}
      </section>
    </main>
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
    isQueue && !hasMorePending ? "Finish & view summary →" : "Next Story →";

  return (
    <div className="flex flex-col gap-8 pb-12 xl:flex-row xl:items-start">
      <div className="grid flex-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      {/* Story details */}
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Now estimating
          </p>
          {isQueue && (
            <span className="text-xs font-semibold text-slate-400">
              · Story {position.index} of {position.total}
            </span>
          )}
        </div>

        {story.origin.externalNumber && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
              {story.origin.externalNumber}
            </span>
            {story.origin.source === "servicenow" && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                ServiceNow
              </span>
            )}
            {typeof story.origin.externalPoints === "number" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                Source estimate: {story.origin.externalPoints}
              </span>
            )}
          </div>
        )}

        <h2 className="mt-1 text-lg font-semibold">{story.title}</h2>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold">User Story</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
            {story.userStory}
          </p>

          <p className="mt-4 text-sm font-semibold">Acceptance Criteria</p>
          {lines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {lines.map((line, index) => (
                <li key={index}>• {line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No acceptance criteria provided.
            </p>
          )}
        </div>
      </section>

      {/* Voting */}
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold">Participants</p>
          <div className="mt-3 space-y-3">
            {room.participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {initialsFor(participant.name)}
                  </div>
                  <span className="text-sm font-medium">{participant.name}</span>
                  {participant.isHost && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      Host
                    </span>
                  )}
                </div>

                <VoteBadge
                  revealed={story.revealed}
                  vote={story.votes[participant.id]}
                />
              </div>
            ))}
          </div>

          <div
            className={`mt-5 rounded-2xl p-4 text-center ${
              story.revealed ? "bg-emerald-50" : "bg-blue-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                story.revealed ? "text-emerald-700" : "text-blue-700"
              }`}
            >
              {story.revealed ? "Votes revealed" : "Votes are private"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {story.revealed
                ? "Discuss the spread, then run a new round or move on."
                : "Choose your estimate below."}
            </p>
          </div>

          {story.revealed && <VoteSummary votes={story.votes} />}

          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {FIBONACCI_DECK.map((card) => {
              const selected = hostVote === card;
              return (
                <button
                  key={card}
                  type="button"
                  onClick={() => onVote(card)}
                  aria-pressed={selected}
                  className={`rounded-xl border py-4 text-base font-bold transition-colors ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {card}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onToggleReveal}
              className="flex-1 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700"
            >
              {story.revealed ? "Hide Votes" : "Reveal Votes"}
            </button>
            <button
              type="button"
              onClick={onNewRound}
              className="flex-1 rounded-xl border border-slate-300 px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              New Round
            </button>
          </div>

          <button
            type="button"
            onClick={onNextStory}
            className="mt-3 w-full rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {nextLabel}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {isQueue
            ? "Next Story advances automatically through the ServiceNow Planning Queue."
            : "Voting runs locally in this browser. Realtime multiplayer and an independent AI estimate are coming next."}
        </p>
      </section>
      </div>

      {/* SprintParty AI: refinement assist. On-demand only — never auto-runs. */}
      <div className="xl:w-[380px] xl:flex-shrink-0">
        <AiReviewPanel
          key={story.id}
          number={story.origin.externalNumber ?? ""}
          shortDescription={story.title}
          description={story.userStory}
          acceptanceCriteria={story.acceptanceCriteria}
        />
      </div>
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
    <div className="pb-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          SprintParty for ServiceNow
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {hasHistory ? "No more stories in this session" : "No stories yet"}
        </h2>
        <p className="mt-2 text-slate-600">
          Stories are pulled from your ServiceNow backlog. Choose the ones your
          team should refine next and add them to the Planning Queue.
        </p>
        <Link
          href={withRoomParam("/servicenow/stories", roomSlug)}
          className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700"
        >
          Choose ServiceNow stories
        </Link>
      </div>
    </div>
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
    <div className="pb-12">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          SprintParty
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-emerald-900">
          Planning complete
        </h2>
        <p className="mt-2 text-sm text-emerald-800">
          Every story from the ServiceNow Planning Queue has been estimated.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="w-36 px-4 py-3">
                Number
              </th>
              <th scope="col" className="px-4 py-3">
                Short Description
              </th>
              <th scope="col" className="w-28 px-4 py-3">
                Source pts
              </th>
              <th scope="col" className="w-56 px-4 py-3">
                Team result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stories.map((story) => {
              const votes = Object.values(story.votes);
              const consensus = voteConsensus(story.votes);
              return (
                <tr key={story.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {story.origin.externalNumber || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {story.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {typeof story.origin.externalPoints === "number"
                      ? story.origin.externalPoints
                      : "Unestimated"}
                  </td>
                  <td className="px-4 py-3">
                    {votes.length === 0 ? (
                      <span className="text-slate-400">No votes</span>
                    ) : consensus ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Consensus {consensus}
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {votes.map((vote, index) => (
                          <span
                            key={index}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={withRoomParam("/servicenow/stories", roomSlug)}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add more ServiceNow stories
        </Link>
        <Link
          href={withRoomParam("/servicenow/queue", roomSlug)}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          View Planning Queue
        </Link>
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
    <section className="border-t border-slate-100 pb-20 pt-10">
      <h2 className="text-lg font-semibold">Room history</h2>
      <p className="mt-1 text-sm text-slate-500">
        Stories this room has already estimated.
      </p>

      <ul className="mt-5 space-y-3">
        {stories
          .slice()
          .reverse()
          .map((story) => {
            const votes = Object.values(story.votes);
            return (
              <li
                key={story.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{story.title}</p>
                  <span className="text-xs text-slate-500">
                    {votes.length}/{participantCount} voted
                  </span>
                </div>
                {story.userStory && (
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">
                    {story.userStory}
                  </p>
                )}
                {votes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {votes.map((vote, index) => (
                      <span
                        key={index}
                        className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                      >
                        {vote}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function VoteSummary({ votes }: { votes: Record<string, FibonacciCard> }) {
  const counts = new Map<FibonacciCard, number>();
  for (const vote of Object.values(votes)) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  const ordered = FIBONACCI_DECK.filter((card) => counts.has(card));
  if (ordered.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-slate-400">No votes to show.</p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {ordered.map((card) => (
        <span
          key={card}
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
        >
          {card} × {counts.get(card)}
        </span>
      ))}
    </div>
  );
}

function VoteBadge({
  revealed,
  vote,
}: {
  revealed: boolean;
  vote: FibonacciCard | undefined;
}) {
  if (revealed) {
    return (
      <div className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-100 px-3 text-lg font-bold">
        {vote ?? "–"}
      </div>
    );
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        vote ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
      }`}
    >
      {vote ? "Voted" : "No vote yet"}
    </span>
  );
}

