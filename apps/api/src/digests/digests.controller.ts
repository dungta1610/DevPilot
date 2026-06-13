import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DigestsService } from './digests.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { DigestRunDto } from './dto/digest-run.dto';

@Controller()
export class DigestsController {
  constructor(private readonly digestsService: DigestsService) {}

  @Get('projects/:id/digests')
  @UseGuards(ProjectMemberGuard)
  listForProject(@Param('id') projectId: string): Promise<DigestRunDto[]> {
    return this.digestsService.listForProject(projectId);
  }
}
