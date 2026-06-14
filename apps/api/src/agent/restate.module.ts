import { Module } from '@nestjs/common';
import { RestateClient } from './restate.client';

/**
 * Shares the single Restate ingress client across the modules that talk to the
 * agent service (reviews, assistant chat, digests).
 */
@Module({
  providers: [RestateClient],
  exports: [RestateClient],
})
export class RestateModule {}
