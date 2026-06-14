import request from 'supertest';
import { Project, ProjectRole, User } from '@prisma/client';
import { DigestAgentStatus, RestateClient } from '../src/agent/restate.client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

/**
 * The digest control endpoints (start / status) that drive the DigestAgent
 * durable-sleep workflow. The Restate ingress client is stubbed so we verify the
 * NestJS half: idempotent start, status passthrough, and member guarding.
 */
describe('Digest agent control (e2e)', () => {
  let ctx: TestContext;
  let owner: User;
  let ownerToken: string;
  let project: Project;

  let status: DigestAgentStatus;

  const restate: Partial<RestateClient> = {
    startDigest: jest.fn().mockResolvedValue(undefined),
    getDigestStatus: jest.fn(async () => status),
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: RestateClient, useValue: restate }]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    status = {
      status: null,
      projectId: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
    };
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

  it('POST /digest/start submits the workflow when none is running', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/digest/start`)
      .set(auth(ownerToken));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ started: true });
    expect(restate.startDigest).toHaveBeenCalledWith(project.id);
  });

  it('POST /digest/start is idempotent when already running', async () => {
    status.status = 'running';

    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/digest/start`)
      .set(auth(ownerToken));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ started: false });
    expect(restate.startDigest).not.toHaveBeenCalled();
  });

  it('GET /digest/status returns the workflow status', async () => {
    status.status = 'running';
    status.lastSuccessAt = '2026-06-14T09:00:00.000Z';

    const res = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/digest/status`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'running',
      lastSuccessAt: '2026-06-14T09:00:00.000Z',
    });
  });

  it('blocks non-members (404)', async () => {
    const outsider = await seedUser(ctx.prisma, { email: 'out@example.com' });
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/digest/start`)
      .set(auth(tokenFor(ctx.jwt, outsider)));
    expect(res.status).toBe(404);
    expect(restate.startDigest).not.toHaveBeenCalled();
  });
});
