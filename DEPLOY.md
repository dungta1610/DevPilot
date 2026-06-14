# DevPilot — Deployment

```
Browser
  └── Vercel (apps/web — Next.js)
        └── Railway (apps/api — NestJS) ─────────────────┐
              ├── Railway PostgreSQL                      │
              └── Restate Cloud ◄──── Railway (apps/agent)┘
```

Three providers, all with free tiers: **Vercel** (web), **Railway** (api + agent
+ Postgres), **Restate Cloud** (managed Restate server). Everything below is the
manual provisioning sequence — the repo already contains the deploy artifacts
(`railway.json` per service, `apps/agent/Dockerfile`, `apps/web/vercel.json`,
`*.env.production.example`, health endpoints).

> Both apps are **leaf packages** (only external deps, no internal workspace
> deps), so each can be built in isolation by setting the Railway service **root
> directory** to `apps/api` / `apps/agent`. The pnpm lockfile lives at the repo
> root; if a service build can't resolve it, enable Railway's "use root
> directory as build context" or commit a per-app lockfile.

## 0. Prerequisites

- A GitHub OAuth App (you'll update its URLs at the end).
- A Google **Gemini** API key and a GitHub **PAT** (repo scope) for the agent.
- Generate two strong secrets: `JWT_SECRET` and `API_INTERNAL_SECRET`
  (`openssl rand -hex 32`). `API_INTERNAL_SECRET` must be **identical** on the
  api and agent services.

## 1. Restate Cloud

1. Sign up at `cloud.restate.dev` → create an environment (e.g. `devpilot-prod`).
2. Note the **ingress URL** (`https://<env-id>.ingress.<region>.restate.cloud`)
   and create an **API key**.
3. These map to `RESTATE_INGRESS_URL` / `RESTATE_SERVER_URL` and `RESTATE_API_KEY`.

The api's `RestateClient` automatically adds `Authorization: Bearer
$RESTATE_API_KEY` to ingress calls when the key is set (no code change needed —
it's omitted for local Restate).

## 2. Railway — Postgres + api + agent

1. New project → **Add PostgreSQL**. Railway sets `DATABASE_URL` on services that
   reference it.
2. **api service**: deploy from this repo, root directory `apps/api`. It uses
   `apps/api/railway.json` (Nixpacks):
   - build: `pnpm install && pnpm prisma generate && pnpm build`
   - start: `pnpm prisma migrate deploy && pnpm start:prod` (migrations run on
     every deploy — safe & idempotent)
   - healthcheck: `GET /health`
   - Set env vars from `apps/api/.env.production.example`.
3. **agent service**: deploy from this repo, root directory `apps/agent`. It uses
   `apps/agent/railway.json` (Dockerfile). Set env from
   `apps/agent/.env.production.example`. **Crucially set `AGENT_PORT=${PORT}`** —
   Railway exposes one public port per service and Restate Cloud must reach the
   agent's Restate server on it. (The `:9081` health probe is therefore not
   publicly routable here; Railway uses a process/port check for this service.)

## 3. Register the agent with Restate Cloud

After the agent is live at `https://your-agent.up.railway.app`, register it once
(re-run after a breaking deploy; `force: true` updates in place):

```bash
curl -X POST https://<env-id>.admin.<region>.restate.cloud/deployments \
  -H "Authorization: Bearer $RESTATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uri": "https://your-agent.up.railway.app", "force": true}'
```

Confirm all three services appear: `ReviewWorkflow`, `ProjectAssistant`,
`DigestAgent`.

## 4. Vercel — web

1. Import the repo, root directory `apps/web` (uses `apps/web/vercel.json`).
2. Env vars (dashboard):
   - `NEXT_PUBLIC_API_URL=https://your-api.up.railway.app`
   - `NEXT_PUBLIC_USE_MOCKS=false`
   - `NEXTAUTH_URL=https://your-app.vercel.app`, `NEXTAUTH_SECRET=…`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (same OAuth app as the api)

## 5. Update the GitHub OAuth app

- Homepage URL → `https://your-app.vercel.app`
- Authorization callback URL → `https://your-api.up.railway.app/auth/github/callback`

## 6. Smoke test

`GET https://your-api.up.railway.app/health` → `{"status":"ok"}`, then run the
end-to-end checklist below.

---

## End-to-end production checklist

```
Auth
  □ GitHub OAuth login works on the production domain
  □ JWT persists across refreshes

Review agent (core flow)
  □ Submit a real PR URL from a linked repo
  □ Pipeline shows live progress; all 3 sub-agents complete
  □ Approval panel appears; Approve → comment on the real PR; Reject → ends clean
  □ Cancel a review awaiting approval → ends without posting

Crash recovery
  □ Start a review, Restart the agent service mid-run (Railway → Restart)
  □ Run resumes from the correct step (visible in the Restate Cloud dashboard)

Project assistant
  □ Message returns a response grounded in real project data
  □ History persists after refresh
  □ Two quick messages → second waits for the first (Virtual Object guarantee)

Daily digest
  □ Start the digest agent; it shows as "sleeping" in Restate Cloud
  □ Restart the agent service → the sleeping timer survives
  □ Digest appears in the project overview after it fires

Restate Cloud dashboard
  □ ReviewWorkflow, ProjectAssistant, DigestAgent all visible
  □ Journal entries for completed reviews; sleeping DigestAgent invocations
```

## Production hardening already in the code (Track A)

- **TerminalError classification** — invalid PR URL, 404/private repo, and
  401/403 auth failures are terminal (no retry, no wasted Gemini quota); 5xx /
  rate-limit / network errors retry with backoff.
- **Explicit retry policies** — `LLM_RETRY` / `GITHUB_RETRY` on every external
  `ctx.run`; best-effort notify pings retry a few times.
- **Robust LLM JSON parsing** — `parseLLMJson` (direct → de-fence → extract
  block) replaces raw `JSON.parse`; failures are retryable, with a graceful
  fallback so one malformed response doesn't sink a review.
- **`cancel` handler** on `ReviewWorkflow` (a version-safe additive change) +
  `POST /reviews/:id/cancel`.
- **Digest self-stop** — the loop terminates itself if the project is deleted,
  while transient failures keep it alive.
