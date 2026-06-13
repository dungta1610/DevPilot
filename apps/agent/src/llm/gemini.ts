import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { config, GEMINI_MODEL } from '../config';

/**
 * Builds a Gemini chat model. `maxRetries` lets LangChain retry transient
 * provider errors before Restate's own retry (on the surrounding ctx.run) ever
 * kicks in — so most blips never cost a workflow journal entry.
 *
 * Low default temperature keeps the structured-JSON output stable.
 */
export function buildGeminiModel(temperature = 0.1): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL,
    apiKey: config.googleApiKey,
    temperature,
    maxRetries: 3,
    maxOutputTokens: 8192,
  });
}

/**
 * Gemini often wraps JSON in ```json fences. Strip them and parse. Throws if the
 * payload still isn't valid JSON (the caller decides whether that's terminal).
 */
export function parseJsonResponse<T>(content: unknown): T {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const clean = text.replace(/```json\s*|\s*```/g, '').trim();
  return JSON.parse(clean) as T;
}
