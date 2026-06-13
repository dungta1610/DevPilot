import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Wraps every successful response in a consistent envelope:
 * `{ success: true, data, timestamp }`.
 *
 * - Routes marked `@SkipTransform()` (e.g. SSE) pass through untouched.
 * - `undefined` bodies (204 No Content) are left empty.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | undefined>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | undefined> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        if (skip || data === undefined) {
          return data as undefined;
        }
        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
