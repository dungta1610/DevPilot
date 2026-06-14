"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  CreateProjectInput,
  CreateTaskInput,
  Task,
  TriggerReviewInput,
  UpdateTaskInput,
} from "@/lib/types";

/** Centralized query keys so cache updates stay consistent across the app. */
export const queryKeys = {
  me: ["me"] as const,
  users: ["users"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  members: (id: string) => ["members", id] as const,
  tasks: (projectId: string) => ["tasks", projectId] as const,
  reviews: (projectId: string) => ["reviews", projectId] as const,
  review: (reviewId: string) => ["review", reviewId] as const,
  chat: (projectId: string) => ["chat", projectId] as const,
  digests: (projectId: string) => ["digests", projectId] as const,
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: api.listUsers });
}

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.getProject(id),
    enabled: Boolean(id),
  });
}

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: queryKeys.members(projectId),
    queryFn: () => api.listMembers(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      toast.success("Project created");
    },
    onError: () => toast.error("Failed to create project"),
  });
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks(projectId),
    queryFn: () => api.listTasks(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(projectId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      api.updateTask(taskId, input),
    // Optimistic update so the kanban board feels instant on drag.
    onMutate: async ({ taskId, input }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks(projectId) });
      const previous = qc.getQueryData<Task[]>(queryKeys.tasks(projectId));
      qc.setQueryData<Task[]>(queryKeys.tasks(projectId), (old) =>
        (old ?? []).map((t) => (t.id === taskId ? { ...t, ...input } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.tasks(projectId), context.previous);
      }
      toast.error("Failed to update task");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.deleteTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });
}

export function useReviews(projectId: string) {
  return useQuery({
    queryKey: queryKeys.reviews(projectId),
    queryFn: () => api.listReviews(projectId),
    enabled: Boolean(projectId),
  });
}

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: queryKeys.review(reviewId),
    queryFn: () => api.getReview(reviewId),
    enabled: Boolean(reviewId),
  });
}

export function useTriggerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerReviewInput) => api.triggerReview(input),
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: queryKeys.reviews(review.projectId) });
    },
    onError: () => toast.error("Failed to trigger review"),
  });
}

export function useApproveReview(reviewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.approveReview(reviewId),
    onSuccess: (review) => {
      qc.setQueryData(queryKeys.review(reviewId), review);
      qc.invalidateQueries({ queryKey: queryKeys.reviews(review.projectId) });
      toast.success("Review approved — posting comment to GitHub");
    },
    onError: () => toast.error("Failed to approve review"),
  });
}

export function useRejectReview(reviewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.rejectReview(reviewId),
    onSuccess: (review) => {
      qc.setQueryData(queryKeys.review(reviewId), review);
      qc.invalidateQueries({ queryKey: queryKeys.reviews(review.projectId) });
      toast.success("Review rejected — nothing was posted to GitHub");
    },
    onError: () => toast.error("Failed to reject review"),
  });
}

export function useCancelReview(reviewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelReview(reviewId),
    onSuccess: (review) => {
      qc.setQueryData(queryKeys.review(reviewId), review);
      qc.invalidateQueries({ queryKey: queryKeys.reviews(review.projectId) });
      toast.success("Review cancelled");
    },
    onError: () => toast.error("Failed to cancel review"),
  });
}

export function useChatHistory(projectId: string) {
  return useQuery({
    queryKey: queryKeys.chat(projectId),
    queryFn: () => api.chatHistory(projectId),
    enabled: Boolean(projectId),
  });
}

export function useDigests(projectId: string) {
  return useQuery({
    queryKey: queryKeys.digests(projectId),
    queryFn: () => api.listDigests(projectId),
    enabled: Boolean(projectId),
  });
}
