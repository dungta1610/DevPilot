import { Approval, ApprovalDecision } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class ApprovalDto {
  id!: string;
  reviewRunId!: string;
  reviewerId!: string | null;
  decision!: ApprovalDecision | null;
  comment!: string | null;
  decidedAt!: string | null;
  createdAt!: string;
}

export function toApprovalDto(approval: Approval): ApprovalDto {
  return {
    id: approval.id,
    reviewRunId: approval.reviewRunId,
    reviewerId: approval.reviewerId,
    decision: approval.decision,
    comment: approval.comment,
    decidedAt: approval.decidedAt ? approval.decidedAt.toISOString() : null,
    createdAt: approval.createdAt.toISOString(),
  };
}
