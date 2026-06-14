import axios from "axios";
import type {
  ChatMessage,
  CreateProjectInput,
  CreateTaskInput,
  DigestRun,
  Member,
  Project,
  ReviewRun,
  Task,
  TriggerReviewInput,
  UpdateTaskInput,
  User,
} from "@/lib/types";
import {
  currentUser,
  mockChats,
  mockDigests,
  mockMembers,
  mockProjects,
  mockReviews,
  mockTasks,
  mockUsers,
} from "@/lib/mocks";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const http = axios.create({ baseURL: API_URL, withCredentials: true });

/** Simulated network latency for the mock backend. */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Typed API surface for DevPilot. Every function transparently reads from the
 * in-memory mocks when USE_MOCKS is on, or hits the NestJS backend otherwise.
 */
export const api = {
  // --- Auth ---
  async me(): Promise<User> {
    if (USE_MOCKS) return delay(currentUser, 150);
    const { data } = await http.get<User>("/auth/me");
    return data;
  },

  // --- Projects ---
  async listProjects(): Promise<Project[]> {
    if (USE_MOCKS) return delay([...mockProjects]);
    const { data } = await http.get<Project[]>("/projects");
    return data;
  },

  async getProject(id: string): Promise<Project> {
    if (USE_MOCKS) {
      const found = mockProjects.find((p) => p.id === id);
      if (!found) throw new Error("Project not found");
      return delay(found);
    }
    const { data } = await http.get<Project>(`/projects/${id}`);
    return data;
  },

  async createProject(input: CreateProjectInput): Promise<Project> {
    if (USE_MOCKS) {
      const project: Project = {
        id: uid("p"),
        ...input,
        createdAt: new Date().toISOString(),
      };
      mockProjects.unshift(project);
      mockTasks[project.id] = [];
      mockReviews[project.id] = [];
      mockChats[project.id] = [];
      mockMembers[project.id] = [
        { id: uid("m"), user: currentUser, role: "owner" },
      ];
      return delay(project);
    }
    const { data } = await http.post<Project>("/projects", input);
    return data;
  },

  async listMembers(projectId: string): Promise<Member[]> {
    if (USE_MOCKS) return delay(mockMembers[projectId] ?? []);
    const { data } = await http.get<Member[]>(`/projects/${projectId}/members`);
    return data;
  },

  // --- Tasks ---
  async listTasks(projectId: string): Promise<Task[]> {
    if (USE_MOCKS) return delay([...(mockTasks[projectId] ?? [])]);
    const { data } = await http.get<Task[]>(`/projects/${projectId}/tasks`);
    return data;
  },

  async createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    if (USE_MOCKS) {
      const task: Task = {
        id: uid("t"),
        projectId,
        createdAt: new Date().toISOString(),
        ...input,
      };
      (mockTasks[projectId] ??= []).unshift(task);
      return delay(task);
    }
    const { data } = await http.post<Task>(
      `/projects/${projectId}/tasks`,
      input,
    );
    return data;
  },

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    if (USE_MOCKS) {
      for (const list of Object.values(mockTasks)) {
        const idx = list.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...input };
          return delay(list[idx], 200);
        }
      }
      throw new Error("Task not found");
    }
    const { data } = await http.patch<Task>(`/tasks/${taskId}`, input);
    return data;
  },

  async deleteTask(taskId: string): Promise<void> {
    if (USE_MOCKS) {
      for (const list of Object.values(mockTasks)) {
        const idx = list.findIndex((t) => t.id === taskId);
        if (idx >= 0) list.splice(idx, 1);
      }
      return delay(undefined, 200);
    }
    await http.delete(`/tasks/${taskId}`);
  },

  // --- Reviews ---
  async listReviews(projectId: string): Promise<ReviewRun[]> {
    if (USE_MOCKS) return delay([...(mockReviews[projectId] ?? [])]);
    const { data } = await http.get<ReviewRun[]>(
      `/projects/${projectId}/reviews`,
    );
    return data;
  },

  async getReview(reviewId: string): Promise<ReviewRun> {
    if (USE_MOCKS) {
      const found = findReview(reviewId);
      if (!found) throw new Error("Review not found");
      return delay(found, 200);
    }
    const { data } = await http.get<ReviewRun>(`/reviews/${reviewId}`);
    return data;
  },

  async triggerReview(input: TriggerReviewInput): Promise<ReviewRun> {
    if (USE_MOCKS) {
      const review: ReviewRun = {
        id: uid("r"),
        projectId: input.projectId,
        prUrl: input.prUrl,
        status: "running",
        steps: [],
        resultSummary: null,
        triggeredBy: currentUser.id,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      (mockReviews[input.projectId] ??= []).unshift(review);
      return delay(review, 200);
    }
    const { data } = await http.post<ReviewRun>("/reviews", input);
    return data;
  },

  async approveReview(reviewId: string): Promise<ReviewRun> {
    if (USE_MOCKS) {
      const review = findReview(reviewId);
      if (!review) throw new Error("Review not found");
      review.status = "approved";
      review.completedAt = new Date().toISOString();
      return delay(review, 400);
    }
    const { data } = await http.post<ReviewRun>(`/reviews/${reviewId}/approve`);
    return data;
  },

  async rejectReview(reviewId: string): Promise<ReviewRun> {
    if (USE_MOCKS) {
      const review = findReview(reviewId);
      if (!review) throw new Error("Review not found");
      review.status = "rejected";
      review.completedAt = new Date().toISOString();
      return delay(review, 400);
    }
    const { data } = await http.post<ReviewRun>(`/reviews/${reviewId}/reject`);
    return data;
  },

  async cancelReview(reviewId: string): Promise<ReviewRun> {
    if (USE_MOCKS) {
      const review = findReview(reviewId);
      if (!review) throw new Error("Review not found");
      review.status = "rejected";
      review.completedAt = new Date().toISOString();
      return delay(review, 400);
    }
    const { data } = await http.post<ReviewRun>(`/reviews/${reviewId}/cancel`);
    return data;
  },

  // --- Assistant chat ---
  async chatHistory(projectId: string): Promise<ChatMessage[]> {
    if (USE_MOCKS) return delay([...(mockChats[projectId] ?? [])], 200);
    const { data } = await http.get<ChatMessage[]>(
      `/projects/${projectId}/chat/history`,
    );
    return data;
  },

  async sendChat(projectId: string, content: string): Promise<ChatMessage> {
    if (USE_MOCKS) {
      const list = (mockChats[projectId] ??= []);
      list.push({
        id: uid("c"),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      });
      const reply: ChatMessage = {
        id: uid("c"),
        role: "assistant",
        content: mockAssistantReply(content),
        createdAt: new Date().toISOString(),
      };
      list.push(reply);
      return delay(reply, 600);
    }
    const { data } = await http.post<ChatMessage>(
      `/projects/${projectId}/chat`,
      { content },
    );
    return data;
  },

  // --- Digests ---
  async listDigests(projectId: string): Promise<DigestRun[]> {
    if (USE_MOCKS) return delay(mockDigests[projectId] ?? []);
    const { data } = await http.get<DigestRun[]>(
      `/projects/${projectId}/digests`,
    );
    return data;
  },

  // --- Users (assignee lookups) ---
  async listUsers(): Promise<User[]> {
    if (USE_MOCKS) return delay([...mockUsers], 100);
    const { data } = await http.get<User[]>("/users");
    return data;
  },
};

function findReview(reviewId: string): ReviewRun | undefined {
  for (const list of Object.values(mockReviews)) {
    const found = list.find((r) => r.id === reviewId);
    if (found) return found;
  }
  return undefined;
}

function mockAssistantReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("sprint") || p.includes("focus") || p.includes("next")) {
    return "Based on this project, I'd prioritize the urgent tasks and clear any review that's awaiting approval — those block merges. Want me to draft a sprint plan from the current backlog?";
  }
  if (p.includes("security")) {
    return "The security agent has flagged 1 high-severity issue in the most recent reviews (a missing webhook signature check). I'd treat that as a release blocker.";
  }
  if (p.includes("quality") || p.includes("trend")) {
    return "Quality findings have been trending down over the last 3 reviews — mostly long-function and missing-test warnings. Nothing critical right now.";
  }
  return "Here's what I found across this project's tasks, reviews, and recent activity. Ask me about sprint planning, code-quality trends, security findings, or what to work on next.";
}
