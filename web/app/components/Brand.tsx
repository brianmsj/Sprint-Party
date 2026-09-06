import Link from "next/link";

/** SprintParty wordmark, links back to the homepage. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`text-2xl font-bold tracking-tight text-slate-900 ${className}`}
    >
      SprintParty
    </Link>
  );
}
