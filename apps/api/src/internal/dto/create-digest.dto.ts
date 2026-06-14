import { IsString, MinLength } from 'class-validator';

/** Body the DigestAgent posts after Gemini produces a digest. */
export class CreateDigestDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
