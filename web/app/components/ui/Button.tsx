import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset] hover:bg-accent-hover",
  secondary:
    "border border-line-strong bg-surface text-fg hover:bg-surface-hover hover:border-fg-faint",
  ghost: "text-fg-secondary hover:bg-surface hover:text-fg",
  danger:
    "border border-transparent text-fg-secondary hover:border-danger/30 hover:bg-danger-soft hover:text-danger",
};

/** Restrained accent glow — only on hover/focus, reserved for `glow` CTAs. */
const GLOW =
  "hover:shadow-[0_0_28px_-6px_var(--color-accent)] " +
  "focus-visible:shadow-[0_0_28px_-6px_var(--color-accent)]";

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children" | "href"> & {
    href: string;
  };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "secondary",
    size = "md",
    glow = false,
    fullWidth = false,
    className = "",
    children,
    ...rest
  } = props;

  const classes = [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? "w-full" : "",
    glow ? GLOW : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href !== undefined) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  return (
    // Default to type="button"; an explicit `type` in props overrides it.
    <button type="button" className={classes} {...(rest as ButtonAsButton)}>
      {children}
    </button>
  );
}
