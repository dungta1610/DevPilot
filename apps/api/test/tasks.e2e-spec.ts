import request from 'supertest';
import { Project, ProjectRole, TaskStatus, User } from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

describe('Tasks (e2e)', () => {
  let ctx: TestContext;
  let owner: User;
  let ownerToken: string;
  let project: Project;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    owner = await seedUser(ctx.prisma, { email: 'owner@example.com' });
    ownerToken = tokenFor(ctx.jwt, owner);
    project = await ctx.prisma.project.create({
      data: {
        name: 'Board',
        githubRepo: 'acme/board',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
  });

  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('POST /projects/:id/tasks creates a task in the correct project', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set(auth(ownerToken))
      .send({ title: 'Ship it', priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Ship it',
      priority: 'HIGH',
      status: 'BACKLOG',
      projectId: project.id,
    });
  });

  it('GET /projects/:id/tasks filters by status', async () => {
    await ctx.prisma.task.createMany({
      data: [
        { projectId: project.id, title: 'Backlog item', status: TaskStatus.BACKLOG },
        { projectId: project.id, title: 'Doing it', status: TaskStatus.IN_PROGRESS },
        { projectId: project.id, title: 'Also doing', status: TaskStatus.IN_PROGRESS },
      ],
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({ status: 'IN_PROGRESS' })
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(
      res.body.data.every((t: { status: string }) => t.status === 'IN_PROGRESS'),
    ).toBe(true);
  });

  it('PATCH /tasks/:id returns 404 for a task in a project the user cannot access', async () => {
    const task = await ctx.prisma.task.create({
      data: { projectId: project.id, title: 'Private task' },
    });
    const outsider = await seedUser(ctx.prisma, {
      email: 'outsider@example.com',
    });

    const res = await request(ctx.app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set(auth(tokenFor(ctx.jwt, outsider)))
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(404);
  });
});
