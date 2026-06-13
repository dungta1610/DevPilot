"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API_URL, USE_MOCKS } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import type { AgentName, AgentStep, ReviewRun, SSEEvent } from "@/lib/types";

/**
 * Subscribes to the agent step stream for a review and merges events into the
 * TanStack Query cache in place, so the pipeline animates without refetching.
 *
 * - Real backend: consumes `GET /reviews/:id/stream` as Server-Sent Events.
 * - Mocks (NEXT_PUBLIC_USE_MOCKS=true): replays a scripted ~15s run so the
 *   pipeline can be developed and demoed with no backend.
 *
 * Only active while `enabled` is true (typically when status is running).
 */
export function useReviewStream(reviewId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !reviewId) return;

    if (USE_MOCKS) {
      return runMockStream(reviewId, queryClient);
    }

    const es = new EventSource(`${API_URL}/reviews/${reviewId}/stream`, {
      withCredentials: true,
    });
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent;
        applyEvent(queryClient, reviewId, event);
      } catch {
        // Ignore malformed frames.
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [reviewId, enabled, queryClient]);
}

/** Merge a single SSE event into the cached ReviewRun. */
function applyEvent(qc: QueryClient, reviewId: string, event: SSEEvent) {
  qc.setQueryData<ReviewRun>(queryKeys.review(reviewId), (old) => {
    if (!old) return old;
    const next: ReviewRun = { ...old, steps: [...old.steps] };

    const upsert = (name: AgentName, patch: Partial<AgentStep>) => {
      const idx = next.steps.findIndex((s) => s.agentName === name);
      if (idx >= 0) {
        next.steps[idx] = { ...next.steps[idx], ...patch };
      } else {
        next.steps.push({
          id: name,
          agentName: name,
          status: "pending",
          output: null,
          durationMs: null,
          executedAt: null,
          ...patch,
        });
      }
    };

    switch (event.type) {
      case "step_started":
        next.status = "running";
        upsert(event.stepName, { status: "running" });
        break;
      case "step_completed":
        upsert(event.stepName, {
          status: "completed",
          output: event.output,
          durationMs: event.durationMs,
          executedAt: new Date().toISOString(),
        });
        break;
      case "step_failed":
        upsert(event.stepName, {
          status: "failed",
          output: { error: event.error },
          executedAt: new Date().toISOString(),
        });
        next.status = "failed";
        break;
      case "awaiting_approval":
        next.status = "awaiting_approval";
        next.resultSummary = event.summary;
        upsert("human_approval", { status: "running" });
        break;
      case "completed":
        next.status = "completed";
        next.completedAt = new Date().toISOString();
        break;
      case "failed":
        next.status = "failed";
        next.completedAt = new Date().toISOString();
        break;
    }
    return next;
  });
}

const MOCK_SUMMARY = `## Review summary

**Quality** — 3 issues found
- A handler function is doing too much; extract the retry branch.
- Missing unit tests on the new code path.
- An \`any\` type slipped into the payload handler.

**Security** — 1 high severity
- Incoming webhook is parsed before its signature is verified. Verify first.

**Performance** — 2 warnings
- N+1 query when loading related rows.
- Synchronous render on the request thread; move to a job.

**Verdict:** Approve after the signature fix, or request changes.`;

type Frame = { at: number; event: SSEEvent };

/**
 * Scripted timeline of SSE events. Parallel agents start together and finish
 * at staggered times, matching the real fan-out behaviour.
 */
function buildMockTimeline(reviewId: string): Frame[] {
  const done = (
    stepName: AgentName,
    output: Record<string, unknown>,
    durationMs: number,
  ): SSEEvent => ({ type: "step_completed", stepName, output, durationMs });

  return [
    { at: 300, event: { type: "step_started", stepName: "fetch_pr" } },
    { at: 1200, event: done("fetch_pr", { lines: 847, files: 12 }, 234) },
    { at: 1400, event: { type: "step_started", stepName: "orchestrator" } },
    { at: 2600, event: done("orchestrator", { routedTo: 3 }, 1180) },
    // Fan-out: three specialists run concurrently.
    { at: 2800, event: { type: "step_started", stepName: "quality_agent" } },
    { at: 2800, event: { type: "step_started", stepName: "security_agent" } },
    { at: 2800, event: { type: "step_started", stepName: "perf_agent" } },
    { at: 8200, event: done("quality_agent", { issues: 3 }, 5400) },
    { at: 9600, event: done("perf_agent", { warnings: 2 }, 6800) },
    { at: 10800, event: done("security_agent", { high: 1, medium: 2 }, 8000) },
    { at: 11000, event: { type: "step_started", stepName: "synthesizer" } },
    { at: 13200, event: done("synthesizer", { sections: 3 }, 2100) },
    {
      at: 13600,
      event: { type: "awaiting_approval", reviewId, summary: MOCK_SUMMARY },
    },
  ];
}

function runMockStream(reviewId: string, qc: QueryClient): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const frame of buildMockTimeline(reviewId)) {
    timers.push(
      setTimeout(() => applyEvent(qc, reviewId, frame.event), frame.at),
    );
  }
  return () => timers.forEach(clearTimeout);
}
