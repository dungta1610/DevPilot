import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { TaskDto } from './dto/task.dto';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('projects/:id/tasks')
  @UseGuards(ProjectMemberGuard)
  list(
    @Param('id') projectId: string,
    @Query() filter: FilterTasksDto,
  ): Promise<TaskDto[]> {
    return this.tasksService.listForProject(projectId, filter);
  }

  @Post('projects/:id/tasks')
  @UseGuards(ProjectMemberGuard)
  create(
    @Param('id') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.tasksService.createForProject(projectId, dto);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasksService.update(userId, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.tasksService.remove(userId, id);
  }
}
