import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getInternal } from '../../lib/internal-api';

/**
 * Tools the project-assistant agent can call to ground its answers in real
 * project data. Each factory binds `projectId` in a closure so the LLM never
 * has to supply (or could spoof) the project scope — it only chooses filters.
 *
 * Tools return JSON strings; the ReAct agent feeds them back to Gemini as tool
 * messages on the next turn.
 */

export function getTasksTool(projectId: string) {
  return tool(
    async ({ status, priority }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const data = await getInternal(
        `/internal/projects/${projectId}/tasks?${params.toString()}`,
      );
      return JSON.stringify(data);
    },
    {
      name: 'get_tasks',
      description:
        'Get tasks for this project. Optionally filter by status (BACKLOG, TODO, IN_PROGRESS, DONE) or priority (LOW, MEDIUM, HIGH, URGENT). Returns task titles, status, priority, assignee, and due dates.',
      schema: z.object({
        status: z
          .enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'])
          .optional()
          .describe('Filter by task status'),
        priority: z
          .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
          .optional()
          .describe('Filter by priority'),
      }),
    },
  );
}

export function getReviewsTool(projectId: string) {
  return tool(
    async ({ limit }) => {
      const data = await getInternal(
        `/internal/projects/${projectId}/reviews?limit=${limit ?? 10}`,
      );
      return JSON.stringify(data);
    },
    {
      name: 'get_reviews',
      description:
        'Get recent AI code-review runs for this project, including PR URL, status, result summary, and per-agent steps (quality, security, performance).',
      schema: z.object({
        limit: z
          .number()
          .optional()
          .describe('How many recent reviews to fetch (default 10)'),
      }),
    },
  );
}

export function getStatsTool(projectId: string) {
  return tool(
    async () => {
      const data = await getInternal(
        `/internal/projects/${projectId}/stats`,
      );
      return JSON.stringify(data);
    },
    {
      name: 'get_stats',
      description:
        'Get project statistics: task counts by status and priority, number of overdue tasks, reviews completed this week, and tasks completed this week.',
      schema: z.object({}),
    },
  );
}
