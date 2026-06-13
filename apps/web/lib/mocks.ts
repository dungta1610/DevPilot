import type {
  AgentStep,
  ChatMessage,
  DigestRun,
  Member,
  Project,
  ReviewRun,
  Task,
  User,
} from "@/lib/types";

/**
 * Realistic in-memory mock data used when NEXT_PUBLIC_USE_MOCKS=true.
 * The objects are mutated in place by lib/api.ts so the UI behaves like a
 * real (if non-persistent) backend during development.
 */

// Declared before mockReviews because that initializer (via completedReview)
// reads it at module-eval time — keeping it here avoids a TDZ error.
const SAMPLE_SUMMARY = `## Review summary

**Quality** — 3 issues found
- \`charge.service.ts\`: \`processCharge\` is 140 lines; extract the retry/backoff branch.
- Missing unit tests for the new \`refundCharge\` path.
- \`any\` used in the webhook handler payload — type it against the Stripe event union.

**Security** — 1 high severity
- The webhook endpoint does not verify the Stripe signature before parsing the body. An attacker could forge events. Verify \`stripe-signature\` with the endpoint secret first.

**Performance** — 2 warnings
- N+1 query loading line items per invoice in \`InvoiceRepository.findWithItems\`.
- Synchronous PDF render on the request thread; move to a background job.

**Verdict:** Approve after the signature verification fix lands, or request changes.`;

export const mockUsers: User[] = [
  {
    id: "u_1",
    name: "Dung Ta",
    email: "dungta386469@gmail.com",
    avatarUrl: null,
    githubLogin: "dungta",
  },
  {
    id: "u_2",
    name: "Maya Chen",
    email: "maya@devpilot.dev",
    avatarUrl: null,
    githubLogin: "mayac",
  },
  {
    id: "u_3",
    name: "Leo Park",
    email: "leo@devpilot.dev",
    avatarUrl: null,
    githubLogin: "leopark",
  },
];

export const currentUser: User = mockUsers[0];

export const mockProjects: Project[] = [
  {
    id: "p_1",
    name: "Payments API",
    description:
      "Core billing and subscription service. Stripe integration, invoicing, webhooks.",
    githubRepo: "devpilot/payments-api",
    createdAt: daysAgo(48),
  },
  {
    id: "p_2",
    name: "Web Dashboard",
    description: "Customer-facing Next.js dashboard and admin console.",
    githubRepo: "devpilot/web-dashboard",
    createdAt: daysAgo(31),
  },
  {
    id: "p_3",
    name: "Agent Runtime",
    description:
      "Restate + LangGraph orchestration layer that powers DevPilot reviews.",
    githubRepo: "devpilot/agent-runtime",
    createdAt: daysAgo(12),
  },
];

export const mockMembers: Record<string, Member[]> = {
  p_1: [
    { id: "m_1", user: mockUsers[0], role: "owner" },
    { id: "m_2", user: mockUsers[1], role: "admin" },
    { id: "m_3", user: mockUsers[2], role: "member" },
  ],
  p_2: [
    { id: "m_4", user: mockUsers[0], role: "owner" },
    { id: "m_5", user: mockUsers[1], role: "member" },
  ],
  p_3: [{ id: "m_6", user: mockUsers[0], role: "owner" }],
};

export const mockTasks: Record<string, Task[]> = {
  p_1: [
    task("t_1", "p_1", "Handle Stripe webhook retries", "in_progress", "high", "u_1", daysAgo(-2)),
    task("t_2", "p_1", "Idempotency keys for charge endpoint", "todo", "urgent", "u_2", daysAgo(-1)),
    task("t_3", "p_1", "Migrate invoices table to UUID v7", "backlog", "medium", null, null),
    task("t_4", "p_1", "Add dunning email flow", "backlog", "low", "u_3", null),
    task("t_5", "p_1", "Rate limit the refund endpoint", "in_progress", "high", "u_1", daysAgo(-4)),
    task("t_6", "p_1", "Audit log for billing changes", "done", "medium", "u_2", daysAgo(3)),
    task("t_7", "p_1", "Backfill subscription periods", "done", "low", "u_1", daysAgo(6)),
  ],
  p_2: [
    task("t_8", "p_2", "Dark mode polish on settings", "todo", "low", "u_1", null),
    task("t_9", "p_2", "Virtualize the activity feed", "backlog", "medium", null, null),
    task("t_10", "p_2", "Fix flaky auth redirect", "in_progress", "urgent", "u_2", daysAgo(-1)),
    task("t_11", "p_2", "Ship usage charts", "done", "high", "u_1", daysAgo(2)),
  ],
  p_3: [
    task("t_12", "p_3", "Durable retry for post_comment step", "in_progress", "urgent", "u_1", daysAgo(-1)),
    task("t_13", "p_3", "Awakeable timeout for human approval", "todo", "high", "u_1", daysAgo(-5)),
    task("t_14", "p_3", "Parallelize specialist agents", "done", "high", "u_1", daysAgo(1)),
  ],
};

export const mockReviews: Record<string, ReviewRun[]> = {
  p_1: [
    completedReview("r_1", "p_1", 142, "approved", daysAgo(1)),
    completedReview("r_2", "p_1", 138, "rejected", daysAgo(3)),
    awaitingReview("r_3", "p_1", 145),
  ],
  p_2: [completedReview("r_4", "p_2", 88, "approved", daysAgo(2))],
  p_3: [completedReview("r_5", "p_3", 30, "completed", daysAgo(4))],
};

export const mockChats: Record<string, ChatMessage[]> = {
  p_1: [
    {
      id: "c_1",
      role: "user",
      content: "What should I focus on this sprint?",
      createdAt: daysAgo(0.05),
    },
    {
      id: "c_2",
      role: "assistant",
      content:
        "You have two urgent items: idempotency keys for the charge endpoint (t_2) and the open review on PR #145 that's awaiting your approval. I'd clear the review first since it's blocking a merge, then pick up the idempotency work.",
      createdAt: daysAgo(0.04),
    },
  ],
  p_2: [],
  p_3: [],
};

export const mockDigests: Record<string, DigestRun[]> = {
  p_1: [
    {
      id: "d_1",
      projectId: "p_1",
      summary:
        "3 PRs merged, 1 awaiting approval. Security agent flagged 1 high-severity issue this week.",
      createdAt: daysAgo(1),
    },
  ],
  p_2: [],
  p_3: [],
};

// --- helpers ------------------------------------------------------------

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function task(
  id: string,
  projectId: string,
  title: string,
  status: Task["status"],
  priority: Task["priority"],
  assigneeId: string | null,
  dueDate: string | null,
): Task {
  return {
    id,
    projectId,
    title,
    description: "",
    status,
    priority,
    assigneeId,
    dueDate,
    createdAt: daysAgo(10),
  };
}

function steps(prNumber: number): AgentStep[] {
  const lines = 600 + prNumber * 3;
  return [
    step("s1", "fetch_pr", "completed", 234, { lines, files: 12 }),
    step("s2", "orchestrator", "completed", 1180, { routedTo: 3 }),
    step("s3", "quality_agent", "completed", 8420, { issues: 3 }),
    step("s4", "security_agent", "completed", 9610, { high: 1, medium: 2 }),
    step("s5", "perf_agent", "completed", 7300, { warnings: 2 }),
    step("s6", "synthesizer", "completed", 2100, { sections: 3 }),
    step("s7", "human_approval", "completed", null, null),
    step("s8", "post_comment", "completed", 540, { commentId: 998877 }),
  ];
}

function step(
  id: string,
  agentName: AgentStep["agentName"],
  status: AgentStep["status"],
  durationMs: number | null,
  output: Record<string, unknown> | null,
): AgentStep {
  return {
    id,
    agentName,
    status,
    output,
    durationMs,
    executedAt: status === "completed" ? daysAgo(1) : null,
  };
}

function completedReview(
  id: string,
  projectId: string,
  prNumber: number,
  status: ReviewRun["status"],
  when: string,
): ReviewRun {
  return {
    id,
    projectId,
    prUrl: `https://github.com/${
      mockProjects.find((p) => p.id === projectId)?.githubRepo ?? "owner/repo"
    }/pull/${prNumber}`,
    status,
    steps: steps(prNumber),
    resultSummary: SAMPLE_SUMMARY,
    triggeredBy: "u_1",
    startedAt: when,
    completedAt: when,
  };
}

function awaitingReview(
  id: string,
  projectId: string,
  prNumber: number,
): ReviewRun {
  const allSteps = steps(prNumber).map((s) =>
    s.agentName === "human_approval"
      ? { ...s, status: "running" as const }
      : s.agentName === "post_comment"
        ? { ...s, status: "pending" as const, executedAt: null }
        : s,
  );
  return {
    id,
    projectId,
    prUrl: `https://github.com/${
      mockProjects.find((p) => p.id === projectId)?.githubRepo ?? "owner/repo"
    }/pull/${prNumber}`,
    status: "awaiting_approval",
    steps: allSteps,
    resultSummary: SAMPLE_SUMMARY,
    triggeredBy: "u_1",
    startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    completedAt: null,
  };
}
