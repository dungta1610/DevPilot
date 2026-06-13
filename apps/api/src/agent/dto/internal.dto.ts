import { AgentStepStatus } from '@prisma/client';
import { Allow, IsEnum, IsIn, IsString } from 'class-validator';

/** Step progress reported by the agent service (`POST /internal/reviews/:id/steps`). */
export class RecordStepDto {
  @IsString()
  agentName!: string;

  @IsEnum(AgentStepStatus)
  status!: AgentStepStatus;

  // Trusted internal payloads — @Allow keeps these through the whitelist pipe
  // without imposing a shape (output is arbitrary JSON; the rest are nullable).
  @Allow()
  output?: Record<string, unknown> | null;

  @Allow()
  durationMs?: number | null;

  @Allow()
  executedAt?: string | null;
}

/** `POST /internal/reviews/:id/awaiting-approval` */
export class AwaitingApprovalDto {
  @IsString()
  awakeableId!: string;

  @IsString()
  summary!: string;
}

/** `POST /internal/reviews/:id/result` — terminal outcome of a run. */
export class ResultDto {
  @IsIn(['completed', 'rejected', 'failed'])
  status!: 'completed' | 'rejected' | 'failed';

  @Allow()
  error?: string | null;
}
