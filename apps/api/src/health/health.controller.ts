import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/** Liveness probe for Railway / uptime checks. Public — no JWT required. */
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
