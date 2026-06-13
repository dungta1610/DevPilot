import { Project, ProjectMember, ProjectRole, User } from '@prisma/client';

export class ProjectDto {
  id!: string;
  name!: string;
  description!: string | null;
  githubRepo!: string;
  ownerId!: string;
  createdAt!: string;
  updatedAt!: string;
}

export class ProjectDetailDto extends ProjectDto {
  memberCount!: number;
  taskCount!: number;
  openReviewCount!: number;
}

export class MemberDto {
  userId!: string;
  name!: string;
  email!: string;
  avatarUrl!: string | null;
  role!: ProjectRole;
  joinedAt!: string;
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    githubRepo: project.githubRepo,
    ownerId: project.ownerId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toMemberDto(member: ProjectMember & { user: User }): MemberDto {
  return {
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    avatarUrl: member.user.avatarUrl,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}
