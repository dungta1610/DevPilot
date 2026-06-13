import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guards the `/internal/*` callbacks the agent service uses to report progress.
 * Verifies the shared `x-internal-secret` header. These routes are also marked
 * `@Public()` so the global JWT guard lets them through (the agent has no JWT).
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = request.headers['x-internal-secret'];
    const expected = this.config.get<string>('internalSecret');

    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
