import * as restate from '@restatedev/restate-sdk';
import { runReviewGraph, type ReviewInput } from '../graph/review-graph';
import { notifyCompleted } from '../lib/notify';

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
  },
});

export type ReviewWorkflow = typeof reviewWorkflow;
