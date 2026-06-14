import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RestateModule } from './restate.module';

@Module({
  imports: [ProjectsModule, RestateModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
