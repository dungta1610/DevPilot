import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DigestAgentStatus, RestateClient } from '../agent/restate.client';
import {
  DigestRunDto,
  SentDigestRun,
  toDigestRunDto,
} from './dto/digest-run.dto';

export interface StartDigestResult {
  started: boolean;
  reason?: string;
}

@Injectable()
export class DigestsService {
  private readonly logger = new Logger(DigestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly restate: RestateClient,
  ) {}

  /** Newest-first digests that have produced content (PENDING ones are hidden). */
  async listForProject(projectId: string): Promise<DigestRunDto[]> {
    const digests = await this.prisma.digestRun.findMany({
      where: { projectId, content: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    // The `content: { not: null }` filter guarantees content is present at runtime.
    return (digests as SentDigestRun[]).map(toDigestRunDto);
  }

  /**
   * Start the durable-sleep digest loop for a project. Idempotent: if the
   * DigestAgent workflow is already running for this project key, we don't start
   * a second one — Restate would reject a duplicate run anyway, but reporting it
   * cleanly is nicer for the UI.
   */
  async startDigest(projectId: string): Promise<StartDigestResult> {
    const current = await this.safeStatus(projectId);
    if (current?.status === 'running') {
      return { started: false, reason: 'already running' };
    }
    await this.restate.startDigest(projectId);
    return { started: true };
  }

  getStatus(projectId: string): Promise<DigestAgentStatus> {
    return this.restate.getDigestStatus(projectId);
  }

  /** Status read that tolerates a never-started workflow (returns null status). */
  private async safeStatus(
    projectId: string,
  ): Promise<DigestAgentStatus | null> {
    try {
      return await this.restate.getDigestStatus(projectId);
    } catch (err) {
      this.logger.debug(
        `DigestAgent status unavailable for ${projectId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
