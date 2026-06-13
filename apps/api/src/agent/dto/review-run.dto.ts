import { AgentStep, ReviewRun, ReviewStatus } from '@prisma/client';
import { AgentStepDto, toAgentStepDto } from './agent-step.dto';

export class ReviewRunDto {
  id!: string;
  projectId!: string;
  prUrl!: string;
  status!: ReviewStatus;
  resultSummary!: string | null;
  triggeredById!: string;
  startedAt!: string;
  completedAt!: string | null;
  steps!: AgentStepDto[];
}

export type ReviewRunWithSteps = ReviewRun & { steps: AgentStep[] };

export function toReviewRunDto(run: ReviewRunWithSteps): ReviewRunDto {
  return {
    id: run.id,
    projectId: run.projectId,
    prUrl: run.prUrl,
    status: run.status,
    resultSummary: run.resultSummary,
    triggeredById: run.triggeredById,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    steps: run.steps.map(toAgentStepDto),
  };
}
