import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentService } from './agent.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { TriggerReviewDto } from './dto/trigger-review.dto';
import { DecisionDto } from './dto/approval.dto';
import {
  AwaitingApprovalDto,
  RecordStepDto,
  ResultDto,
} from './dto/internal.dto';
import { ReviewRunDto } from './dto/review-run.dto';
import { SseFrame } from './sse-event';

@Controller()
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('reviews')
  trigger(
    @CurrentUser('id') userId: string,
    @Body() dto: TriggerReviewDto,
  ): Promise<ReviewRunDto> {
    return this.agentService.triggerReview(userId, dto);
  }

  @Get('reviews/:id')
  getOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<ReviewRunDto> {
    return this.agentService.getReview(userId, id);
  }

  @Get('projects/:id/reviews')
  @UseGuards(ProjectMemberGuard)
  listForProject(@Param('id') projectId: string): Promise<ReviewRunDto[]> {
    return this.agentService.listForProject(projectId);
  }

  /**
   * Live agent step stream. Public so the browser's EventSource (which can't
   * send an Authorization header) can connect; SkipTransform keeps the frames
   * as raw `text/event-stream`.
   */
  @Public()
  @SkipTransform()
  @Sse('reviews/:id/stream')
  stream(@Param('id') id: string): Observable<SseFrame> {
    return this.agentService.stream(id);
  }

  @Post('reviews/:id/approve')
  approve(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ): Promise<ReviewRunDto> {
    return this.agentService.approve(userId, id, dto.comment);
  }

  @Post('reviews/:id/reject')
  reject(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ): Promise<ReviewRunDto> {
    return this.agentService.reject(userId, id, dto.comment);
  }

  // --- Internal: called by the agent service, authenticated by shared secret.

  @Public()
  @UseGuards(InternalSecretGuard)
  @Post('internal/reviews/:id/steps')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordStep(
    @Param('id') id: string,
    @Body() dto: RecordStepDto,
  ): Promise<void> {
    return this.agentService.recordStep(id, dto);
  }

  @Public()
  @UseGuards(InternalSecretGuard)
  @Post('internal/reviews/:id/awaiting-approval')
  @HttpCode(HttpStatus.NO_CONTENT)
  awaitingApproval(
    @Param('id') id: string,
    @Body() dto: AwaitingApprovalDto,
  ): Promise<void> {
    return this.agentService.setAwaitingApproval(id, dto);
  }

  @Public()
  @UseGuards(InternalSecretGuard)
  @Post('internal/reviews/:id/result')
  @HttpCode(HttpStatus.NO_CONTENT)
  result(@Param('id') id: string, @Body() dto: ResultDto): Promise<void> {
    return this.agentService.finalizeResult(id, dto);
  }
}
