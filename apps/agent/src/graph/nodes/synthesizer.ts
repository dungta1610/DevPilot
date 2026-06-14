import type { WorkflowContext } from '@restatedev/restate-sdk';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildGeminiModel } from '../../llm/gemini';
import { parseLLMJson } from '../../lib/parse-llm-json';
import { withStep } from '../../lib/step';
import { LLM_RETRY } from '../../lib/retry';
import type { AgentResult, ReviewReport, ReviewState } from '../state';

const SYSTEM_PROMPT = `You are synthesizing the results from three specialized code-review agents (quality, security, performance) into a single GitHub PR review.

Produce ONLY valid JSON (no markdown fences) matching:
{
  "qualityScore": 0-100,
  "securityScore": 0-100,
  "perfScore": 0-100,
  "overallSummary": "2-3 sentence executive summary",
  "markdownComment": "full GitHub-flavoured markdown review"
}

The markdownComment must include: an overview, a section per category that has issues (Quality, Security, Performance), each issue as a bullet with file/line when available, and a conclusion with an overall recommendation. Do not duplicate issues across categories.`;

function totalIssues(...results: (AgentResult | null)[]): number {
  return results.reduce((sum, r) => sum + (r?.issues.length ?? 0), 0);
}

/** Deterministic report used if the LLM output can't be parsed. */
function fallbackReport(state: ReviewState): ReviewReport {
  const total = totalIssues(
    state.qualityResult,
    state.securityResult,
    state.perfResult,
  );
  const section = (title: string, r: AgentResult | null): string => {
    if (!r || r.issues.length === 0) return `### ${title}\n\nNo issues found.\n`;
    const bullets = r.issues
      .map(
        (i) =>
          `- ${i.file ? `\`${i.file}\`${i.line ? `:${i.line}` : ''} — ` : ''}${i.description} _(severity: ${i.severity})_`,
      )
      .join('\n');
    return `### ${title}\n\n${r.summary}\n\n${bullets}\n`;
  };
  return {
    qualityScore: 0,
    securityScore: 0,
    perfScore: 0,
    overallSummary: `Automated review found ${total} issue(s) across quality, security, and performance.`,
    markdownComment: [
      '# DevPilot review',
      '',
      section('Quality', state.qualityResult),
      section('Security', state.securityResult),
      section('Performance', state.perfResult),
    ].join('\n'),
    totalIssues: total,
  };
}

export async function synthesizerNode(
  ctx: WorkflowContext,
  state: ReviewState,
): Promise<Partial<ReviewState>> {
  const synthesis = await withStep(
    ctx,
    state.reviewRunId,
    'synthesizer',
    async () => {
      const model = buildGeminiModel(0.2);
      const res = await model.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(
          JSON.stringify({
            quality: state.qualityResult,
            security: state.securityResult,
            performance: state.perfResult,
          }),
        ),
      ]);
      try {
        const parsed = parseLLMJson<ReviewReport>(res.content, 'synthesizer');
        return {
          ...parsed,
          totalIssues: totalIssues(
            state.qualityResult,
            state.securityResult,
            state.perfResult,
          ),
        };
      } catch {
        return fallbackReport(state);
      }
    },
    () => ({ sections: 3 }),
    LLM_RETRY,
  );
  return { synthesis };
}
