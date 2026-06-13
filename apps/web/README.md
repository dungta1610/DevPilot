# DevPilot

AI-powered developer workflow platform. Developers submit a GitHub PR URL; a
durable AI agent (Restate + LangGraph, on the backend) reviews it across several
sub-agents (quality, security, performance), then **waits for a human to
approve** before posting the review comment to GitHub.

This repository is the **frontend** (Next.js App Router).

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict
- Tailwind CSS v4 + shadcn/ui (base-nova / Base UI primitives)
- TanStack Query for server state
- React Hook Form + Zod for forms
- `@dnd-kit` for the kanban board
- NextAuth (Auth.js) with GitHub OAuth
- Lucide icons, Sonner toasts

## Getting started

```bash
pnpm install
pnpm dev
# http://localhost:3000  →  redirects to /projects
```

The app ships in **mock mode** by default (`NEXT_PUBLIC_USE_MOCKS=true` in
`.env.local`), so the entire UI — including a simulated ~15s agent run — works
with no backend. On the login screen, choose **Continue in demo mode**.

### Connecting the real backend

Set the env vars (see `.env.example`):

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_URL=http://localhost:3001
AUTH_SECRET=...            # openssl rand -base64 32
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
```

Every call in `lib/api.ts` transparently switches from mocks to the NestJS
backend based on `NEXT_PUBLIC_USE_MOCKS`.

## Project structure

```
app/
  (auth)/login            GitHub OAuth + demo entry
  (app)/                  app shell (sidebar + top nav)
    projects/             list, create
    projects/[id]/        overview · tasks · reviews · assistant · settings
  api/auth/[...nextauth]  Auth.js route handler
components/
  layout/ projects/ tasks/ reviews/ assistant/ shared/ ui/
lib/
  types.ts                API contract types (single source of truth)
  api.ts                  typed client with mock switch
  mocks.ts                realistic in-memory data
  queries.ts              TanStack Query hooks + query keys
  use-review-stream.ts    SSE hook (real EventSource + scripted mock stream)
```

## The review detail screen

`app/(app)/projects/[id]/reviews/[reviewId]/page.tsx` is the core screen and has
three states: **running** (live agent pipeline + activity log via SSE),
**awaiting approval** (prominent amber banner + summary + deliberate
approve/reject), and **completed**. `lib/use-review-stream.ts` merges SSE events
into the TanStack Query cache in place so the pipeline animates without
refetching; in mock mode it replays a scripted run.

## Scripts

```bash
pnpm dev         # dev server
pnpm build       # production build
pnpm start       # serve production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
```
