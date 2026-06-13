import type { WorkflowContext } from '@restatedev/restate-sdk';
import type { ReviewState } from '../state';
import { countBySeverity } from '../../lib/step';
import {
  JSON_SCHEMA_INSTRUCTION,
  runAnalysisAgent,
} from './analysis-agent';

const SYSTEM_PROMPT = `You are an expert application security reviewer.

Analyze the provided PR diff for:
- OWASP Top 10 vulnerabilities
- Hardcoded secrets, API keys, or passwords in code
- SQL injection, XSS, and CSRF risks
- Insecure or vulnerable dependencies and imports
- Authentication / authorization bypass risks
- Sensitive data exposure (logging secrets, PII leakage)

${JSON_SCHEMA_INSTRUCTION}`;

export async function securityAgentNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const securityResult = await runAnalysisAgent(ctx, state, {
    stepName: 'security_agent',
    systemPrompt: SYSTEM_PROMPT,
    // UI renders high/medium counts for the security step.
    outputSummary: (r) => ({
      high: countBySeverity(r.issues, 'high', 'critical'),
      medium: countBySeverity(r.issues, 'medium'),
    }),
  });
  return { securityResult };
}
