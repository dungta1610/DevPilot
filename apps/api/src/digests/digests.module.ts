import { Module } from '@nestjs/common';
import { RestateModule } from '../agent/restate.module';
import { DigestsController } from './digests.controller';
import { DigestsService } from './digests.service';

@Module({
  imports: [RestateModule],
  controllers: [DigestsController],
  providers: [DigestsService],
})
export class DigestsModule {}
