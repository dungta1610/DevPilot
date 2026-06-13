import type { WorkflowContext } from '@restatedev/restate-sdk';
import { HumanMessage } from '@langchain/core/messages';
import { buildGeminiModel } from '../../llm/gemini';
import { withStep } from '../../lib/step';
import type { ReviewState } from '../state';

/**
 * Routing node. All three specialists always run (fan-out is via graph edges),
 * so this just produces a short scope note for context/logging and emits the
 * `orchestrator` pipeline step. State is returned unchanged.
 */
export async function orchestratorNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  await withStep(
    ctx,
    state.reviewRunId,
    'orchestrator',
    async () => {
      const model = buildGeminiModel(0.2);
      const res = await model.invoke([
        new HumanMessage(
          `Briefly note the scope and risk areas of this PR in one sentence.\nTitle: ${state.prTitle}\nDiff preview:\n${state.prDiff.slice(0, 2000)}`,
        ),
      ]);
      return typeof res.content === 'string' ? res.content : '';
    },
    // UI shows "Routed to N agents".
    () => ({ routedTo: 3 }),
  );
  return {};
}
