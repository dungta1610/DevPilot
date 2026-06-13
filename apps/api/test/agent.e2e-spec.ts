import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Project, ProjectRole, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RestateClient } from '../src/agent/restate.client';
import { resetDb, seedUser, tokenFor } from './test-utils';

/**
 * Exercises the Phase 2 review API in isolation: the Restate ingress client is
 * stubbed, so we verify the NestJS half — workflow submission, the secret-gated
 * internal progress callbacks, lowercase wire status, and awakeable-resolving
 * approve/reject — without a live agent/Restate/Gemini.
 */
describe('Agent / reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let owner: User;
  let ownerToken: string;
  let project: Project;

  const restate = {
    submitReview: jest.fn().mockResolvedValue(undefined),
    resolveApproval: jest.fn().mockResolvedValue(undefined),
  };

  const INTERNAL_SECRET = 'dev-internal-secret';
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RestateClient)
      .useValue(restate)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDb(prisma);
    owner = await seedUser(prisma, { email: 'owner@example.com' });
    ownerToken = tokenFor(jwt, owner);
    project = await prisma.project.create({
      data: {
        name: 'Payments',
        githubRepo: 'acme/payments',
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: ProjectRole.OWNER } },
      },
    });
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  const trigger = () =>
    request(app.getHttpServer()).post('/reviews').set(auth(ownerToken)).send({
      projectId: project.id,
      prUrl: 'https://github.com/acme/payments/pull/1',
    });

  it('POST /reviews submits the workflow and returns a running review', async () => {
    const res = await trigger();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      projectId: project.id,
      status: 'running', // lowercase wire form
    });
    expect(restate.submitReview).toHaveBeenCalledWith({
      reviewRunId: res.body.data.id,
      prUrl: 'https://github.com/acme/payments/pull/1',
      projectId: project.id,
    });
  });

  it('non-members cannot trigger a review (404)', async () => {
    const outsider = await seedUser(prisma, { email: 'out@example.com' });
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set(auth(tokenFor(jwt, outsider)))
      .send({
        projectId: project.id,
        prUrl: 'https://github.com/acme/payments/pull/1',
      });
    expect(res.status).toBe(404);
    expect(restate.submitReview).not.toHaveBeenCalled();
  });

  it('internal step callback requires the shared secret', async () => {
    const { body } = await trigger();
    const reviewId = body.data.id;

    const noSecret = await request(app.getHttpServer())
      .post(`/internal/reviews/${reviewId}/steps`)
      .send({ agentName: 'fetch_pr', status: 'RUNNING' });
    expect(noSecret.status).toBe(401);

    const wrong = await request(app.getHttpServer())
      .post(`/internal/reviews/${reviewId}/steps`)
      .set('x-internal-secret', 'nope')
      .send({ agentName: 'fetch_pr', status: 'RUNNING' });
    expect(wrong.status).toBe(401);
  });

  it('records steps (lowercased on read) via the internal callback', async () => {
    const { body } = await trigger();
    const reviewId = body.data.id;

    const recorded = await request(app.getHttpServer())
      .post(`/internal/reviews/${reviewId}/steps`)
      .set('x-internal-secret', INTERNAL_SECRET)
      .send({
        agentName: 'quality_agent',
        status: 'COMPLETED',
        output: { issues: 3 },
        durationMs: 5400,
      });
    expect(recorded.status).toBe(204);

    const review = await request(app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set(auth(ownerToken));
    expect(review.status).toBe(200);
    expect(review.body.data.steps).toHaveLength(1);
    expect(review.body.data.steps[0]).toMatchObject({
      agentName: 'quality_agent',
      status: 'completed', // lowercase wire form
      output: { issues: 3 },
      durationMs: 5400,
    });
  });

  it('awaiting-approval → approve resolves the awakeable and returns approved', async () => {
    const { body } = await trigger();
    const reviewId = body.data.id;

    await request(app.getHttpServer())
      .post(`/internal/reviews/${reviewId}/awaiting-approval`)
      .set('x-internal-secret', INTERNAL_SECRET)
      .send({ awakeableId: 'prom_test_123', summary: '## Review\nLooks good.' })
      .expect(204);

    const awaiting = await request(app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set(auth(ownerToken));
    expect(awaiting.body.data.status).toBe('awaiting_approval');
    expect(awaiting.body.data.resultSummary).toContain('Looks good');

    const approve = await request(app.getHttpServer())
      .post(`/reviews/${reviewId}/approve`)
      .set(auth(ownerToken))
      .send({ comment: 'Ship it' });
    expect(approve.status).toBe(201);
    expect(approve.body.data.status).toBe('approved');
    expect(restate.resolveApproval).toHaveBeenCalledWith('prom_test_123', {
      approved: true,
      comment: 'Ship it',
    });
  });

  it('rejects approval when the review is not awaiting approval (400)', async () => {
    const { body } = await trigger(); // status: running
    const reviewId = body.data.id;

    const res = await request(app.getHttpServer())
      .post(`/reviews/${reviewId}/approve`)
      .set(auth(ownerToken))
      .send({});
    expect(res.status).toBe(400);
    expect(restate.resolveApproval).not.toHaveBeenCalled();
  });
});
