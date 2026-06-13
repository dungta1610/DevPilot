import './load-env';
import * as restate from '@restatedev/restate-sdk';
import { config } from './config';
import { reviewWorkflow } from './restate/review-workflow';

/**
 * Boots the Restate SDK HTTP server and registers the review workflow. Restate
 * (running in Docker) calls into this server; register the deployment once with
 * `pnpm --filter agent register` after the process is listening.
 */
restate
  .endpoint()
  .bind(reviewWorkflow)
  .listen(config.agentPort)
  .then((port) => {
    console.log(`DevPilot agent (Restate + LangGraph) listening on :${port}`);
  })
  .catch((err: unknown) => {
    console.error('Failed to start agent endpoint:', err);
    process.exit(1);
  });
