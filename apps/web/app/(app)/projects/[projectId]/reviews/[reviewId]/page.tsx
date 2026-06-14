"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AgentPipeline } from "@/components/reviews/AgentPipeline";
import { ApprovalPanel } from "@/components/reviews/ApprovalPanel";
import { ReviewResult } from "@/components/reviews/ReviewResult";
import { useCancelReview, useReview } from "@/lib/queries";
import { useReviewStream } from "@/lib/use-review-stream";
import { relativeTime, shortPrLabel } from "@/lib/format";
import { AGENT_LABELS, type ReviewRun } from "@/lib/types";

export default function ReviewDetailPage() {
  const { projectId, reviewId } = useParams<{
    projectId: string;
    reviewId: string;
  }>();
  const { data: review, isLoading, isError } = useReview(reviewId);

  const isRunning =
    review?.status === "running" || review?.status === "pending";
  useReviewStream(reviewId, Boolean(isRunning));

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <EmptyState
          title="Review not found"
          description="It may have been removed, or the link is incorrect."
          action={
            <Link
              href={`/projects/${projectId}/reviews`}
              className="text-sm underline"
            >
              Back to reviews
            </Link>
          }
        />
      </div>
    );
  }

  const awaiting = review.status === "awaiting_approval";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <Link
        href={`/projects/${projectId}/reviews`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Reviews
      </Link>

      <ReviewHeader review={review} isRunning={Boolean(isRunning)} />

      {awaiting && (
        <div className="border-status-awaiting/40 bg-status-awaiting/10 flex items-center gap-2 rounded-lg border px-4 py-3">
          <AlertTriangle className="text-status-awaiting size-4 shrink-0" />
          <p className="text-sm font-medium">
            Awaiting your approval before posting to GitHub.
          </p>
        </div>
      )}

      {isRunning ? (
        <div className="space-y-4">
          <PipelineCard review={review} />
          <LiveLog review={review} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <PipelineCard review={review} />
          <div className="space-y-4">
            <ResultBanner review={review} />
            {review.resultSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Review summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReviewResult summary={review.resultSummary} />
                </CardContent>
              </Card>
            )}
            {awaiting && <ApprovalPanel reviewId={review.id} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewHeader({
  review,
  isRunning,
}: {
  review: ReviewRun;
  isRunning: boolean;
}) {
  const cancel = useCancelReview(review.id);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <a
            href={review.prUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground inline-flex items-center gap-1.5 font-mono text-base font-semibold"
          >
            {shortPrLabel(review.prUrl)}
            <ExternalLink className="text-muted-foreground size-3.5" />
          </a>
          <StatusBadge status={review.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {isRunning ? "Running · " : ""}
          Started {relativeTime(review.startedAt)}
          {review.completedAt && ` · finished ${relativeTime(review.completedAt)}`}
        </p>
      </div>
      {isRunning && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          Cancel run
        </Button>
      )}
    </div>
  );
}

function PipelineCard({ review }: { review: ReviewRun }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Agent pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <AgentPipeline review={review} />
      </CardContent>
    </Card>
  );
}

function ResultBanner({ review }: { review: ReviewRun }) {
  if (review.status === "approved" || review.status === "completed") {
    return (
      <div className="border-status-success/40 bg-status-success/10 flex items-start gap-2 rounded-lg border px-4 py-3">
        <CheckCircle2 className="text-status-success mt-0.5 size-4 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Review posted to GitHub</p>
          <a
            href={review.prUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View the comment on the PR
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    );
  }
  if (review.status === "rejected" || review.status === "failed") {
    return (
      <div className="border-status-failed/40 bg-status-failed/10 flex items-start gap-2 rounded-lg border px-4 py-3">
        <XCircle className="text-status-failed mt-0.5 size-4 shrink-0" />
        <p className="text-sm font-medium">
          {review.status === "rejected"
            ? "Review rejected — nothing was posted to GitHub."
            : "The review run failed."}
        </p>
      </div>
    );
  }
  return null;
}

/** Terminal-style log derived from the current step states. */
function LiveLog({ review }: { review: ReviewRun }) {
  const lines = review.steps
    .filter((s) => s.status !== "pending")
    .map((s) => {
      const time = s.executedAt
        ? new Date(s.executedAt).toLocaleTimeString()
        : new Date().toLocaleTimeString();
      const verb =
        s.status === "running"
          ? "started"
          : s.status === "completed"
            ? "completed"
            : s.status;
      return { id: s.id, time, label: AGENT_LABELS[s.agentName], verb };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Loader2 className="text-status-running size-3.5 animate-spin" />
          Live activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/40 scrollbar-thin max-h-56 overflow-y-auto rounded-md p-3 font-mono text-xs">
          {lines.length === 0 ? (
            <p className="text-muted-foreground">Waiting for the agent to start…</p>
          ) : (
            lines.map((line) => (
              <div key={`${line.id}-${line.verb}`} className="flex gap-2">
                <span className="text-muted-foreground/70 shrink-0">
                  {line.time}
                </span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">{line.label}</span>{" "}
                  {line.verb}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
