/**
 * Centralised environment access for the agent service. Values are read lazily
 * so the HTTP server can boot (and register with Restate) even when optional
 * credentials like GOOGLE_API_KEY are absent — those are only required at the
 * moment a node actually calls out.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  /** Port the Restate SDK HTTP server listens on. */
  agentPort: Number(process.env.AGENT_PORT ?? 9080),

  /** NestJS internal API used to write step progress back for the SSE stream. */
  apiInternalUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:3001',

  /** Shared secret the NestJS internal endpoints verify. */
  get apiInternalSecret(): string {
    return required('API_INTERNAL_SECRET');
  },

  /** Gemini API key — required only when an LLM node runs. */
  get googleApiKey(): string {
    return required('GOOGLE_API_KEY');
  },

  /** GitHub token used to read PRs and post review comments. */
  get githubToken(): string {
    return required('GITHUB_APP_TOKEN');
  },
} as const;

/** Gemini model id — pinned per the Phase 2 spec. */
export const GEMINI_MODEL = 'gemini-2.5-flash';
