import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DigestRunDto,
  SentDigestRun,
  toDigestRunDto,
} from './dto/digest-run.dto';

@Injectable()
export class DigestsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest-first digests that have produced content (PENDING ones are hidden). */
  async listForProject(projectId: string): Promise<DigestRunDto[]> {
    const digests = await this.prisma.digestRun.findMany({
      where: { projectId, content: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    // The `content: { not: null }` filter guarantees content is present at runtime.
    return (digests as SentDigestRun[]).map(toDigestRunDto);
  }
}
