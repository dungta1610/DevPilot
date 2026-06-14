import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { buildGeminiModel } from '../../llm/gemini';
import { getTasksTool, getReviewsTool, getStatsTool } from './assistant-tools';

/**
 * A single conversation turn, as persisted in the Virtual Object's K/V store.
 * Defined here (not in project-assistant) so the graph has no import cycle with
 * the Restate handler that calls it.
 */
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

const ASSISTANT_SYSTEM_PROMPT = `You are DevPilot Assistant, an AI helper for
software development teams. You have access to the project's tasks and code
review history through tools.

You can help with:
- Sprint planning ("what should we work on next?")
- Task prioritization ("which tasks are most urgent?")
- Code quality trends ("how has code quality changed recently?")
- Progress summaries ("what did the team complete this week?")
- Overdue task alerts ("what's past due?")

Always call the tools to fetch real data before answering — never invent task
titles, PR numbers, scores, or dates. Reference the actual values you get back.

Be concise. Prefer bullet points over paragraphs for lists. If the data is
empty, say so plainly rather than guessing.`;

/** Coerce an LLM message's content (string | parts[]) down to plain text. */
function messageText(message: BaseMessage | undefined): string {
  if (!message) return '';
  const { content } = message;
  if (typeof content === 'string') return content;
  return content
    .map((part) =>
      typeof part === 'string'
        ? part
        : 'text' in part && typeof part.text === 'string'
          ? part.text
          : '',
    )
    .join('')
    .trim();
}

/**
 * Runs the project assistant: a ReAct agent (Gemini + the three project tools)
 * that answers the user's latest message in the context of recent history.
 *
 * Pure async function — the durability lives in the Virtual Object handler that
 * wraps this call in `ctx.run(...)`, so a crash mid-response won't re-bill Gemini.
 */
export async function runAssistantGraph(
  projectId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const model = buildGeminiModel(0.3);

  const tools = [
    getTasksTool(projectId),
    getReviewsTool(projectId),
    getStatsTool(projectId),
  ];

  const agent = createReactAgent({ llm: model, tools, prompt: ASSISTANT_SYSTEM_PROMPT });

  const messages = [
    ...history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    ),
    new HumanMessage(userMessage),
  ];

  const result = await agent.invoke({ messages });
  const text = messageText(result.messages.at(-1));
  return text || "I couldn't generate a response for that. Try rephrasing?";
}
