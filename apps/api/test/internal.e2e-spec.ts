import request from 'supertest';
import {
  Project,
  ProjectRole,
  TaskPriority,
  TaskStatus,
  User,
} from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

/**
 * The agent-facing `/internal/projects/:id/*` data API consumed by the
 * project-assistant tools and the digest agent. Authenticated by shared secret
 * only (no JWT), so these tests hit it the way the agent would.
 */
describe('Internal project data API (e2e)', () => {
  let ctx: TestContext;
  let owner: User;
  let project: Project;

  const SECRET = 'dev-internal-secret';
  const withSecret = (req: request.Test) =>
    req.set('x-internal-secret', SECRET);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    owner = await seedUser(ctx.prisma, { email: 'owner@example.com' });
    project = await ctx.prisma.project.create({
      data: {
        name: 'Payments',
        githubRepo: 'acme/payments',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
    await ctx.prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          title: 'Add idempotency keys',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.URGENT,
        },
        {
          projectId: project.id,
          title: 'Write tests',
          status: TaskStatus.DONE,
          priority: TaskPriority.MEDIUM,
        },
        {
          projectId: project.id,
          title: 'Overdue thing',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          dueDate: new Date('2020-01-01T00:00:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.app.close();
  });

  it('rejects requests without the shared secret', async () => {
    const noSecret = await request(ctx.app.getHttpServer()).get(
      `/internal/projects/${project.id}/tasks`,
    );
    expect(noSecret.status).toBe(401);

    const wrong = await request(ctx.app.getHttpServer())
      .get(`/internal/projects/${project.id}/tasks`)
      .set('x-internal-secret', 'nope');
    expect(wrong.status).toBe(401);
  });

  it('GET tasks returns the project tasks and filters by status', async () => {
    const all = await withSecret(
      request(ctx.app.getHttpServer()).get(
        `/internal/projects/${project.id}/tasks`,
      ),
    );
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);

    const done = await withSecret(
      request(ctx.app.getHttpServer()).get(
        `/internal/projects/${project.id}/tasks?status=DONE`,
      ),
    );
    expect(done.status).toBe(200);
    expect(done.body.data).toHaveLength(1);
    expect(done.body.data[0].title).toBe('Write tests');
  });

  it('GET stats aggregates counts, overdue, and weekly completions', async () => {
    const res = await withSecret(
      request(ctx.app.getHttpServer()).get(
        `/internal/projects/${project.id}/stats`,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalTasks: 3,
      overdueTasks: 1,
      completedTasksThisWeek: 1,
    });
    expect(res.body.data.tasksByStatus).toMatchObject({
      IN_PROGRESS: 1,
      DONE: 1,
      TODO: 1,
      BACKLOG: 0,
    });
    expect(res.body.data.tasksByPriority).toMatchObject({ URGENT: 1, HIGH: 1 });
  });

  it('POST digests persists a SENT digest that the project digest list surfaces', async () => {
    const created = await withSecret(
      request(ctx.app.getHttpServer())
        .post(`/internal/projects/${project.id}/digests`)
        .send({ content: '## Daily digest\n- Shipped idempotency keys' }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.id).toBeTruthy();

    const stored = await ctx.prisma.digestRun.findMany({
      where: { projectId: project.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('SENT');
    expect(stored[0].sentAt).not.toBeNull();
  });

  it('GET exists reports project presence', async () => {
    const present = await withSecret(
      request(ctx.app.getHttpServer()).get(
        `/internal/projects/${project.id}/exists`,
      ),
    );
    expect(present.status).toBe(200);
    expect(present.body.data).toEqual({ exists: true });

    const missing = await withSecret(
      request(ctx.app.getHttpServer()).get(
        `/internal/projects/00000000-0000-0000-0000-000000000000/exists`,
      ),
    );
    expect(missing.body.data).toEqual({ exists: false });
  });

  it('rejects an empty digest body', async () => {
    const res = await withSecret(
      request(ctx.app.getHttpServer())
        .post(`/internal/projects/${project.id}/digests`)
        .send({ content: '' }),
    );
    expect(res.status).toBe(400);
  });
});
