/**
 * Explicit retry policies for durable steps, instead of relying on Restate's
 * defaults. Field names/units match the installed SDK's `RunOptions`
 * (`initialRetryInterval` / `maxRetryInterval` are milliseconds here).
 *
 * When `maxRetryAttempts` is exhausted, `ctx.run` throws a `TerminalError`
 * wrapping the last error — so a persistently-failing step eventually surfaces
 * instead of retrying forever.
 */

/** LLM calls: rate limits (429) need patience, so back off generously. */
export const LLM_RETRY = {
  maxRetryAttempts: 5,
  initialRetryInterval: 2000,
  maxRetryInterval: 60000,
  retryIntervalFactor: 2,
} as const;

/** GitHub API calls: transient 5xx / network blips clear quickly. */
export const GITHUB_RETRY = {
  maxRetryAttempts: 4,
  initialRetryInterval: 1000,
  maxRetryInterval: 30000,
  retryIntervalFactor: 2,
} as const;
