import { User } from '@prisma/client';

/** Public-facing user shape (see `GET /auth/me`). */
export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  avatarUrl!: string | null;
  githubId!: string;
  createdAt!: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    githubId: user.githubId,
    createdAt: user.createdAt.toISOString(),
  };
}
