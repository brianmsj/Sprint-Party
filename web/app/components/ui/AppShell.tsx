import type { ReactNode } from "react";
import { Brand } from "@/app/components/Brand";

type Width = "default" | "narrow";

const WIDTHS: Record<Width, string> = {
  default: "max-w-6xl",
  narrow: "max-w-2xl",
};

/**
 * The application shell: a compact sticky header with the SprintParty wordmark,
 * an optional breadcrumb and an actions slot, a width-constrained content area,
 * and a minimal footer. Used by every in-app screen for consistent chrome.
 */
export function AppShell({
  breadcrumb,
  actions,
  width = "default",
  contentClassName = "",
  children,
}: {
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  width?: Width;
  contentClassName?: string;
  children: ReactNode;
}) {
  const container = `mx-auto w-full px-5 lg:px-8 ${WIDTHS[width]}`;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg-elevated/80 backdrop-blur-md">
        <div className={`${container} flex h-14 items-center justify-between gap-4`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Brand />
            {breadcrumb && (
              <>
                <span className="text-fg-faint" aria-hidden>
                  /
                </span>
                <span className="truncate text-sm text-fg-secondary">
                  {breadcrumb}
                </span>
              </>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className={`${container} py-10 ${contentClassName}`}>{children}</div>
      </main>

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-fg-muted sm:flex-row lg:px-8">
        <span>© {new Date().getFullYear()} SprintParty</span>
        <span className="text-fg-faint">
          Refinement · Planning Poker · built for engineering teams
        </span>
      </div>
    </footer>
  );
}
