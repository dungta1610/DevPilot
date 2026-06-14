import type { WorkflowContext } from '@restatedev/restate-sdk';
import { withStep } from '../../lib/step';
import { GITHUB_RETRY } from '../../lib/retry';
import { fetchPullRequest } from '../tools/github.tools';
import type { ReviewState } from '../state';

/**
 * First node: pull the PR diff + metadata from GitHub. No LLM — the easiest
 * node to verify the durable-step wiring against a real PR URL.
 */
export async function fetchPrNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const fetched = await withStep(
    ctx,
    state.reviewRunId,
    'fetch_pr',
    () => fetchPullRequest(state.prUrl),
    (r) => ({
      lines: r.prDiff.split('\n').length,
      files: r.prMetadata.changedFiles ?? 0,
    }),
    GITHUB_RETRY,
  );
  return {
    prDiff: fetched.prDiff,
    prTitle: fetched.prTitle,
    prMetadata: fetched.prMetadata,
  };
}
