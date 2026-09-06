SprintParty — a free online Planning Poker app for Agile teams, plus the
beginnings of an AI sprint‑refinement workspace for ServiceNow.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## ServiceNow integration (local setup)

SprintParty can pull real Agile stories from a ServiceNow instance / PDI
(`rm_story` table) and show them at [`/servicenow/stories`](http://localhost:3000/servicenow/stories).

Credentials are read **only on the server** by the API route
`GET /api/servicenow/stories`. They are never bundled into browser code, and the
password is never sent to the client.

### 1. Create `.env.local`

```bash
cp .env.example .env.local
```

### 2. Fill in the three variables

| Variable | Description | Example |
| --- | --- | --- |
| `SERVICENOW_INSTANCE_URL` | Base URL of your instance / PDI, **no trailing slash** | `https://dev123456.service-now.com` |
| `SERVICENOW_USERNAME` | A ServiceNow user with read access to `rm_story` | `admin` |
| `SERVICENOW_PASSWORD` | That user's password (server-side only) | `••••••••` |

`.env.local` is gitignored — do not commit real credentials. Only the
credential-free `.env.example` is committed.

### 3. Restart the dev server

Next.js only reads env files at startup:

```bash
npm run dev
```

Then open [http://localhost:3000/servicenow/stories](http://localhost:3000/servicenow/stories).

### Notes

- Auth is temporary HTTP Basic. It is isolated in `app/lib/servicenow/auth.ts`
  so it can be swapped for OAuth later without touching the REST client, the API
  route, or the UI.
- A hibernating PDI reports as **ServiceNow Disconnected** — wake it in the
  ServiceNow developer portal and click **Try again**.

## ServiceNow → SprintParty end-to-end flow

The ServiceNow integration is an **adapter** on top of the normal SprintParty
Planning Poker engine — there is no separate voting implementation.

```
/servicenow/stories   select stories → "Add to Planning Queue"
        │
        ▼
/servicenow/queue     reorder (Move Up/Down), remove, clear;
                      enter host name → "Start SprintParty"
        │
        ▼
/room/[slug]          existing room, seeded with the queued stories in order.
                      First story is active. Vote → Reveal → New Round.
                      "Next Story" auto-advances through the queue
                      (no add-story prompt). After the last story:
                      "Planning complete" + session summary.
```

Key pieces:

- `app/lib/planningQueue.ts` — source-agnostic queue (localStorage today), dedupes
  by `"<source>:<externalId>"`, preserves insertion order.
- `app/lib/servicenow/adapter.ts` — maps a `rm_story` record to a generic
  `QueuedStory`. A Jira / Azure DevOps adapter would sit beside it.
- `app/lib/rooms.ts` — `Story.origin` carries `source` / `externalId` /
  `externalNumber` / `externalPoints`; `Room.flow` is `"manual"` (add-story
  prompt when idle, unchanged) or `"queue"` (show the completion summary when the
  queue is exhausted). A manually created room passes neither and behaves exactly
  as before.

Field mapping (ServiceNow → SprintParty `Story`):

| ServiceNow `rm_story` | SprintParty `Story` |
| --- | --- |
| `short_description` | `title` |
| `description` | `userStory` |
| `acceptance_criteria` | `acceptanceCriteria` (normalized to plain text) |
| `number` | `origin.externalNumber` (shown as a badge in the room) |
| `sys_id` | `origin.externalId` |
| `story_points` | `origin.externalPoints` (or “Unestimated”) |
| — | `origin.source = "servicenow"` |

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
