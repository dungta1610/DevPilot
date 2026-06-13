"use client";

import { GitFork } from "lucide-react";
import { AgentStepItem } from "@/components/reviews/AgentStepItem";
import {
  AGENT_ORDER,
  PARALLEL_AGENTS,
  type AgentName,
  type AgentStep,
  type ReviewRun,
} from "@/lib/types";

/** Build a complete, ordered step list, filling gaps with pending placeholders. */
function resolveSteps(review: ReviewRun): Record<AgentName, AgentStep> {
  const byName = {} as Record<AgentName, AgentStep>;
  for (const name of AGENT_ORDER) {
    byName[name] = {
      id: name,
      agentName: name,
      status: "pending",
      output: null,
      durationMs: null,
      executedAt: null,
    };
  }
  for (const step of review.steps) {
    byName[step.agentName] = step;
  }
  return byName;
}

export function AgentPipeline({ review }: { review: ReviewRun }) {
  const steps = resolveSteps(review);
  const sequential = AGENT_ORDER.filter((n) => !PARALLEL_AGENTS.includes(n));

  // Insert the parallel group right after the orchestrator.
  return (
    <div className="flex flex-col">
      {sequential.map((name) => {
        const node = <AgentStepItem key={name} step={steps[name]} />;
        if (name !== "orchestrator") return node;
        return (
          <div key={name}>
            {node}
            <ParallelGroup steps={steps} />
          </div>
        );
      })}
    </div>
  );
}

function ParallelGroup({
  steps,
}: {
  steps: Record<AgentName, AgentStep>;
}) {
  const anyRunning = PARALLEL_AGENTS.some(
    (n) => steps[n].status === "running",
  );
  return (
    <div className="my-1 ml-2 border-l-2 pl-3">
      <div className="text-muted-foreground flex items-center gap-1.5 py-1 pl-2 text-xs font-medium">
        <GitFork className="size-3.5" />
        Specialist agents
        <span className="text-muted-foreground/70">
          {anyRunning ? "· running in parallel" : "· fan-out"}
        </span>
      </div>
      <div className="grid gap-0.5 lg:grid-cols-3">
        {PARALLEL_AGENTS.map((name) => (
          <AgentStepItem key={name} step={steps[name]} />
        ))}
      </div>
    </div>
  );
}
