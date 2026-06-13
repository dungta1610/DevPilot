import request from 'supertest';
import { Project, ProjectRole, TaskPriority, User } from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

describe('Chat (e2e)', () => {
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
        name: 'Payments',
        githubRepo: 'acme/payments',
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

  it('POST /projects/:id/chat persists the turn and returns an assistant reply', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: 'Hello there' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: 'assistant' });
    expect(typeof res.body.data.content).toBe('string');
    expect(res.body.data.content.length).toBeGreaterThan(0);

    const stored = await ctx.prisma.chatMessage.findMany({
      where: { projectId: project.id },
    });
    expect(stored).toHaveLength(2); // user + assistant
  });

  it("grounds the reply in the project's real tasks", async () => {
    await ctx.prisma.task.create({
      data: {
        projectId: project.id,
        title: 'Add idempotency keys',
        priority: TaskPriority.URGENT,
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: 'What should I focus on this sprint?' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('Add idempotency keys');
  });

  it('GET /projects/:id/chat/history returns messages oldest-first', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: 'First question' });

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/chat/history`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      role: 'user',
      content: 'First question',
    });
    expect(res.body.data[1].role).toBe('assistant');
  });

  it('returns 404 for a project the user is not a member of', async () => {
    const outsider = await seedUser(ctx.prisma, {
      email: 'outsider@example.com',
    });
    const outsiderToken = tokenFor(ctx.jwt, outsider);

    const history = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/chat/history`)
      .set(auth(outsiderToken));
    expect(history.status).toBe(404);

    const send = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(outsiderToken))
      .send({ content: 'sneaking in' });
    expect(send.status).toBe(404);
  });

  it('rejects an empty message', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});
