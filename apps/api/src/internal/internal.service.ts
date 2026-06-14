import { Injectable } from '@nestjs/common';
import {
  DigestStatus,
  Prisma,
  ReviewStatus,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaskDto, toTaskDto } from '../tasks/dto/task.dto';
import { ReviewRunDto, toReviewRunDto } from '../agent/dto/review-run.dto';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ProjectStats {
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  totalTasks: number;
  overdueTasks: number;
  reviewsThisWeek: number;
  completedTasksThisWeek: number;
  reviewsAwaitingApproval: number;
}

/**
 * Backs the agent-facing `/internal/projects/:id/*` read endpoints (consumed by
 * the project-assistant tools and the digest agent) and the digest sink the
 * DigestAgent posts to. All routes are shared-secret guarded — no JWT user.
 */
@Injectable()
export class InternalService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(
    projectId: string,
    filters: {
      status?: TaskStatus;
      priority?: TaskPriority;
      updatedSince?: string;
    },
  ): Promise<TaskDto[]> {
    const where: Prisma.TaskWhereInput = { projectId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    const since = parseSince(filters.updatedSince);
    if (since) where.updatedAt = { gte: since };

    const tasks = await this.prisma.task.findMany({
      where,
      include: { assignee: true },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    return tasks.map(toTaskDto);
  }

  async getReviews(
    projectId: string,
    opts: { limit?: number; completedSince?: string },
  ): Promise<ReviewRunDto[]> {
    const where: Prisma.ReviewRunWhereInput = { projectId };
    const since = parseSince(opts.completedSince);
    if (since) where.completedAt = { gte: since };

    const reviews = await this.prisma.reviewRun.findMany({
      where,
      include: { steps: true },
      orderBy: { startedAt: 'desc' },
      take: opts.limit && opts.limit > 0 ? opts.limit : 10,
    });
    return reviews.map(toReviewRunDto);
  }

  async getStats(projectId: string): Promise<ProjectStats> {
    const weekAgo = new Date(Date.now() - WEEK_MS);

    const [
      byStatus,
      byPriority,
      total,
      overdue,
      reviewsThisWeek,
      completedTasksThisWeek,
      awaitingApproval,
    ] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.task.count({
        where: {
          projectId,
          status: { not: TaskStatus.DONE },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.reviewRun.count({
        where: {
          projectId,
          status: ReviewStatus.COMPLETED,
          completedAt: { gte: weekAgo },
        },
      }),
      this.prisma.task.count({
        where: {
          projectId,
          status: TaskStatus.DONE,
          updatedAt: { gte: weekAgo },
        },
      }),
      this.prisma.reviewRun.count({
        where: { projectId, status: ReviewStatus.AWAITING_APPROVAL },
      }),
    ]);

    return {
      tasksByStatus: zeroFilled(TaskStatus, byStatus, 'status'),
      tasksByPriority: zeroFilled(TaskPriority, byPriority, 'priority'),
      totalTasks: total,
      overdueTasks: overdue,
      reviewsThisWeek,
      completedTasksThisWeek,
      reviewsAwaitingApproval: awaitingApproval,
    };
  }

  /** Persist a digest produced by the agent. Stored as SENT (it's delivered). */
  async createDigest(
    projectId: string,
    content: string,
  ): Promise<{ id: string; createdAt: string }> {
    const now = new Date();
    const digest = await this.prisma.digestRun.create({
      data: {
        projectId,
        content,
        status: DigestStatus.SENT,
        scheduledFor: now,
        sentAt: now,
      },
    });
    return { id: digest.id, createdAt: digest.createdAt.toISOString() };
  }
}

/** Parse a relative window like "24h" / "7d" into an absolute cutoff Date. */
function parseSince(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d+)([hd])$/.exec(value.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  const ms = match[2] === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

/** Turn a Prisma groupBy result into a fully-populated enum→count map. */
function zeroFilled<E extends Record<string, string>>(
  enumObj: E,
  groups: Array<Record<string, unknown> & { _count: { _all: number } }>,
  key: string,
): Record<E[keyof E], number> {
  const out = {} as Record<E[keyof E], number>;
  for (const value of Object.values(enumObj)) {
    out[value as E[keyof E]] = 0;
  }
  for (const group of groups) {
    out[group[key] as E[keyof E]] = group._count._all;
  }
  return out;
}
