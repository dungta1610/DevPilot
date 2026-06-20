import * as restate from '@restatedev/restate-sdk';
import { config } from './config';
import { startHealthServer } from './health';
import './load-env';
import { digestAgent } from './restate/digest-agent';
import { projectAssistant } from './restate/project-assistant';
import { reviewWorkflow } from './restate/review-workflow';

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
  .bind(digestAgent)
  .bind(projectAssistant)
  .listen(config.agentPort)
  .then((port) => {
    console.log(`agent listening on :${port}`);
    startHealthServer();
  });