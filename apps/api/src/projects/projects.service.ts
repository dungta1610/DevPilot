import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project, ProjectMember, ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import {
  MemberDto,
  ProjectDetailDto,
  toMemberDto,
  toProjectDto,
} from './dto/project.dto';
import { UsersService } from '../users/users.service';

const OPEN_REVIEW_STATUSES = [
  'PENDING',
  'RUNNING',
  'AWAITING_APPROVAL',
] as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  // --- Access helpers (shared with Tasks/Agent modules) ---

  /** Returns the membership or throws 404 if the user can't see the project. */
  async assertMember(
    userId: string,
    projectId: string,
  ): Promise<ProjectMember> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Project not found');
    }
    return membership;
  }

  /** Asserts membership and that the role is one of `roles`, else 403. */
  async assertRole(
    userId: string,
    projectId: string,
    roles: ProjectRole[],
  ): Promise<ProjectMember> {
    const membership = await this.assertMember(userId, projectId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return membership;
  }

  // --- CRUD ---

  async listForUser(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        githubRepo: dto.githubRepo,
        ownerId: userId,
        members: {
          create: { userId, role: ProjectRole.OWNER },
        },
      },
    });
  }

  async getDetail(projectId: string): Promise<ProjectDetailDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [memberCount, taskCount, openReviewCount] = await Promise.all([
      this.prisma.projectMember.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.reviewRun.count({
        where: { projectId, status: { in: [...OPEN_REVIEW_STATUSES] } },
      }),
    ]);

    return {
      ...toProjectDto(project),
      memberCount,
      taskCount,
      openReviewCount,
    };
  }

  async update(projectId: string, dto: UpdateProjectDto): Promise<Project> {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.githubRepo !== undefined
          ? { githubRepo: dto.githubRepo }
          : {}),
      },
    });
  }

  async remove(projectId: string): Promise<void> {
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  // --- Members ---

  async listMembers(projectId: string): Promise<MemberDto[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map(toMemberDto);
  }

  async addMember(
    projectId: string,
    dto: CreateMemberDto,
  ): Promise<ProjectMember> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException(`No user found with email ${dto.email}`);
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    return this.prisma.projectMember.create({
      data: { projectId, userId: user.id, role: dto.role },
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    if (membership.role === ProjectRole.OWNER) {
      throw new ForbiddenException('The project owner cannot be removed');
    }
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
