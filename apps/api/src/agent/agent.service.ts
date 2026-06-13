import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalDecision,
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { TriggerReviewDto } from './dto/trigger-review.dto';
import {
  ReviewRunDto,
  toReviewRunDto,
} from './dto/review-run.dto';
import { ApprovalDto, toApprovalDto } from './dto/approval.dto';

export interface ReviewStreamEvent {
  type: 'completed';
  reviewId: string;
}

/**
 * Phase 1 implementation: persists review runs and approvals against the
 * database and returns the real API shapes. The durable agent orchestration
 * (Restate + LangGraph) is introduced in Phase 2 — at which point triggering a
 * review starts a workflow, the stream relays live step events, and approve /
 * reject resolve the workflow's awakeable.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async triggerReview(
    userId: string,
    dto: TriggerReviewDto,
  ): Promise<ReviewRunDto> {
    await this.projectsService.assertMember(userId, dto.projectId);

    const run = await this.prisma.reviewRun.create({
      data: {
        projectId: dto.projectId,
        prUrl: dto.prUrl,
        status: ReviewStatus.PENDING,
        triggeredById: userId,
      },
      include: { steps: true },
    });

    return toReviewRunDto(run);
  }

  async getReview(userId: string, reviewId: string): Promise<ReviewRunDto> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
      include: { steps: { orderBy: { executedAt: 'asc' } } },
    });
    if (!run) {
      throw new NotFoundException('Review not found');
    }
    await this.projectsService.assertMember(userId, run.projectId);
    return toReviewRunDto(run);
  }

  async listForProject(projectId: string): Promise<ReviewRunDto[]> {
    const runs = await this.prisma.reviewRun.findMany({
      where: { projectId },
      include: { steps: { orderBy: { executedAt: 'asc' } } },
      orderBy: { startedAt: 'desc' },
    });
    return runs.map(toReviewRunDto);
  }

  /** SSE payload for `GET /reviews/:id/stream`: one terminal event, then close. */
  buildStreamEvent(reviewId: string): ReviewStreamEvent {
    return { type: 'completed', reviewId };
  }

  approve(
    userId: string,
    reviewId: string,
    comment?: string,
  ): Promise<ApprovalDto> {
    return this.decide(userId, reviewId, ApprovalDecision.APPROVED, comment);
  }

  reject(
    userId: string,
    reviewId: string,
    comment?: string,
  ): Promise<ApprovalDto> {
    return this.decide(userId, reviewId, ApprovalDecision.REJECTED, comment);
  }

  private async decide(
    userId: string,
    reviewId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalDto> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
    });
    if (!run) {
      throw new NotFoundException('Review not found');
    }
    await this.projectsService.assertMember(userId, run.projectId);

    const decidedAt = new Date();
    const status =
      decision === ApprovalDecision.APPROVED
        ? ReviewStatus.APPROVED
        : ReviewStatus.REJECTED;

    const [, approval] = await this.prisma.$transaction([
      this.prisma.reviewRun.update({
        where: { id: reviewId },
        data: { status, completedAt: decidedAt },
      }),
      this.prisma.approval.upsert({
        where: { reviewRunId: reviewId },
        create: {
          reviewRunId: reviewId,
          reviewerId: userId,
          decision,
          comment: comment ?? null,
          decidedAt,
        },
        update: {
          reviewerId: userId,
          decision,
          comment: comment ?? null,
          decidedAt,
        },
      }),
    ]);

    return toApprovalDto(approval);
  }
}
