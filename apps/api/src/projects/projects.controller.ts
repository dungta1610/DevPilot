import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectMember, ProjectRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { ProjectRoles } from '../common/decorators/project-roles.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import {
  MemberDto,
  ProjectDetailDto,
  ProjectDto,
  toProjectDto,
} from './dto/project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(@CurrentUser('id') userId: string): Promise<ProjectDto[]> {
    const projects = await this.projectsService.listForUser(userId);
    return projects.map(toProjectDto);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    const project = await this.projectsService.create(userId, dto);
    return toProjectDto(project);
  }

  @Get(':id')
  @UseGuards(ProjectMemberGuard)
  getOne(@Param('id') id: string): Promise<ProjectDetailDto> {
    return this.projectsService.getDetail(id);
  }

  @Patch(':id')
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    const project = await this.projectsService.update(id, dto);
    return toProjectDto(project);
  }

  @Delete(':id')
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles(ProjectRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectsService.remove(id);
  }

  @Get(':id/members')
  @UseGuards(ProjectMemberGuard)
  listMembers(@Param('id') id: string): Promise<MemberDto[]> {
    return this.projectsService.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  addMember(
    @Param('id') id: string,
    @Body() dto: CreateMemberDto,
  ): Promise<ProjectMember> {
    return this.projectsService.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.projectsService.removeMember(id, userId);
  }
}
