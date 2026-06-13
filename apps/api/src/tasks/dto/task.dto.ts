import { Task, TaskPriority, TaskStatus, User } from '@prisma/client';

export class TaskAssigneeDto {
  id!: string;
  name!: string;
  avatarUrl!: string | null;
}

export class TaskDto {
  id!: string;
  projectId!: string;
  title!: string;
  description!: string | null;
  status!: TaskStatus;
  priority!: TaskPriority;
  assigneeId!: string | null;
  assignee!: TaskAssigneeDto | null;
  dueDate!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export type TaskWithAssignee = Task & { assignee: User | null };

export function toTaskDto(task: TaskWithAssignee): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name,
          avatarUrl: task.assignee.avatarUrl,
        }
      : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
