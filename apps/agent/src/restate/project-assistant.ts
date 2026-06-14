import * as restate from '@restatedev/restate-sdk';
import { runAssistantGraph, type ChatMessage } from '../graph/assistant/assistant-graph';
import { LLM_RETRY } from '../lib/retry';

export type { ChatMessage };

/** Keep recent turns only, so the prompt never blows the context window. */
const HISTORY_LIMIT = 20;

/**
 * The Project Assistant — a Restate **Virtual Object** keyed by projectId.
 *
 * Why an object (not a workflow or service):
 *  - Conversation history must persist between messages → object K/V store.
 *  - Everyone in a project shares one assistant context → keyed by projectId.
 *  - Two users sending at once must not race the history → the default
 *    (exclusive) handler runs one-at-a-time *per key*, so writes serialize for
 *    free. No Redis lock, no Postgres advisory lock.
 *  - It lives forever — not a one-shot execution like a workflow.
 */
export const projectAssistant = restate.object({
  name: 'ProjectAssistant',
  handlers: {
    /**
     * Process one user message. Exclusive handler → Restate guarantees only one
     * `chat` runs at a time for a given projectId; a concurrent message queues
     * behind it, keeping the stored history consistent.
     */
    chat: async (
      ctx: restate.ObjectContext,
      input: { message: string; userId: string },
    ): Promise<ChatMessage> => {
      // TERMINAL: an empty message is a client error — retrying can't fix it.
      if (!input.message?.trim()) {
        throw new restate.TerminalError('Message cannot be empty', {
          errorCode: 400,
        });
      }

      const history = (await ctx.get<ChatMessage[]>('history')) ?? [];
      const recent = history.slice(-HISTORY_LIMIT);

      // Journaled: a crash after Gemini answers replays this result instead of
      // re-calling (and re-billing) the model. Patient retry policy for rate
      // limits; an exhausted retry surfaces as a TerminalError to the caller.
      const reply = await ctx.run(
        'assistant_llm',
        () => runAssistantGraph(ctx.key, recent, input.message),
        LLM_RETRY,
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };

      ctx.set('history', [
        ...recent,
        { role: 'user', content: input.message, timestamp: new Date().toISOString() },
        assistantMessage,
      ]);

      return assistantMessage;
    },

    /**
     * Read the conversation history. Shared handler → runs concurrently with
     * other reads and does not block the exclusive `chat` queue.
     */
    getHistory: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext): Promise<ChatMessage[]> =>
        (await ctx.get<ChatMessage[]>('history')) ?? [],
    ),

    /** Reset the conversation. Exclusive — it mutates state. */
    clearHistory: async (ctx: restate.ObjectContext): Promise<void> => {
      ctx.clear('history');
    },
  },
});

export type ProjectAssistant = typeof projectAssistant;
