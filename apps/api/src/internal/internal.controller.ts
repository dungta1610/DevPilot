import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { InternalService, ProjectStats } from './internal.service';
import { GetReviewsQueryDto, GetTasksQueryDto } from './dto/query.dto';
import { CreateDigestDto } from './dto/create-digest.dto';
import { TaskDto } from '../tasks/dto/task.dto';
import { ReviewRunDto } from '../agent/dto/review-run.dto';

/**
 * Agent-facing project-data API. Read endpoints feed the project-assistant tools
 * and the digest agent; the digest POST is where the DigestAgent persists its
 * output. Every route is `@Public()` (no JWT) but shared-secret guarded — only
 * the agent service, holding `x-internal-secret`, can reach them.
 */
@Public()
@UseGuards(InternalSecretGuard)
@Controller('internal/projects/:id')
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  @Get('tasks')
  getTasks(
    @Param('id') projectId: string,
    @Query() query: GetTasksQueryDto,
  ): Promise<TaskDto[]> {
    return this.internal.getTasks(projectId, query);
  }

  @Get('reviews')
  getReviews(
    @Param('id') projectId: string,
    @Query() query: GetReviewsQueryDto,
  ): Promise<ReviewRunDto[]> {
    return this.internal.getReviews(projectId, query);
  }

  @Get('stats')
  getStats(@Param('id') projectId: string): Promise<ProjectStats> {
    return this.internal.getStats(projectId);
  }

  @Post('digests')
  @HttpCode(HttpStatus.CREATED)
  createDigest(
    @Param('id') projectId: string,
    @Body() dto: CreateDigestDto,
  ): Promise<{ id: string; createdAt: string }> {
    return this.internal.createDigest(projectId, dto.content);
  }
}
