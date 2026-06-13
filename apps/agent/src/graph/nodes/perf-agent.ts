import type { WorkflowContext } from '@restatedev/restate-sdk';
import type { ReviewState } from '../state';
import {
  JSON_SCHEMA_INSTRUCTION,
  runAnalysisAgent,
} from './analysis-agent';

const SYSTEM_PROMPT = `You are an expert performance reviewer.

Analyze the provided PR diff for:
- N+1 query patterns
- Missing database indexes implied by ORM calls
- Unnecessary re-renders in frontend code
- Large bundle imports (importing an entire library vs a named import)
- Synchronous operations that should be asynchronous
- Memory leaks (event listeners or subscriptions not cleaned up)

${JSON_SCHEMA_INSTRUCTION}`;

export async function perfAgentNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const perfResult = await runAnalysisAgent(ctx, state, {
    stepName: 'perf_agent',
    systemPrompt: SYSTEM_PROMPT,
    outputSummary: (r) => ({ warnings: r.issues.length }),
  });
  return { perfResult };
}
