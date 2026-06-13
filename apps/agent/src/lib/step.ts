import type { WorkflowContext } from '@restatedev/restate-sdk';
import { notifyStep } from './notify';

/**
 * Runs one pipeline step durably and reports its progress.
 *
 *  1. emit RUNNING (UI side-channel)
 *  2. execute `action` inside `ctx.run(stepName, …)` so the result is journaled
 *     — on crash-replay this returns the cached value without re-executing
 *  3. emit COMPLETED with a small output summary (the keys the UI renders)
 *
 * Any throw emits FAILED and re-throws so Restate can apply its retry policy.
 * `summarize` shapes the journaled result into the compact `output` object the
 * web pipeline reads (e.g. `{ issues: 3 }`).
 */
export async function withStep<T>(
  ctx: WorkflowContext,
  reviewRunId: string,
  stepName: string,
  action: () => Promise<T>,
  summarize?: (result: T) => Record<string, unknown>,
): Promise<T> {
  await notifyStep(reviewRunId, stepName, 'RUNNING');
  const startedAt = Date.now();
  try {
    const result = await ctx.run(stepName, action);
    await notifyStep(
      reviewRunId,
      stepName,
      'COMPLETED',
      summarize ? summarize(result) : null,
      Date.now() - startedAt,
    );
    return result;
  } catch (err) {
    await notifyStep(reviewRunId, stepName, 'FAILED', {
      error: (err as Error).message,
    });
    throw err;
  }
}

/** Count issues at or above a severity, for score/output summaries. */
export function countBySeverity(
  issues: { severity: string }[],
  ...severities: string[]
): number {
  return issues.filter((i) => severities.includes(i.severity)).length;
}
