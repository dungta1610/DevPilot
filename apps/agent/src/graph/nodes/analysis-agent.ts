import type { WorkflowContext } from '@restatedev/restate-sdk';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildGeminiModel, parseJsonResponse } from '../../llm/gemini';
import { withStep } from '../../lib/step';
import type { AgentResult, Issue, Severity, ReviewState } from '../state';

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

/** Gemini context guard — very large diffs are truncated with a marker. */
const MAX_DIFF_CHARS = 50_000;

function truncateDiff(diff: string): string {
  return diff.length > MAX_DIFF_CHARS
    ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n…(diff truncated)…`
    : diff;
}

/** Coerce arbitrary LLM JSON into a well-formed AgentResult. */
function normalize(raw: Partial<AgentResult>): AgentResult {
  const issues: Issue[] = Array.isArray(raw.issues) ? raw.issues : [];
  const severity =
    raw.severity && SEVERITIES.includes(raw.severity) ? raw.severity : 'low';
  return {
    issues,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    severity,
  };
}

export interface AnalysisAgentSpec {
  stepName: string;
  systemPrompt: string;
  /** Shapes the result into the compact output object the web pipeline renders. */
  outputSummary: (result: AgentResult) => Record<string, unknown>;
}

/**
 * Shared core for the quality / security / performance specialists: one Gemini
 * call returning structured JSON, wrapped in a durable, progress-reporting step.
 * A parse failure degrades to an empty result rather than failing the review.
 */
export function runAnalysisAgent(
  ctx: WorkflowContext,
  state: ReviewState,
  spec: AnalysisAgentSpec,
): Promise<AgentResult> {
  return withStep(
    ctx,
    state.reviewRunId,
    spec.stepName,
    async () => {
      const model = buildGeminiModel(0.1);
      const response = await model.invoke([
        new SystemMessage(spec.systemPrompt),
        new HumanMessage(
          `Review this PR diff:\n\nTitle: ${state.prTitle}\n\n${truncateDiff(state.prDiff)}`,
        ),
      ]);
      try {
        return normalize(parseJsonResponse<Partial<AgentResult>>(response.content));
      } catch {
        return {
          issues: [],
          summary:
            'The analyzer could not produce structured output for this diff.',
          severity: 'low' as Severity,
        };
      }
    },
    spec.outputSummary,
  );
}

/** Shared JSON-schema instruction appended to each specialist's system prompt. */
export const JSON_SCHEMA_INSTRUCTION = `Respond ONLY with valid JSON matching this schema (no prose, no markdown fences):
{
  "issues": [
    { "file": "path/to/file.ts", "line": 42, "description": "what the issue is", "suggestion": "how to fix it", "severity": "low" | "medium" | "high" | "critical" }
  ],
  "summary": "2-3 sentence overall assessment",
  "severity": "low" | "medium" | "high" | "critical"
}
If no issues are found, return "issues": [] with a positive summary and "severity": "low".`;
