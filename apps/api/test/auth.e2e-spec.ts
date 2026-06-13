import request from 'supertest';
import { User } from '@prisma/client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.app.close();
  });

  it('GET /auth/me returns 401 without a token', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /auth/me returns the user with a valid token', async () => {
    const user: User = await seedUser(ctx.prisma, {
      email: 'me@example.com',
      name: 'Me',
    });
    const token = tokenFor(ctx.jwt, user);

    const res = await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: user.id,
      email: 'me@example.com',
      name: 'Me',
      githubId: user.githubId,
    });
  });
});
