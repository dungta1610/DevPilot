import { END, START, StateGraph } from '@langchain/langgraph';
import type { WorkflowContext } from '@restatedev/restate-sdk';
import { ReviewStateAnnotation, type ReviewState } from './state';
import { fetchPrNode } from './nodes/fetch-pr';
import { orchestratorNode } from './nodes/orchestrator';
import { qualityAgentNode } from './nodes/quality-agent';
import { securityAgentNode } from './nodes/security-agent';
import { perfAgentNode } from './nodes/perf-agent';
import { synthesizerNode } from './nodes/synthesizer';
import { humanApprovalNode } from './nodes/human-approval';
import { postCommentNode } from './nodes/post-comment';

export interface ReviewInput {
  reviewRunId: string;
  prUrl: string;
  projectId: string;
}

/** approved → post the comment; rejected / timed-out → stop. */
function approvalRouter(state: ReviewState): 'post_comment' | typeof END {
  return state.approvalDecision?.approved ? 'post_comment' : END;
}

/**
 * Builds and runs the review graph. The Restate `ctx` is threaded into every
 * node so each unit of external work runs inside `ctx.run(...)` and is journaled.
 *
 * Durability model: on replay the graph re-executes from START, but every
 * already-completed `ctx.run` returns its cached result instantly, so execution
 * "fast-forwards" to the first un-journaled step and resumes there.
 */
export async function runReviewGraph(
  ctx: WorkflowContext,
  input: ReviewInput,
): Promise<ReviewState> {
  const graph = new StateGraph(ReviewStateAnnotation)
    .addNode('fetch_pr', (s) => fetchPrNode(ctx, s))
    .addNode('orchestrator', (s) => orchestratorNode(ctx, s))
    .addNode('quality_agent', (s) => qualityAgentNode(ctx, s))
    .addNode('security_agent', (s) => securityAgentNode(ctx, s))
    .addNode('perf_agent', (s) => perfAgentNode(ctx, s))
    .addNode('synthesizer', (s) => synthesizerNode(ctx, s))
    .addNode('human_approval', (s) => humanApprovalNode(ctx, s))
    .addNode('post_comment', (s) => postCommentNode(ctx, s))
    .addEdge(START, 'fetch_pr')
    .addEdge('fetch_pr', 'orchestrator')
    // Fan-out: orchestrator → three specialists in parallel.
    .addEdge('orchestrator', 'quality_agent')
    .addEdge('orchestrator', 'security_agent')
    .addEdge('orchestrator', 'perf_agent')
    // Fan-in: all three → synthesizer (runs once all parents complete).
    .addEdge('quality_agent', 'synthesizer')
    .addEdge('security_agent', 'synthesizer')
    .addEdge('perf_agent', 'synthesizer')
    .addEdge('synthesizer', 'human_approval')
    .addConditionalEdges('human_approval', approvalRouter, {
      post_comment: 'post_comment',
      [END]: END,
    })
    .addEdge('post_comment', END)
    .compile();

  return graph.invoke(input);
}
