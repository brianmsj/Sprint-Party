import { Brand } from "@/app/components/Brand";
import { Button } from "@/app/components/ui/Button";
import { Footer } from "@/app/components/ui/AppShell";
import { Eyebrow } from "@/app/components/ui/Panel";
import { StatusPill } from "@/app/components/ui/StatusPill";

const AVAILABLE = ["Refinement", "Planning Poker"];
const UPCOMING = ["Sprint Planning", "Standups", "Retrospectives"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg-elevated/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <div className="flex items-center gap-1.5">
            <a
              href="#how-it-works"
              className="hidden rounded-md px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:text-fg sm:inline-flex"
            >
              How it works
            </a>
            <Button href="/create" variant="primary" size="sm">
              Start free
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero ------------------------------------------------------------ */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <StatusPill tone="accent" dot className="mx-auto">
              AI-powered Scrum suite
            </StatusPill>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Your development team&apos;s entire sprint.
              <span className="block text-fg-muted">One place.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-fg-secondary sm:text-lg">
              The AI-powered Scrum suite for Jira, Azure DevOps, GitHub, and
              ServiceNow teams.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/create" variant="primary" size="lg" glow>
                Start free
              </Button>
              <Button href="#how-it-works" variant="secondary" size="lg">
                Watch demo
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
              {AVAILABLE.map((f) => (
                <StatusPill key={f} tone="neutral">
                  {f}
                </StatusPill>
              ))}
              {UPCOMING.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-0.5 text-xs font-medium text-fg-faint"
                >
                  {f}
                  <span className="text-[0.625rem] uppercase tracking-wide">
                    soon
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Restrained product preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <RoomPreview />
          </div>
        </section>

        {/* How it works ------------------------------------------------------ */}
        <section
          id="how-it-works"
          className="border-t border-line bg-bg-elevated"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight">
              From backlog to a shared estimate, without the busywork.
            </h2>

            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Connect the backlog",
                  "Pull stories straight from ServiceNow — no re-typing tickets into another tool.",
                ],
                [
                  "Build the queue",
                  "Pick the stories for this session and order them the way you want to run them.",
                ],
                [
                  "Refine with AI",
                  "SprintParty AI flags what's unclear and what the team should discuss before voting.",
                ],
                [
                  "Vote and reveal",
                  "Private Fibonacci votes, revealed together. Re-round or move on in one click.",
                ],
              ].map(([title, body], i) => (
                <div key={title}>
                  <span className="font-mono text-xs text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-fg-muted">{body}</p>
                </div>
              ))}
            </div>

            <p className="mt-14 text-xs text-fg-faint">
              Available today: {AVAILABLE.join(" · ")}. Sprint Planning,
              Standups, and Retrospectives are on the roadmap.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Static, monochrome mock of the room screen — sets visual expectations. */
function RoomPreview() {
  const deck = ["1", "2", "3", "5", "8", "13", "21", "?"];
  return (
    <div className="sp-panel overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-fg-muted">STRY0043122</span>
          <StatusPill tone="warning" dot>
            Needs clarification
          </StatusPill>
        </div>
        <span className="font-mono text-xs text-fg-faint">Story 3 / 7</span>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-[1.1fr_1fr]">
        <div className="bg-surface p-5">
          <h3 className="text-base font-semibold tracking-tight">
            Rate-limit the public webhook endpoint
          </h3>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            As a platform engineer, I want per-tenant rate limiting on
            <span className="text-fg-secondary"> /v1/webhooks</span> so a single
            noisy integration can&apos;t exhaust shared capacity.
          </p>
        </div>

        <div className="bg-surface p-5">
          <div className="grid grid-cols-4 gap-2">
            {deck.map((c) => (
              <div
                key={c}
                className={[
                  "flex h-12 items-center justify-center rounded-md border font-mono text-sm",
                  c === "5"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-fg-secondary",
                ].join(" ")}
              >
                {c}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-9 flex-1 rounded-md bg-accent/90" />
            <div className="h-9 w-24 rounded-md border border-line-strong" />
          </div>
        </div>
      </div>
    </div>
  );
}
