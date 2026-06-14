import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentStep,
  AgentStepStatus,
  ApprovalDecision,
  Prisma,
  ReviewStatus,
} from '@prisma/client';
import { Observable, Subject, concat, defer, from, of } from 'rxjs';
import { finalize, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { RestateClient } from './restate.client';
import { TriggerReviewDto } from './dto/trigger-review.dto';
import {
  AwaitingApprovalDto,
  RecordStepDto,
  ResultDto,
} from './dto/internal.dto';
import { ReviewRunDto, toReviewRunDto } from './dto/review-run.dto';
import { SSEEvent, SseFrame } from './sse-event';

const FINISHED_STEP_STATUSES = new Set<AgentStepStatus>([
  AgentStepStatus.COMPLETED,
  AgentStepStatus.FAILED,
  AgentStepStatus.SKIPPED,
]);

/**
 * Phase 2: the review lifecycle is driven by the durable agent service
 * (Restate + LangGraph). Triggering a review submits a workflow; the workflow
 * reports step progress through the `/internal` endpoints, which this service
 * persists and fans out over SSE; approve/reject resolve the workflow's
 * human-approval awakeable so it resumes.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  /**
   * In-process SSE fan-out, keyed by reviewRunId. Note: this couples the SSE
   * stream and the `/internal` callbacks to a single API instance (fine for
   * dev / single-node; a horizontal deploy would need a shared bus).
   */
  private readonly streams = new Map<string, Subject<SseFrame>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly restate: RestateClient,
  ) {}

  // --- Triggering -------------------------------------------------------

  async triggerReview(
    userId: string,
    dto: TriggerReviewDto,
  ): Promise<ReviewRunDto> {
    await this.projectsService.assertMember(userId, dto.projectId);

    const run = await this.prisma.reviewRun.create({
      data: {
        projectId: dto.projectId,
        prUrl: dto.prUrl,
        status: ReviewStatus.RUNNING,
        triggeredById: userId,
      },
    });

    try {
      await this.restate.submitReview({
        reviewRunId: run.id,
        prUrl: run.prUrl,
        projectId: run.projectId,
      });
    } catch (err) {
      this.logger.error(`Failed to submit review ${run.id}`, err as Error);
      await this.prisma.reviewRun.update({
        where: { id: run.id },
        data: { status: ReviewStatus.FAILED, completedAt: new Date() },
      });
      throw new BadGatewayException('Could not start the review workflow');
    }

    const fresh = await this.prisma.reviewRun.update({
      where: { id: run.id },
      data: { restateInvocationId: run.id }, // workflow key == reviewRunId
      include: { steps: { orderBy: { executedAt: 'asc' } } },
    });
    return toReviewRunDto(fresh);
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

  // --- SSE --------------------------------------------------------------

  /**
   * Live stream for a review: replays the current persisted state on connect
   * (so reconnects/late joiners are in sync), then relays live step events.
   */
  stream(reviewId: string): Observable<SseFrame> {
    const subject = this.getOrCreateStream(reviewId);
    const replay$ = defer(() => from(this.buildReplayFrames(reviewId))).pipe(
      mergeMap((frames) => of(...frames)),
    );
    return concat(replay$, subject).pipe(
      finalize(() => {
        if (!subject.observed) {
          this.streams.delete(reviewId);
        }
      }),
    );
  }

  private getOrCreateStream(reviewId: string): Subject<SseFrame> {
    let subject = this.streams.get(reviewId);
    if (!subject) {
      subject = new Subject<SseFrame>();
      this.streams.set(reviewId, subject);
    }
    return subject;
  }

  private emit(reviewId: string, event: SSEEvent): void {
    this.streams.get(reviewId)?.next({ data: event });
  }

  private async buildReplayFrames(reviewId: string): Promise<SseFrame[]> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
      include: { steps: { orderBy: { executedAt: 'asc' } } },
    });
    if (!run) return [];

    const frames: SseFrame[] = [];
    for (const step of run.steps) {
      const event = this.stepEvent(step);
      if (event) frames.push({ data: event });
    }
    if (run.status === ReviewStatus.AWAITING_APPROVAL) {
      frames.push({
        data: {
          type: 'awaiting_approval',
          reviewId,
          summary: run.resultSummary ?? '',
        },
      });
    } else if (
      run.status === ReviewStatus.COMPLETED ||
      run.status === ReviewStatus.APPROVED
    ) {
      frames.push({ data: { type: 'completed', reviewId } });
    } else if (run.status === ReviewStatus.FAILED) {
      frames.push({ data: { type: 'failed', reviewId, error: '' } });
    }
    return frames;
  }

  /** Map a persisted step to its SSE event (PENDING produces none). */
  private stepEvent(step: AgentStep): SSEEvent | null {
    const output = (step.output as Record<string, unknown> | null) ?? null;
    switch (step.status) {
      case AgentStepStatus.RUNNING:
        return { type: 'step_started', stepName: step.agentName };
      case AgentStepStatus.COMPLETED:
      case AgentStepStatus.SKIPPED:
        return {
          type: 'step_completed',
          stepName: step.agentName,
          output,
          durationMs: step.durationMs,
        };
      case AgentStepStatus.FAILED:
        return {
          type: 'step_failed',
          stepName: step.agentName,
          error: (output?.error as string | undefined) ?? 'The step failed',
        };
      default:
        return null;
    }
  }

  // --- Internal callbacks (agent → API) ---------------------------------

  async recordStep(reviewId: string, dto: RecordStepDto): Promise<void> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
    });
    if (!run) throw new NotFoundException('Review not found');

    const key = {
      reviewRunId_agentName: {
        reviewRunId: reviewId,
        agentName: dto.agentName,
      },
    };
    const existing = await this.prisma.agentStep.findUnique({ where: key });

    // On a crash-replay the agent may re-emit RUNNING for an already-finished
    // step — never regress it.
    if (
      existing &&
      FINISHED_STEP_STATUSES.has(existing.status) &&
      dto.status === AgentStepStatus.RUNNING
    ) {
      return;
    }

    const output =
      dto.output == null
        ? Prisma.JsonNull
        : (dto.output as Prisma.InputJsonValue);
    const data = {
      status: dto.status,
      output,
      durationMs: dto.durationMs ?? null,
      executedAt: dto.executedAt ? new Date(dto.executedAt) : new Date(),
    };

    await this.prisma.agentStep.upsert({
      where: key,
      create: { reviewRunId: reviewId, agentName: dto.agentName, ...data },
      update: data,
    });

    if (
      dto.status === AgentStepStatus.RUNNING &&
      run.status !== ReviewStatus.RUNNING
    ) {
      await this.prisma.reviewRun.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.RUNNING },
      });
    }

    const event = this.stepEvent({
      ...(existing ?? ({} as AgentStep)),
      agentName: dto.agentName,
      status: dto.status,
      output: dto.output ?? null,
      durationMs: dto.durationMs ?? null,
    } as AgentStep);
    if (event) this.emit(reviewId, event);
  }

  async setAwaitingApproval(
    reviewId: string,
    dto: AwaitingApprovalDto,
  ): Promise<void> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
    });
    if (!run) throw new NotFoundException('Review not found');

    await this.prisma.$transaction([
      this.prisma.reviewRun.update({
        where: { id: reviewId },
        data: {
          status: ReviewStatus.AWAITING_APPROVAL,
          resultSummary: dto.summary,
        },
      }),
      this.prisma.approval.upsert({
        where: { reviewRunId: reviewId },
        create: {
          reviewRunId: reviewId,
          restateAwakeableId: dto.awakeableId,
        },
        update: { restateAwakeableId: dto.awakeableId },
      }),
    ]);

    this.emit(reviewId, {
      type: 'awaiting_approval',
      reviewId,
      summary: dto.summary,
    });
  }

  async finalizeResult(reviewId: string, dto: ResultDto): Promise<void> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
    });
    if (!run) throw new NotFoundException('Review not found');

    const statusByResult: Record<ResultDto['status'], ReviewStatus> = {
      completed: ReviewStatus.COMPLETED,
      rejected: ReviewStatus.REJECTED,
      failed: ReviewStatus.FAILED,
    };

    await this.prisma.reviewRun.update({
      where: { id: reviewId },
      data: { status: statusByResult[dto.status], completedAt: new Date() },
    });

    if (dto.status === 'completed') {
      this.emit(reviewId, { type: 'completed', reviewId });
    } else if (dto.status === 'failed') {
      this.emit(reviewId, {
        type: 'failed',
        reviewId,
        error: dto.error ?? 'The review run failed',
      });
    }
    // 'rejected' streams nothing — the UI has already left the running state.
  }

  // --- Human approval ---------------------------------------------------

  approve(
    userId: string,
    reviewId: string,
    comment?: string,
  ): Promise<ReviewRunDto> {
    return this.decide(userId, reviewId, true, comment);
  }

  reject(
    userId: string,
    reviewId: string,
    comment?: string,
  ): Promise<ReviewRunDto> {
    return this.decide(userId, reviewId, false, comment);
  }

  /**
   * Cancel a review. Only meaningful while it's still in flight; we then ask the
   * workflow's `cancel` handler to resolve the approval awakeable (reject). The
   * workflow's own completion callback flips the final status, so we just return
   * the current state.
   */
  async cancelReview(userId: string, reviewId: string): Promise<ReviewRunDto> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
      include: { steps: { orderBy: { executedAt: 'asc' } } },
    });
    if (!run) throw new NotFoundException('Review not found');
    await this.projectsService.assertMember(userId, run.projectId);

    if (
      run.status !== ReviewStatus.RUNNING &&
      run.status !== ReviewStatus.AWAITING_APPROVAL
    ) {
      throw new BadRequestException('Review is not cancellable');
    }

    try {
      await this.restate.cancelReview(reviewId);
    } catch (err) {
      this.logger.error(`Failed to cancel review ${reviewId}`, err as Error);
      throw new BadGatewayException('Could not cancel the review workflow');
    }

    return toReviewRunDto(run);
  }

  private async decide(
    userId: string,
    reviewId: string,
    approved: boolean,
    comment?: string,
  ): Promise<ReviewRunDto> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: reviewId },
      include: { approval: true },
    });
    if (!run) throw new NotFoundException('Review not found');
    await this.projectsService.assertMember(userId, run.projectId);

    if (run.status !== ReviewStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('Review is not awaiting approval');
    }
    const awakeableId = run.approval?.restateAwakeableId;
    if (!awakeableId) {
      throw new BadRequestException('No pending approval to resolve');
    }

    try {
      await this.restate.resolveApproval(awakeableId, { approved, comment });
    } catch (err) {
      this.logger.error(`Failed to resolve approval ${reviewId}`, err as Error);
      throw new BadGatewayException('Could not resume the review workflow');
    }

    const decidedAt = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.reviewRun.update({
        where: { id: reviewId },
        data: {
          status: approved ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
        },
        include: { steps: { orderBy: { executedAt: 'asc' } } },
      }),
      this.prisma.approval.update({
        where: { reviewRunId: reviewId },
        data: {
          reviewerId: userId,
          decision: approved
            ? ApprovalDecision.APPROVED
            : ApprovalDecision.REJECTED,
          comment: comment ?? null,
          decidedAt,
        },
      }),
    ]);

    return toReviewRunDto(updated);
  }
}
