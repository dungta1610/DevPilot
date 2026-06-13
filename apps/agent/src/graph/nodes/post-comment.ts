import type { WorkflowContext } from '@restatedev/restate-sdk';
import { TerminalError } from '@restatedev/restate-sdk';
import { withStep } from '../../lib/step';
import { postReviewComment } from '../tools/github.tools';
import type { ReviewState } from '../state';

/**
 * Terminal node, reached only when the review was approved. Posts the
 * synthesized markdown to the PR as a comment. Journaled, so a crash after the
 * comment is posted will NOT double-post on replay.
 */
export async function postCommentNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  await withStep(
    ctx,
    state.reviewRunId,
    'post_comment',
    async () => {
      if (!state.prMetadata || !state.synthesis) {
        throw new TerminalError('Missing PR metadata or synthesis before post');
      }
      const commentId = await postReviewComment(
        state.prMetadata,
        state.synthesis.markdownComment,
      );
      return { commentId };
    },
    (r) => ({ commentId: r.commentId }),
  );
  return {};
}
