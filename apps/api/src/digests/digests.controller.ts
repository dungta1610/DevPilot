import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DigestsService, StartDigestResult } from './digests.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { DigestRunDto } from './dto/digest-run.dto';
import { DigestAgentStatus } from '../agent/restate.client';

@Controller()
export class DigestsController {
  constructor(private readonly digestsService: DigestsService) {}

  @Get('projects/:id/digests')
  @UseGuards(ProjectMemberGuard)
  listForProject(@Param('id') projectId: string): Promise<DigestRunDto[]> {
    return this.digestsService.listForProject(projectId);
  }

  /** Start the recurring daily-digest agent (durable sleep) for this project. */
  @Post('projects/:id/digest/start')
  @UseGuards(ProjectMemberGuard)
  start(@Param('id') projectId: string): Promise<StartDigestResult> {
    return this.digestsService.startDigest(projectId);
  }

  @Get('projects/:id/digest/status')
  @UseGuards(ProjectMemberGuard)
  status(@Param('id') projectId: string): Promise<DigestAgentStatus> {
    return this.digestsService.getStatus(projectId);
  }
}
