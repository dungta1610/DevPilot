import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';

/**
 * Guards `/projects/:id/*` routes. Verifies the current user is a member of the
 * project (404 otherwise — we don't reveal existence to non-members), attaches
 * the membership to the request, and enforces any `@ProjectRoles(...)`
 * requirement with a 403.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: User;
      params: Record<string, string>;
      membership?: unknown;
    }>();

    const user = request.user;
    if (!user) throw new NotFoundException('Project not found');

    const projectId = request.params.id ?? request.params.projectId;
    if (!projectId) throw new NotFoundException('Project not found');

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!membership) {
      // Hide existence from non-members.
      throw new NotFoundException('Project not found');
    }

    request.membership = {
      projectId,
      userId: user.id,
      role: membership.role,
    };

    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(membership.role)
    ) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
