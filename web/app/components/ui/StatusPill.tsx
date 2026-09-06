import type { ReactNode } from "react";

export type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

const TONES: Record<PillTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "border-line bg-surface text-fg-secondary",
    dot: "bg-fg-muted",
  },
  accent: {
    wrap: "border-accent-line bg-accent-soft text-accent",
    dot: "bg-accent",
  },
  success: {
    wrap: "border-success/25 bg-success-soft text-success",
    dot: "bg-success",
  },
  warning: {
    wrap: "border-warning/25 bg-warning-soft text-warning",
    dot: "bg-warning",
  },
  danger: {
    wrap: "border-danger/25 bg-danger-soft text-danger",
    dot: "bg-danger",
  },
};

/**
 * Compact status indicator. Thin border, muted fill, optional leading dot.
 */
export function StatusPill({
  tone = "neutral",
  dot = false,
  className = "",
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${t.wrap} ${className}`}
    >
      {dot && (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${t.dot}`}
        />
      )}
      {children}
    </span>
  );
}
