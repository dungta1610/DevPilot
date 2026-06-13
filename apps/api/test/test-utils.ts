import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestFactory, Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  jwt: JwtService;
}

/** Boots a Nest app configured exactly like main.ts for integration tests. */
export async function createTestApp(): Promise<TestContext> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string>('frontendUrl') });

  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    jwt: app.get(JwtService),
  };
}

/** Truncates all tables in FK-safe order. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.approval.deleteMany();
  await prisma.agentStep.deleteMany();
  await prisma.reviewRun.deleteMany();
  await prisma.digestRun.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

let userCounter = 0;

export async function seedUser(
  prisma: PrismaService,
  overrides: Partial<Pick<User, 'email' | 'name' | 'githubId'>> = {},
): Promise<User> {
  userCounter += 1;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${userCounter}@example.com`,
      name: overrides.name ?? `Test User ${userCounter}`,
      githubId: overrides.githubId ?? `gh_${userCounter}_${Date.now()}`,
    },
  });
}

export function tokenFor(jwt: JwtService, user: User): string {
  return jwt.sign({ sub: user.id, email: user.email });
}
