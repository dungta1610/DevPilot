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
