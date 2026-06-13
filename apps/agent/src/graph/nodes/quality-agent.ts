import type { WorkflowContext } from '@restatedev/restate-sdk';
import type { ReviewState } from '../state';
import {
  JSON_SCHEMA_INSTRUCTION,
  runAnalysisAgent,
} from './analysis-agent';

const SYSTEM_PROMPT = `You are an expert code reviewer focused on code quality, maintainability, and best practices.

Analyze the provided PR diff and identify:
- Code smells and anti-patterns
- Naming conventions and readability issues
- Missing error handling
- Code duplication
- Overly complex logic that should be simplified
- Missing or inadequate tests
- Documentation gaps

${JSON_SCHEMA_INSTRUCTION}`;

export async function qualityAgentNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const qualityResult = await runAnalysisAgent(ctx, state, {
    stepName: 'quality_agent',
    systemPrompt: SYSTEM_PROMPT,
    outputSummary: (r) => ({ issues: r.issues.length }),
  });
  return { qualityResult };
}
