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
