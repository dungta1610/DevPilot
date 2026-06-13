import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [ProjectsModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
