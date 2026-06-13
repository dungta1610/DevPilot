/**
 * Server-Sent Event payloads for `GET /reviews/:id/stream`. Mirrors the web
 * client's `SSEEvent` union (apps/web/lib/types.ts) — the contract the pipeline
 * UI consumes. `stepName` values are the snake_case agent names.
 */
export type SSEEvent =
  | { type: 'step_started'; stepName: string }
  | {
      type: 'step_completed';
      stepName: string;
      output: Record<string, unknown> | null;
      durationMs: number | null;
    }
  | { type: 'step_failed'; stepName: string; error: string }
  | { type: 'awaiting_approval'; reviewId: string; summary: string }
  | { type: 'completed'; reviewId: string }
  | { type: 'failed'; reviewId: string; error: string };

/** SSE frame shape NestJS serializes (`data` is JSON-stringified into the frame). */
export interface SseFrame {
  data: SSEEvent;
}
