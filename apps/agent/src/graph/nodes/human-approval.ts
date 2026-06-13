import { RestatePromise, type WorkflowContext } from '@restatedev/restate-sdk';
import { notifyAwaitingApproval, notifyStep } from '../../lib/notify';
import type { ApprovalDecision, ReviewState } from '../state';

const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Suspends the workflow until a human decides — durably.
 *
 * `ctx.awakeable()` mints an id + a durable promise that survives crashes and
 * restarts. The id is handed to NestJS (via the awaiting-approval ping); the
 * approve/reject endpoints there resolve it through Restate's awakeable ingress
 * API, which completes `approval.promise` and resumes the graph. While waiting,
 * the invocation is suspended and consumes no compute.
 *
 * The decision races a 24h timer: no response in time auto-rejects (resolves,
 * not errors — a timeout is a normal "discard" outcome, not a failure).
 */
export async function humanApprovalNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const approval = ctx.awakeable<ApprovalDecision>();

  await notifyStep(state.reviewRunId, 'human_approval', 'RUNNING');
  await notifyAwaitingApproval(
    state.reviewRunId,
    approval.id,
    state.synthesis?.markdownComment ?? state.synthesis?.overallSummary ?? '',
  );

  const decision = await RestatePromise.race([
    approval.promise,
    ctx.sleep(APPROVAL_TIMEOUT_MS).map<ApprovalDecision>(() => ({
      approved: false,
      comment: 'Auto-rejected: approval timed out after 24h',
    })),
  ]);

  await notifyStep(
    state.reviewRunId,
    'human_approval',
    decision.approved ? 'COMPLETED' : 'SKIPPED',
    { decision: decision.approved ? 'approved' : 'rejected' },
  );

  return { approvalDecision: decision };
}
