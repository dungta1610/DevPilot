import { AgentStep, AgentStepStatus } from '@prisma/client';

export class AgentStepDto {
  id!: string;
  reviewRunId!: string;
  agentName!: string;
  status!: AgentStepStatus;
  output!: Record<string, unknown> | null;
  durationMs!: number | null;
  executedAt!: string | null;
}

export function toAgentStepDto(step: AgentStep): AgentStepDto {
  return {
    id: step.id,
    reviewRunId: step.reviewRunId,
    agentName: step.agentName,
    status: step.status,
    output: (step.output as Record<string, unknown> | null) ?? null,
    durationMs: step.durationMs,
    executedAt: step.executedAt ? step.executedAt.toISOString() : null,
  };
}
