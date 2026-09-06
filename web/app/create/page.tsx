"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/ui/AppShell";
import { Button } from "@/app/components/ui/Button";
import { Field, inputClassName } from "@/app/components/ui/Field";
import { Eyebrow } from "@/app/components/ui/Panel";
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
    <AppShell
      width="narrow"
      actions={
        <Button href="/" variant="ghost" size="sm">
          Home
        </Button>
      }
    >
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center py-10">
        <Eyebrow>New session</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Create a SprintParty
        </h1>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          Name the session, then pick the stories to refine straight from your
          ServiceNow backlog. The session link stays the same.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <Field
            id="hostName"
            label="Your name"
            required
            error={errors.hostName}
          >
            <input
              id="hostName"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="e.g. Brian"
              value={form.hostName}
              onChange={(event) => update("hostName", event.target.value)}
              className={inputClassName(Boolean(errors.hostName))}
            />
          </Field>

          <Field
            id="roomName"
            label="Session name"
            hint="Optional — e.g. “Team Rocket · Sprint 14”."
          >
            <input
              id="roomName"
              type="text"
              placeholder="Optional"
              value={form.roomName}
              onChange={(event) => update("roomName", event.target.value)}
              className={inputClassName(false)}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            glow
            disabled={submitting}
          >
            {submitting ? "Setting up…" : "Choose ServiceNow stories"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-fg-faint">
          No signup required. Your session is stored in this browser for now.
        </p>
      </div>
    </AppShell>
  );
}
