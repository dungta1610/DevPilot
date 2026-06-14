import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { buildGeminiModel } from '../../llm/gemini';
import { getInternal } from '../../lib/internal-api';

const DIGEST_PROMPT = `You are generating a daily activity digest for a software
development team.

Given the tasks updated and code reviews completed in the last 24 hours, write a
concise daily summary in GitHub-flavored markdown.

Include (skip any section that has no data — never pad):
- Tasks moved to DONE (celebrate the wins)
- Tasks that became overdue
- Code reviews completed and their outcome
- Any high-severity security issues found
- A one-line "team focus for tomorrow" based on IN_PROGRESS tasks

Keep it scannable: bullet points, specific titles/PR numbers, max 400 words.`;

/**
 * Pull the last 24h of project activity and summarize it with Gemini. Pure async
 * function — the DigestAgent workflow wraps it in `ctx.run(...)` for durability.
 */
export async function generateDigest(projectId: string): Promise<string> {
  const [tasks, reviews, stats] = await Promise.all([
    getInternal(`/internal/projects/${projectId}/tasks?updatedSince=24h`),
    getInternal(`/internal/projects/${projectId}/reviews?completedSince=24h`),
    getInternal(`/internal/projects/${projectId}/stats`),
  ]);

  const model = buildGeminiModel(0.4);

  const response = await model.invoke([
    new SystemMessage(DIGEST_PROMPT),
    new HumanMessage(
      JSON.stringify({
        tasks,
        reviews,
        stats,
        generatedAt: new Date().toISOString(),
      }),
    ),
  ]);

  const { content } = response;
  return typeof content === 'string' ? content : JSON.stringify(content);
}
