import * as restate from '@restatedev/restate-sdk';
import { runReviewGraph, type ReviewInput } from '../graph/review-graph';
import { notifyCompleted } from '../lib/notify';
import type { ApprovalDecision } from '../graph/state';

export interface ReviewResultSummary {
  reviewRunId: string;
  status: 'completed' | 'rejected';
}

/**
 * The durable PR-review workflow. Keyed by reviewRunId (one run per review), so
 * a duplicate submit attaches to the in-flight run rather than starting a second.
 *
 * The single `run` handler drives the LangGraph pipeline; human approval is
 * handled inside the graph via a Restate awakeable resolved through the ingress
 * awakeable API (see human-approval node + the NestJS approve/reject endpoints).
 */
export const reviewWorkflow = restate.workflow({
  name: 'ReviewWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      input: ReviewInput,
    ): Promise<ReviewResultSummary> => {
      try {
        const final = await runReviewGraph(ctx, input);
        const approved = final.approvalDecision?.approved ?? false;
        const status = approved ? 'completed' : 'rejected';
        await notifyCompleted(input.reviewRunId, status);
        return { reviewRunId: input.reviewRunId, status };
      } catch (err) {
        // Only surface a terminal failure to the UI; retryable errors are
        // retried by Restate and should not flip the review to "failed".
        if (err instanceof restate.TerminalError) {
          await notifyCompleted(input.reviewRunId, 'failed', err.message);
        }
        throw err;
      }
    },

    /**
     * Cancel a review. Adding a brand-new handler to an existing workflow is a
     * version-safe change — in-flight `run` invocations keep replaying their
     * journal; new deployments simply gain this entry point.
     *
     * Shared (read-only) handler: it can't mutate workflow state, but it *can*
     * resolve the human-approval awakeable. If the review is waiting for
     * approval, we reject it, which resumes `run` down the "rejected" path and
     * ends cleanly without posting a comment. (A review mid-LLM-call has no
     * awakeable yet and can't be interrupted this way — that step completes.)
     */
    cancel: restate.handlers.workflow.shared(
      async (ctx: restate.WorkflowSharedContext): Promise<void> => {
        const awakeableId = await ctx.get<string>('awakeableId');
        if (awakeableId) {
          ctx.resolveAwakeable<ApprovalDecision>(awakeableId, {
            approved: false,
            comment: 'Cancelled by user',
          });
        }
      },
    ),
  },
});

export type ReviewWorkflow = typeof reviewWorkflow;
