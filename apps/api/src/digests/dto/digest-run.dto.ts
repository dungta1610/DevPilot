import { DigestRun } from '@prisma/client';

export class DigestRunDto {
  id!: string;
  projectId!: string;
  summary!: string;
  createdAt!: string;
}

/** A digest that has produced content (the only kind surfaced to the UI). */
export type SentDigestRun = DigestRun & { content: string };

export function toDigestRunDto(digest: SentDigestRun): DigestRunDto {
  return {
    id: digest.id,
    projectId: digest.projectId,
    summary: digest.content,
    createdAt: digest.createdAt.toISOString(),
  };
}
