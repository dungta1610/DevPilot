import * as restate from '@restatedev/restate-sdk';
import { generateDigest } from '../graph/digest/digest-graph';
import { checkProjectExists, postInternal } from '../lib/internal-api';
import { LLM_RETRY } from '../lib/retry';

/**
 * Interval between digests. Defaults to 24h; overridable via env so the
 * durable-sleep experiment (Part 6) can use a short loop to watch it fire.
 */
const DIGEST_INTERVAL_MS = Number(
  process.env.DIGEST_INTERVAL_MS ?? 24 * 60 * 60 * 1000,
);

interface DigestStatus {
  status: string | null;
  projectId: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

/**
 * The Daily Digest agent — a Restate workflow that loops *forever* with a
 * **durable sleep** between iterations.
 *
 * Why `ctx.sleep()` and not node-cron / setTimeout:
 *  - The timer is persisted in Restate, not Node memory. Kill the agent
 *    mid-sleep, restart it 12h later, and the timer resumes with the right
 *    remaining time — the process that set it need not be alive when it fires.
 *  - No external scheduler. The "every 24h" loop is just `while (true)` with an
 *    `await ctx.sleep(...)` at the bottom; Restate journals each iteration.
 *
 * Keyed by projectId (workflow id = projectId) so there is exactly one digest
 * loop per project, no matter how many times `run` is submitted.
 */
export const digestAgent = restate.workflow({
  name: 'DigestAgent',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      input: { projectId: string },
    ): Promise<void> => {
      ctx.set('status', 'running');
      ctx.set('projectId', input.projectId);

      while (true) {
        ctx.set('lastRunAt', new Date().toISOString());

        // Existence gate. A `false` result (the project was deleted) is the ONE
        // signal that should stop the loop for good — so we model it as a
        // boolean and `return`, NOT as a thrown error. This deliberately avoids
        // conflating it with an *exhausted-retry* TerminalError (a transient bad
        // day), which must let the loop continue to the next cycle.
        let exists = true;
        try {
          exists = await ctx.run(
            'check_project',
            () => checkProjectExists(input.projectId),
            { maxRetryAttempts: 5 },
          );
        } catch (err) {
          // Couldn't determine existence (API down / retries exhausted) — treat
          // as a bad day, skip this cycle, try again next interval.
          ctx.set('lastError', err instanceof Error ? err.message : String(err));
          await ctx.sleep(DIGEST_INTERVAL_MS);
          continue;
        }
        if (!exists) {
          ctx.set('status', 'stopped');
          ctx.set('lastError', `Project ${input.projectId} not found`);
          return; // ends the workflow — the digest loop is done.
        }

        try {
          // Journaled: on replay these return cached results, so a restart
          // never regenerates or double-saves the same digest. Bounded retries
          // (LLM_RETRY) so a persistent failure surfaces instead of looping
          // forever; the catch keeps the recurring loop alive across bad days.
          const digest = await ctx.run(
            'generate_digest',
            () => generateDigest(input.projectId),
            LLM_RETRY,
          );

          await ctx.run(
            'save_digest',
            () =>
              postInternal(`/internal/projects/${input.projectId}/digests`, {
                content: digest,
              }),
            { maxRetryAttempts: 5 },
          );

          ctx.set('lastSuccessAt', new Date().toISOString());
          ctx.set('lastError', null);
        } catch (err) {
          // One bad day (including exhausted retries) shouldn't kill the loop.
          ctx.set('lastError', err instanceof Error ? err.message : String(err));
        }

        // The durable sleep. NOT setTimeout — a Restate timer that outlives the
        // process. Execution resumes on the line below after the interval.
        await ctx.sleep(DIGEST_INTERVAL_MS);
      }
    },

    /** Read current loop status. Shared (read-only) handler. */
    getStatus: restate.handlers.workflow.shared(
      async (ctx: restate.WorkflowSharedContext): Promise<DigestStatus> => ({
        status: await ctx.get<string>('status'),
        projectId: await ctx.get<string>('projectId'),
        lastRunAt: await ctx.get<string>('lastRunAt'),
        lastSuccessAt: await ctx.get<string>('lastSuccessAt'),
        lastError: await ctx.get<string>('lastError'),
      }),
    ),
  },
});

export type DigestAgent = typeof digestAgent;
