import request from 'supertest';
import { Project, ProjectRole, User } from '@prisma/client';
import { AssistantMessage, RestateClient } from '../src/agent/restate.client';
import {
  createTestApp,
  resetDb,
  seedUser,
  tokenFor,
  TestContext,
} from './test-utils';

/**
 * The assistant now lives in a Restate Virtual Object, so this suite stubs the
 * ingress client with an in-memory object that mimics the K/V history. We verify
 * the NestJS adapter: member-guarded routes, the request/response mapping, and
 * that the user id + message are forwarded to the object's `chat` handler.
 */
describe('Chat / project assistant (e2e)', () => {
  let ctx: TestContext;
  let owner: User;
  let ownerToken: string;
  let project: Project;

  // In-memory stand-in for the ProjectAssistant Virtual Object K/V store.
  const histories = new Map<string, AssistantMessage[]>();

  const restate: Partial<RestateClient> = {
    chat: jest.fn(async (projectId: string, input: { message: string }) => {
      const reply: AssistantMessage = {
        role: 'assistant',
        content: `You said: ${input.message}`,
        timestamp: new Date().toISOString(),
      };
      const prior = histories.get(projectId) ?? [];
      histories.set(projectId, [
        ...prior,
        {
          role: 'user',
          content: input.message,
          timestamp: new Date().toISOString(),
        },
        reply,
      ]);
      return reply;
    }),
    getAssistantHistory: jest.fn(
      async (projectId: string) => histories.get(projectId) ?? [],
    ),
    clearAssistantHistory: jest.fn(async (projectId: string) => {
      histories.delete(projectId);
    }),
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: RestateClient, useValue: restate }]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    histories.clear();
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

  it('POST /projects/:id/chat returns the assistant reply and forwards the user id', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: 'What should I focus on?' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: 'assistant' });
    expect(res.body.data.content).toContain('What should I focus on?');
    expect(restate.chat).toHaveBeenCalledWith(project.id, {
      message: 'What should I focus on?',
      userId: owner.id,
    });
  });

  it('GET /projects/:id/chat/history maps stored turns oldest-first', async () => {
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
    expect(res.body.data[0].id).toBeTruthy();
  });

  it('DELETE /projects/:id/chat/history clears the conversation', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: 'Hello' });

    const cleared = await request(ctx.app.getHttpServer())
      .delete(`/projects/${project.id}/chat/history`)
      .set(auth(ownerToken));
    expect(cleared.status).toBe(204);
    expect(restate.clearAssistantHistory).toHaveBeenCalledWith(project.id);

    const after = await request(ctx.app.getHttpServer())
      .get(`/projects/${project.id}/chat/history`)
      .set(auth(ownerToken));
    expect(after.body.data).toHaveLength(0);
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
    expect(restate.chat).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/projects/${project.id}/chat`)
      .set(auth(ownerToken))
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});
