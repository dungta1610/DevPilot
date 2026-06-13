import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';

/**
 * Injects the authenticated user (populated by JwtStrategy) into a handler.
 * `@CurrentUser()` returns the whole user; `@CurrentUser('id')` a single field.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
