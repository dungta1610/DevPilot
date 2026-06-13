import { AgentStep, AgentStepStatus } from '@prisma/client';

/** Lowercase wire form of AgentStepStatus — the casing the web client expects. */
export type AgentStepStatusWire = Lowercase<AgentStepStatus>;

export class AgentStepDto {
  id!: string;
  reviewRunId!: string;
  agentName!: string;
  status!: AgentStepStatusWire;
  output!: Record<string, unknown> | null;
  durationMs!: number | null;
  executedAt!: string | null;
}

export function toAgentStepDto(step: AgentStep): AgentStepDto {
  return {
    id: step.id,
    reviewRunId: step.reviewRunId,
    agentName: step.agentName,
    status: step.status.toLowerCase() as AgentStepStatusWire,
    output: (step.output as Record<string, unknown> | null) ?? null,
    durationMs: step.durationMs,
    executedAt: step.executedAt ? step.executedAt.toISOString() : null,
  };
}
