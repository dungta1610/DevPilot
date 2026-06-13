import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const PROJECT_ROLES_KEY = 'projectRoles';

/**
 * Restricts a `/projects/:id/*` route to members holding one of the given
 * roles. Enforced by ProjectMemberGuard. With no decorator, any member passes.
 */
export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

/** Injects the membership record attached by ProjectMemberGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ membership?: ProjectMembership }>();
    return request.membership;
  },
);
