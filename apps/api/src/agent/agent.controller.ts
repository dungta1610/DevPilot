import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { AgentService, ReviewStreamEvent } from './agent.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { TriggerReviewDto } from './dto/trigger-review.dto';
import { ReviewRunDto } from './dto/review-run.dto';
import { ApprovalDto, DecisionDto } from './dto/approval.dto';

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
   * SSE stream. Public so the browser's EventSource (which can't send an
   * Authorization header) can connect. In Phase 1 it emits a single terminal
   * event and closes; Phase 2 relays live agent step events.
   */
  @Public()
  @SkipTransform()
  @Sse('reviews/:id/stream')
  stream(@Param('id') id: string): Observable<{ data: ReviewStreamEvent }> {
    return of({ data: this.agentService.buildStreamEvent(id) });
  }

  @Post('reviews/:id/approve')
  approve(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ): Promise<ApprovalDto> {
    return this.agentService.approve(userId, id, dto.comment);
  }

  @Post('reviews/:id/reject')
  reject(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ): Promise<ApprovalDto> {
    return this.agentService.reject(userId, id, dto.comment);
  }
}
