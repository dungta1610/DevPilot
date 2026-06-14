# DevPilot Agent (`apps/agent`)

Durable PR-review pipeline: **Restate** orchestrates a **LangGraph** agent graph
that reviews a GitHub PR with **Gemini 2.5 Flash**, streams progress to the UI,
and waits for human approval before posting a GitHub comment.

This is a standalone ESM TypeScript server (run with `tsx`) — separate from the
NestJS API. Restate calls into it; it calls back into the API's `/internal/*`
endpoints to report step progress (which power the SSE stream).

## Graph

```
START → fetch_pr → orchestrator ─┬→ quality_agent  ─┐
                                 ├→ security_agent ─┼→ synthesizer → human_approval ─(approved)→ post_comment → END
                                 └→ perf_agent     ─┘                              └─(rejected/timeout)──────────────→ END
```

Each node wraps its external work in `ctx.run(...)` so the result is **journaled**:
on a crash, Restate replays the journal and every completed step returns its
cached result instantly, fast-forwarding to the first un-finished step.

`human_approval` mints a Restate **awakeable** (a durable promise) and suspends —
zero compute while it waits. The API's approve/reject endpoints resolve that
awakeable through Restate's ingress awakeable API, resuming the graph. A 24h
timer auto-rejects if no one responds.

## Run it

Prereqs: Postgres + Restate up (`pnpm db:up` from the repo root) and the API
running (`pnpm dev:api`).

```bash
# 1. configure — copy and fill GOOGLE_API_KEY + GITHUB_APP_TOKEN
cp apps/agent/.env.example apps/agent/.env

# 2. start the agent (listens on :9080)
pnpm dev:agent            # or: pnpm --filter agent start

# 3. register the deployment with Restate (one time, after it's listening)
pnpm agent:register
```

`GOOGLE_API_KEY` / `GITHUB_APP_TOKEN` are only needed when a review actually
runs — the server boots and registers without them.

To drive a review end-to-end, set the web app to use the real backend
(`NEXT_PUBLIC_USE_MOCKS=false` in `apps/web/.env.local`) and trigger a review on
a PR from the UI, or:

```bash
curl -X POST http://localhost:3001/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<uuid>","prUrl":"https://github.com/owner/repo/pull/1"}'
```

## Crash-recovery test (the durability proof)

```bash
# 1. trigger a review (above) and watch the agent log until "quality_agent" runs
# 2. kill the agent hard, mid-flight:
kill -9 $(lsof -t -i:9080)
# 3. restart it:
pnpm --filter agent start
```

Restate redelivers the in-flight invocation. Steps that already completed
(`fetch_pr`, `orchestrator`, …) are **not** re-executed — their `ctx.run`
results are replayed from the journal — and execution resumes at the step that
was interrupted. The human-approval awakeable likewise survives the restart.

## Notes / Phase-2 deviations from the original plan

- **ESM + tsx.** `@octokit/rest` v22 is ESM-only, and the Restate/LangChain
  stack is ESM-first, so the package is `"type": "module"` and run via `tsx`
  (no separate build step needed).
- **Verified against the installed majors** (Restate SDK 1.14, LangGraph 1.4):
  `ctx.awakeable()` returns `{ id, promise }` (not a tuple); the approval/timeout
  race uses `RestatePromise.race([promise, ctx.sleep(ms).map(...)])`.
- **`post_comment` is its own node** (the web pipeline expects that step), routed
  to only on approval — rather than posting inside `human_approval`.
- **Approval via the awakeable ingress API** (the API resolves by awakeable id),
  not a `submitApproval` workflow handler.
- **Progress pings** (`notify*`) are best-effort and live outside the journal;
  the API records them idempotently and never lets a failed ping fail a review.

## Phase 3 — Virtual Object & durable sleep

Two more Restate primitives, bound alongside the review workflow in `index.ts`:

### ProjectAssistant — Virtual Object (`restate/project-assistant.ts`)

A stateful per-project chat assistant. `restate.object()` keyed by `projectId`:

- `chat` (exclusive) runs a ReAct agent (Gemini + the `get_tasks` / `get_reviews`
  / `get_stats` tools) and appends the turn to the object's K/V `history`.
  Exclusive handlers run **one at a time per key**, so two users messaging the
  same project serialize automatically — no Redis/Postgres lock. The LLM call is
  wrapped in `ctx.run`, so a crash mid-response replays instead of re-billing.
- `getHistory` (shared) reads history concurrently without blocking `chat`.
- `clearHistory` (exclusive) resets the conversation.

The NestJS `/projects/:id/chat[/history]` routes forward to this object over the
ingress; the tools call back into the API's `/internal/projects/:id/*` data
endpoints (shared-secret guarded).

### DigestAgent — durable sleep (`restate/digest-agent.ts`)

A `restate.workflow()` keyed by `projectId` whose `run` handler loops **forever**
with `await ctx.sleep(interval)` at the bottom — a Restate timer, not
`setTimeout`. Each iteration generates a digest (Gemini over the last 24h of
activity) and POSTs it to the API. `getStatus` (shared) exposes the loop state.

Each digest step uses a **bounded** `ctx.run(..., { maxRetryAttempts: 5 })`: a
thrown error inside `ctx.run` is *retryable*, so without a bound a failing step
would retry forever and the loop would never reach the sleep. With the bound,
exhausted retries surface as a `TerminalError` into the `try/catch`, the bad day
is logged, and the loop sleeps until the next cycle.

`DIGEST_INTERVAL_MS` (default 24h) overrides the interval — set it small to watch
the loop fire during the experiment below.

### The two experiments

**Concurrency (Virtual Object serializes per key)** — fire two chats at the same
project simultaneously; the second waits for the first. Without Restate you'd
need a distributed lock for consistent history.

```bash
curl -X POST http://localhost:8080/ProjectAssistant/$PROJECT_ID/chat \
  -H 'Content-Type: application/json' -d '{"message":"list overdue tasks","userId":"u1"}' &
curl -X POST http://localhost:8080/ProjectAssistant/$PROJECT_ID/chat \
  -H 'Content-Type: application/json' -d '{"message":"team velocity?","userId":"u2"}' &
```

**Durable sleep (timer survives a restart)** — start the agent for a project,
note the sleeping invocation in the Restate UI (`localhost:9070`), `kill -9` the
agent, restart it, and confirm the timer is still there and fires on the new
process.

```bash
curl -X POST http://localhost:3001/projects/$PROJECT_ID/digest/start -H "Authorization: Bearer $TOKEN"
# watch localhost:9070 → DigestAgent invocation in "sleeping" state
kill -9 $(lsof -t -i:9080) && pnpm --filter agent start
```

Both experiments need a live `GOOGLE_API_KEY` (the chat/digest LLM steps) and the
API running. Registration of all three services (and their handler types) is
verifiable without credentials via `pnpm agent:register` + the Restate admin API.
