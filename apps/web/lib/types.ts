/**
 * Shared API types for DevPilot. These mirror the NestJS backend contract and
 * are the single source of truth for data shapes across the UI.
 */

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  githubLogin: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  githubRepo: string; // e.g. "owner/repo"
  createdAt: string;
};

export type Member = {
  id: string;
  user: User;
  role: "owner" | "admin" | "member";
};

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
};

export type ReviewStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type AgentName =
  | "fetch_pr"
  | "orchestrator"
  | "quality_agent"
  | "security_agent"
  | "perf_agent"
  | "synthesizer"
  | "human_approval"
  | "post_comment";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type AgentStep = {
  id: string;
  agentName: AgentName;
  status: StepStatus;
  output: Record<string, unknown> | null;
  durationMs: number | null;
  executedAt: string | null;
};

export type ReviewRun = {
  id: string;
  projectId: string;
  prUrl: string;
  status: ReviewStatus;
  steps: AgentStep[];
  resultSummary: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
};

export type SSEEvent =
  | { type: "step_started"; stepName: AgentName }
  | {
      type: "step_completed";
      stepName: AgentName;
      output: Record<string, unknown>;
      durationMs: number;
    }
  | { type: "step_failed"; stepName: AgentName; error: string }
  | { type: "awaiting_approval"; reviewId: string; summary: string }
  | { type: "completed"; reviewId: string }
  | { type: "failed"; reviewId: string; error: string };

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type DigestRun = {
  id: string;
  projectId: string;
  summary: string;
  createdAt: string;
};

// --- Request payloads ---------------------------------------------------

export type CreateProjectInput = {
  name: string;
  description: string;
  githubRepo: string;
};

export type CreateTaskInput = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type TriggerReviewInput = {
  projectId: string;
  prUrl: string;
};

// Ordered list of agents as they appear in the pipeline UI.
export const AGENT_ORDER: AgentName[] = [
  "fetch_pr",
  "orchestrator",
  "quality_agent",
  "security_agent",
  "perf_agent",
  "synthesizer",
  "human_approval",
  "post_comment",
];

// Agents that run concurrently after the orchestrator fans out.
export const PARALLEL_AGENTS: AgentName[] = [
  "quality_agent",
  "security_agent",
  "perf_agent",
];

export const AGENT_LABELS: Record<AgentName, string> = {
  fetch_pr: "Fetch PR",
  orchestrator: "Orchestrator",
  quality_agent: "Quality",
  security_agent: "Security",
  perf_agent: "Performance",
  synthesizer: "Synthesizer",
  human_approval: "Human approval",
  post_comment: "Post comment",
};

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  fetch_pr: "Fetches the PR diff and metadata from GitHub",
  orchestrator: "Routes the diff to the specialist agents",
  quality_agent: "Reviews code quality and maintainability",
  security_agent: "Scans for security vulnerabilities",
  perf_agent: "Looks for performance regressions",
  synthesizer: "Merges agent findings into one review",
  human_approval: "Waits for a human to approve before posting",
  post_comment: "Posts the review comment to the GitHub PR",
};
