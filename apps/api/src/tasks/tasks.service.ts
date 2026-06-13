import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { TaskDto, toTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async listForProject(
    projectId: string,
    filter: FilterTasksDto,
  ): Promise<TaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
        ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
      },
      include: { assignee: true },
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map(toTaskDto);
  }

  async createForProject(
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskDto> {
    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: { assignee: true },
    });
    return toTaskDto(task);
  }

  async update(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    // Verifies the caller belongs to the task's project (404 otherwise).
    await this.projectsService.assertMember(userId, existing.projectId);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data,
      include: { assignee: true },
    });
    return toTaskDto(task);
  }

  async remove(userId: string, taskId: string): Promise<void> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    await this.projectsService.assertMember(userId, existing.projectId);
    await this.prisma.task.delete({ where: { id: taskId } });
  }
}
