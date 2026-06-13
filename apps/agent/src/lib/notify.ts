import { config } from '../config';

export type StepStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

/**
 * Fire a progress update to the NestJS internal API, which records the step and
 * fans it out to any connected SSE clients.
 *
 * These pings are intentionally best-effort and live *outside* Restate's journal
 * (`ctx.run`): they're a UI side-channel, not part of the durable computation.
 * On a crash-replay they may re-fire, which the API treats idempotently — a
 * failed ping must never fail the review, so every error is swallowed.
 */
async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${config.apiInternalUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': config.apiInternalSecret,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`[notify] ${path} failed:`, (err as Error).message);
  }
}

export async function notifyStep(
  reviewRunId: string,
  agentName: string,
  status: StepStatus,
  output?: unknown,
  durationMs?: number,
): Promise<void> {
  await post(`/internal/reviews/${reviewRunId}/steps`, {
    agentName,
    status,
    output: output ?? null,
    durationMs: durationMs ?? null,
    executedAt: new Date().toISOString(),
  });
}

export async function notifyAwaitingApproval(
  reviewRunId: string,
  awakeableId: string,
  summary: string,
): Promise<void> {
  await post(`/internal/reviews/${reviewRunId}/awaiting-approval`, {
    awakeableId,
    summary,
  });
}

export async function notifyCompleted(
  reviewRunId: string,
  status: 'completed' | 'rejected' | 'failed',
  error?: string,
): Promise<void> {
  await post(`/internal/reviews/${reviewRunId}/result`, {
    status,
    error: error ?? null,
  });
}
