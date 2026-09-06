import Link from "next/link";

/**
 * SprintParty wordmark. A compact monospace-inflected mark with a single
 * accent glyph — restrained, developer-tool feel. Links home by default.
 */
export function Brand({
  className = "",
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span className="inline-flex items-baseline gap-[0.1em] text-[0.95rem] font-semibold tracking-tight text-fg">
      <span
        aria-hidden
        className="mr-1 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-accent"
      />
      SprintParty
    </span>
  );

  if (href === null) {
    return <span className={className}>{mark}</span>;
  }

  return (
    <Link
      href={href}
      className={`rounded-sm text-fg no-underline transition-opacity hover:opacity-80 ${className}`}
    >
      {mark}
    </Link>
  );
}
