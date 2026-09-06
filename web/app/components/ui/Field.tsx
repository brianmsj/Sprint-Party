import type { ReactNode } from "react";

/** Shared input class. Compose with `inputClassName(hasError)`. */
export function inputClassName(hasError = false): string {
  return [
    "w-full rounded-md border bg-bg px-3 text-sm text-fg h-10",
    "placeholder:text-fg-faint transition-colors duration-150",
    "focus:outline-none focus:ring-2 focus:ring-accent/40",
    hasError
      ? "border-danger focus:border-danger"
      : "border-line-strong focus:border-accent",
  ].join(" ");
}

/** Labelled form field wrapper with hint + error slots. */
export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-xs font-medium text-fg-secondary"
      >
        {label}
        {required && (
          <span className="text-accent" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
