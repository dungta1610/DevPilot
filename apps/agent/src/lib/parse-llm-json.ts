/**
 * Robust parser for LLM JSON output. Gemini occasionally wraps JSON in markdown
 * fences or adds a sentence of preamble, so we try progressively looser
 * strategies before giving up.
 *
 * On total failure it throws a **regular** Error (not a TerminalError): a retry
 * with the same prompt may well return valid JSON, so the failure is retryable.
 * Callers that wrap this in `ctx.run` will have Restate retry; callers that
 * prefer graceful degradation can catch and fall back.
 */
export function parseLLMJson<T>(content: unknown, context: string): T {
  const text =
    typeof content === 'string' ? content : JSON.stringify(content ?? '');

  // Strategy 1: direct parse.
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }

  // Strategy 2: strip a leading ```json / trailing ``` fence.
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    /* fall through */
  }

  // Strategy 3: extract the first balanced-looking {...} or [...] block.
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try {
      return JSON.parse(match[1]) as T;
    } catch {
      /* fall through */
    }
  }

  throw new Error(
    `Failed to parse LLM JSON output in ${context}. Raw output: ${text.slice(0, 200)}`,
  );
}
