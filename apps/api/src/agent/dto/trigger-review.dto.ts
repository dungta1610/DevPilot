import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TriggerReviewDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  prUrl!: string;
}
