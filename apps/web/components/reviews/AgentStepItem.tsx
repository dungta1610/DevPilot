"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import {
  AGENT_DESCRIPTIONS,
  AGENT_LABELS,
  type AgentName,
  type AgentStep,
} from "@/lib/types";

/** Subtle per-agent accent color for the pipeline. */
const AGENT_ACCENT: Record<AgentName, string> = {
  fetch_pr: "text-slate-400",
  orchestrator: "text-violet-400",
  quality_agent: "text-sky-400",
  security_agent: "text-rose-400",
  perf_agent: "text-amber-400",
  synthesizer: "text-teal-400",
  human_approval: "text-yellow-400",
  post_comment: "text-emerald-400",
};

/** Turn a step's raw output into a one-line human summary. */
function summarize(step: AgentStep): string {
  if (step.status === "running") return `${AGENT_DESCRIPTIONS[step.agentName]}…`;
  if (step.status === "pending") return AGENT_DESCRIPTIONS[step.agentName];
  if (step.status === "skipped") return "Skipped";
  if (step.status === "failed") {
    const err = step.output?.error;
    return typeof err === "string" ? err : "Failed";
  }
  const o = step.output ?? {};
  const n = (k: string) => o[k] as number | undefined;
  switch (step.agentName) {
    case "fetch_pr":
      return `Fetched ${n("lines") ?? 0} lines · ${n("files") ?? 0} files`;
    case "orchestrator":
      return `Routed to ${n("routedTo") ?? 0} agents`;
    case "quality_agent":
      return `${n("issues") ?? 0} issues found`;
    case "security_agent":
      return `${n("high") ?? 0} high · ${n("medium") ?? 0} medium`;
    case "perf_agent":
      return `${n("warnings") ?? 0} warnings`;
    case "synthesizer":
      return `Merged ${n("sections") ?? 0} sections`;
    case "human_approval":
      return "Approved by reviewer";
    case "post_comment":
      return o.commentId ? `Comment #${o.commentId} posted` : "Posted to GitHub";
    default:
      return "Done";
  }
}

function StepIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="text-status-success size-4" />;
    case "running":
      return <Loader2 className="text-status-running size-4 animate-spin" />;
    case "failed":
      return <XCircle className="text-status-failed size-4" />;
    case "skipped":
      return <MinusCircle className="text-muted-foreground size-4" />;
    default:
      return <Circle className="text-muted-foreground/40 size-4" />;
  }
}

export function AgentStepItem({ step }: { step: AgentStep }) {
  const muted = step.status === "pending";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
        step.status === "running" && "bg-status-running/5",
        muted && "opacity-55",
      )}
    >
      <StepIcon status={step.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("text-sm font-medium", AGENT_ACCENT[step.agentName])}
          >
            {AGENT_LABELS[step.agentName]}
          </span>
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {summarize(step)}
        </p>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
        {step.status === "completed" ? formatDuration(step.durationMs) : ""}
      </span>
    </div>
  );
}
