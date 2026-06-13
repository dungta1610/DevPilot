import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GithubProfileInput {
  githubId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Creates the user on first GitHub login, or refreshes their token/profile. */
  upsertFromGithub(profile: GithubProfileInput): Promise<User> {
    return this.prisma.user.upsert({
      where: { githubId: profile.githubId },
      create: {
        githubId: profile.githubId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        githubToken: profile.accessToken,
      },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        githubToken: profile.accessToken,
      },
    });
  }
}
