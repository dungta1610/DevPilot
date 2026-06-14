import './load-env';
import * as restate from '@restatedev/restate-sdk';
import { config } from './config';
import { reviewWorkflow } from './restate/review-workflow';
import { projectAssistant } from './restate/project-assistant';
import { digestAgent } from './restate/digest-agent';

/**
 * Boots the Restate SDK HTTP server and registers the durable handlers. Restate
 * (running in Docker) calls into this server; register the deployment once with
 * `pnpm --filter agent register` after the process is listening.
 *
 * Bound here: the PR-review workflow (Phase 2), the project-assistant Virtual
 * Object, and the daily-digest durable-sleep workflow (Phase 3).
 */
restate
  .endpoint()
  .bind(reviewWorkflow)
  .bind(projectAssistant)
  .bind(digestAgent)
  .listen(config.agentPort)
  .then((port) => {
    console.log(`DevPilot agent (Restate + LangGraph) listening on :${port}`);
  })
  .catch((err: unknown) => {
    console.error('Failed to start agent endpoint:', err);
    process.exit(1);
  });
