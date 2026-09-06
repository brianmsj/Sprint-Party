"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/app/components/Brand";
import { createRoom, type CreateRoomInput } from "@/app/lib/rooms";
import { rememberHostName, withRoomParam } from "@/app/lib/session";

type FieldErrors = Partial<Record<keyof CreateRoomInput, string>>;

const EMPTY_FORM: CreateRoomInput = {
  hostName: "",
  roomName: "",
};

function validate(values: CreateRoomInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.hostName.trim()) {
    errors.hostName = "Enter your name so your team knows who is hosting.";
  }
  return errors;
}

export default function CreateRoomPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateRoomInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof CreateRoomInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    rememberHostName(form.hostName);
    // ServiceNow-first flow: create the session now, then send the host to pick
    // ServiceNow stories. The room slug rides along so those stories start in
    // this same room — no second room is created.
    const room = createRoom({ ...form, flow: "queue" });
    router.push(withRoomParam("/servicenow/stories", room.slug));
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
        <nav className="flex items-center justify-between">
          <Brand />
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back home
          </Link>
        </nav>

        <div className="py-12 sm:py-16">
          <div className="mb-5 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            New SprintParty · No signup required
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Create a SprintParty
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
            A SprintParty is your team&apos;s refinement session. Name it, then
            pick the stories to refine straight from your ServiceNow backlog —
            the session link stays the same.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-8"
          >
            <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <Field
                id="hostName"
                label="Host name"
                required
                error={errors.hostName}
              >
                <input
                  id="hostName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Brian"
                  value={form.hostName}
                  onChange={(event) => update("hostName", event.target.value)}
                  className={inputClass(Boolean(errors.hostName))}
                />
              </Field>

              <Field
                id="roomName"
                label="Room name"
                hint="Optional — e.g. “Team Rocket Sprint 14”."
              >
                <input
                  id="roomName"
                  type="text"
                  placeholder="Optional"
                  value={form.roomName}
                  onChange={(event) => update("roomName", event.target.value)}
                  className={inputClass(false)}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
            >
              {submitting ? "Setting up…" : "Choose ServiceNow stories →"}
            </button>

            <p className="mt-4 text-center text-sm text-slate-500">
              Next: pick stories from ServiceNow and build your Planning Queue.
              Your session is stored in this browser for now.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none",
    "placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200",
    hasError
      ? "border-red-400 focus:border-red-400"
      : "border-slate-300 focus:border-blue-400",
  ].join(" ");
}

function Field({
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
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-sm font-semibold text-slate-900"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
