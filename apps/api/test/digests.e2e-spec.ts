import request from 'supertest';
import { DigestStatus, Project, ProjectRole, User } from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

describe('Digests (e2e)', () => {
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

  it('GET /projects/:id/digests returns sent digests newest-first, mapping content to summary', async () => {
    await ctx.prisma.digestRun.createMany({
      data: [
        {
          projectId: project.id,
          status: DigestStatus.SENT,
          content: 'Older digest',
          scheduledFor: new Date('2026-06-01T09:00:00Z'),
          createdAt: new Date('2026-06-01T09:00:00Z'),
        },
        {
          projectId: project.id,
          status: DigestStatus.SENT,
          content: 'Newer digest',
          scheduledFor: new Date('2026-06-10T09:00:00Z'),
          createdAt: new Date('2026-06-10T09:00:00Z'),
        },
      ],
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/digests`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      projectId: project.id,
      summary: 'Newer digest',
    });
    expect(res.body.data[1].summary).toBe('Older digest');
  });

  it('excludes pending digests that have no content', async () => {
    await ctx.prisma.digestRun.create({
      data: {
        projectId: project.id,
        status: DigestStatus.PENDING,
        scheduledFor: new Date('2026-06-20T09:00:00Z'),
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/digests`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 404 for a project the user is not a member of', async () => {
    const outsider = await seedUser(ctx.prisma, {
      email: 'outsider@example.com',
    });
    const outsiderToken = tokenFor(ctx.jwt, outsider);

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/digests`)
      .set(auth(outsiderToken));
    expect(res.status).toBe(404);
  });
});
