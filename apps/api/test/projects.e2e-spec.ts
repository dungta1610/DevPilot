import request from 'supertest';
import { ProjectRole, User } from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

describe('Projects (e2e)', () => {
  let ctx: TestContext;
  let owner: User;
  let ownerToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    owner = await seedUser(ctx.prisma, { email: 'owner@example.com' });
    ownerToken = tokenFor(ctx.jwt, owner);
  });

  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('POST /projects creates the project and an OWNER membership', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/projects')
      .set(auth(ownerToken))
      .send({ name: 'Payments', githubRepo: 'acme/payments' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Payments',
      githubRepo: 'acme/payments',
      ownerId: owner.id,
    });

    const membership = await ctx.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: res.body.data.id, userId: owner.id },
      },
    });
    expect(membership?.role).toBe(ProjectRole.OWNER);
  });

  it('GET /projects returns only the projects the user belongs to', async () => {
    // owner's project
    await ctx.prisma.project.create({
      data: {
        name: 'Mine',
        githubRepo: 'acme/mine',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
    // a stranger's project the owner can't see
    const stranger = await seedUser(ctx.prisma, {
      email: 'stranger@example.com',
    });
    await ctx.prisma.project.create({
      data: {
        name: 'Theirs',
        githubRepo: 'acme/theirs',
        ownerId: stranger.id,
        members: { create: { userId: stranger.id, role: ProjectRole.OWNER } },
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .get('/projects')
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mine');
  });

  it('GET /projects/:id returns 404 for a non-member', async () => {
    const project = await ctx.prisma.project.create({
      data: {
        name: 'Secret',
        githubRepo: 'acme/secret',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
    const outsider = await seedUser(ctx.prisma, {
      email: 'outsider@example.com',
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set(auth(tokenFor(ctx.jwt, outsider)));

    expect(res.status).toBe(404);
  });

  it('PATCH /projects/:id returns 403 for a MEMBER', async () => {
    const project = await ctx.prisma.project.create({
      data: {
        name: 'Team',
        githubRepo: 'acme/team',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
    const member = await seedUser(ctx.prisma, { email: 'member@example.com' });
    await ctx.prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: member.id,
        role: ProjectRole.MEMBER,
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set(auth(tokenFor(ctx.jwt, member)))
      .send({ name: 'Renamed' });

    expect(res.status).toBe(403);
  });

  it('DELETE /projects/:id cascades related data', async () => {
    const project = await ctx.prisma.project.create({
      data: {
        name: 'Doomed',
        githubRepo: 'acme/doomed',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
        tasks: { create: { title: 'A task' } },
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set(auth(ownerToken));

    expect(res.status).toBe(204);
    expect(await ctx.prisma.project.count()).toBe(0);
    expect(await ctx.prisma.task.count()).toBe(0);
    expect(await ctx.prisma.projectMember.count()).toBe(0);
  });
});
