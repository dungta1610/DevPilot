import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RestateClient } from './restate.client';

@Module({
  imports: [ProjectsModule],
  controllers: [AgentController],
  providers: [AgentService, RestateClient],
})
export class AgentModule {}
