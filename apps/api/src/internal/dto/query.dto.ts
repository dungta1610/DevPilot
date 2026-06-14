import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetTasksQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Relative window like "24h" or "7d" filtering on updatedAt. */
  @IsOptional()
  @IsString()
  updatedSince?: string;
}

export class GetReviewsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  /** Relative window like "24h" filtering on completedAt. */
  @IsOptional()
  @IsString()
  completedSince?: string;
}
