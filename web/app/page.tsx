import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">
            SprintParty
          </div>

          <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#how-it-works" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
          </div>

          <Link
            href="/create"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create a Room
          </Link>
        </nav>

        <div className="grid gap-14 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-5 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Free planning poker · No signup required
            </div>

            <h1 className="max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl">
              Planning poker your team will actually enjoy.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Create a room, share a link, vote privately, reveal together, and
              get an independent AI estimate with story points, effort,
              reasoning, assumptions, and risks.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/create"
                className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700"
              >
                Start a SprintParty
              </Link>

              <button className="rounded-xl border border-slate-300 px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50">
                See how it works
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              No signup. No credit card. Just start estimating.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Room
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    agile-fox-4821
                  </h2>
                </div>

                <div className="text-sm text-emerald-600">● 4 participants</div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold">User Story</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  As a user, I want to reset my password so that I can regain
                  access to my account.
                </p>

                <p className="mt-4 text-sm font-semibold">
                  Acceptance Criteria
                </p>

                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>• User can request a password reset via email</li>
                  <li>• Reset link expires after 30 minutes</li>
                  <li>• User can set a new password</li>
                </ul>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-3">
                {[
                  ["B", "Brian", "5"],
                  ["K", "Krystle", "?"],
                  ["C", "Cheese", "8"],
                  ["AI", "AI", "…"],
                ].map(([initial, name, vote]) => (
                  <div
                    key={name}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {initial}
                      </div>
                      <span className="text-sm font-medium">{name}</span>
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-100 py-4 text-center text-2xl font-bold">
                      {vote}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-center">
                <p className="text-sm font-semibold text-blue-700">
                  Votes are private
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Choose your estimate below
                </p>
              </div>

              <div className="mt-4 grid grid-cols-8 gap-2">
                {[1, 2, 3, 5, 8, 13, 21, "?"].map((point) => (
                  <button
                    key={point}
                    className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold hover:border-blue-400 hover:bg-blue-50"
                  >
                    {point}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-slate-100 bg-slate-50"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              How SprintParty works
            </h2>
            <p className="mt-3 text-slate-600">
              From user story to team estimate in seconds.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              [
                "1",
                "Create a Room",
                "Paste your story and acceptance criteria.",
              ],
              [
                "2",
                "Share the Link",
                "Invite your team with a simple room URL.",
              ],
              [
                "3",
                "Vote Privately",
                "Everyone picks a Fibonacci story-point estimate.",
              ],
              [
                "4",
                "Reveal + AI",
                "Compare the team’s votes with an independent AI estimate.",
              ],
            ].map(([number, title, description]) => (
              <div key={number}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  {number}
                </div>

                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}