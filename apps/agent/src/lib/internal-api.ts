import { config } from '../config';

/**
 * Read-only client for the NestJS internal API. The assistant tools and the
 * digest graph use this to pull project data (tasks, reviews, stats) behind the
 * shared-secret guard.
 *
 * Unlike `notify.ts` (best-effort, fire-and-forget UI pings), these reads feed
 * the LLM, so a failure must surface — the caller runs inside `ctx.run(...)`,
 * where a throw becomes a journaled, retryable error.
 */
export async function getInternal<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiInternalUrl}${path}`, {
    headers: { 'x-internal-secret': config.apiInternalSecret },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Internal API GET ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function postInternal<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiInternalUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': config.apiInternalSecret,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Internal API POST ${path} → ${res.status}: ${text}`);
  }
  // Some endpoints return 204 No Content.
  const raw = await res.text();
  return (raw ? JSON.parse(raw) : undefined) as T;
}
