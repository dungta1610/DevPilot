import { Injectable } from '@nestjs/common';
import {
  ChatRole,
  ReviewStatus,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageDto, toChatMessageDto } from './dto/chat-message.dto';

/**
 * Phase 1 implementation: persists chat turns and answers with a rule-based
 * assistant grounded in the project's real tasks and reviews — no external LLM.
 * Phase 2 replaces `composeReply` with a tool-using agent and streams tokens
 * over SSE; the persistence and API shape stay the same.
 */
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(projectId: string): Promise<ChatMessageDto[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(toChatMessageDto);
  }

  /** Records the user's message, generates a grounded reply, and persists both. */
  async sendMessage(
    projectId: string,
    content: string,
  ): Promise<ChatMessageDto> {
    await this.prisma.chatMessage.create({
      data: { projectId, role: ChatRole.USER, content },
    });

    const replyText = await this.composeReply(projectId, content);

    const reply = await this.prisma.chatMessage.create({
      data: { projectId, role: ChatRole.ASSISTANT, content: replyText },
    });
    return toChatMessageDto(reply);
  }

  /** Answers grounded in the project's current tasks and reviews. */
  private async composeReply(
    projectId: string,
    prompt: string,
  ): Promise<string> {
    const p = prompt.toLowerCase();

    const [urgentOpen, inProgress, openTasks, awaitingApproval, latestReview] =
      await Promise.all([
        this.prisma.task.findMany({
          where: {
            projectId,
            priority: TaskPriority.URGENT,
            status: { not: TaskStatus.DONE },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.task.count({
          where: { projectId, status: TaskStatus.IN_PROGRESS },
        }),
        this.prisma.task.count({
          where: { projectId, status: { not: TaskStatus.DONE } },
        }),
        this.prisma.reviewRun.count({
          where: { projectId, status: ReviewStatus.AWAITING_APPROVAL },
        }),
        this.prisma.reviewRun.findFirst({
          where: { projectId, resultSummary: { not: null } },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

    if (/sprint|focus|next|priorit|work on/.test(p)) {
      const steps: string[] = [];
      if (awaitingApproval > 0) {
        steps.push(
          `clear the ${plural(awaitingApproval, 'review')} awaiting your approval — those block merges`,
        );
      }
      if (urgentOpen.length > 0) {
        const more =
          urgentOpen.length > 1 ? ` (plus ${urgentOpen.length - 1} more)` : '';
        steps.push(`pick up the urgent task "${urgentOpen[0].title}"${more}`);
      }
      if (steps.length === 0) {
        return `Nothing urgent right now — ${plural(openTasks, 'open task')} and no reviews waiting. Good moment to push the ${plural(inProgress, 'in-progress item')} toward done or groom the backlog.`;
      }
      return `I'd ${steps.join(', then ')}.`;
    }

    if (p.includes('security')) {
      return latestReview?.resultSummary
        ? `The most recent review summarized: "${latestReview.resultSummary}" Treat any high-severity finding as a release blocker.`
        : `No completed reviews with findings yet for this project. Trigger a review on an open PR and I'll surface what the security agent flags.`;
    }

    if (/quality|trend/.test(p)) {
      return latestReview?.resultSummary
        ? `Latest review summary: "${latestReview.resultSummary}" There ${awaitingApproval === 1 ? 'is' : 'are'} ${plural(awaitingApproval, 'review')} still awaiting approval.`
        : `No review findings recorded yet, so there's no quality trend to report. ${plural(openTasks, 'open task')} on the board right now.`;
    }

    return `Here's the current state: ${plural(openTasks, 'open task')} (${inProgress} in progress) and ${plural(awaitingApproval, 'review')} awaiting approval. Ask me about sprint planning, security findings, code-quality trends, or what to work on next.`;
  }
}

/** "1 task" / "3 tasks". */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
