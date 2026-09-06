import type { ElementType, ReactNode } from "react";

type Tone = "default" | "danger" | "success";

const TONES: Record<Tone, string> = {
  default: "border-line bg-surface",
  danger: "border-danger/25 bg-danger-soft/60",
  success: "border-success/25 bg-success-soft/50",
};

/**
 * Bordered surface container — the base card/panel primitive.
 * Thin border, near-black fill, subtle radius. No heavy shadows.
 */
export function Panel({
  as,
  tone = "default",
  interactive = false,
  sheen = false,
  className = "",
  children,
}: {
  as?: ElementType;
  tone?: Tone;
  /** Adds a restrained hover treatment for clickable panels. */
  interactive?: boolean;
  /** Adds the top-lit sheen used on flagship room surfaces. */
  sheen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as ?? "div";
  return (
    <Tag
      className={[
        "rounded-xl border",
        sheen ? "sp-panel" : TONES[tone],
        interactive
          ? "transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

/** Small uppercase section label used above panel content. */
export function Eyebrow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={`text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-muted ${className}`}
    >
      {children}
    </p>
  );
}
