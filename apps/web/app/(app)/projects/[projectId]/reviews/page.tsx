"use client";

import { useParams } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReviewRunCard } from "@/components/reviews/ReviewRunCard";
import { TriggerReviewForm } from "@/components/reviews/TriggerReviewForm";
import { useReviews } from "@/lib/queries";

export default function ReviewsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: reviews, isLoading } = useReviews(projectId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Reviews"
        description="Durable AI review runs. Trigger one against any open pull request."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trigger a review</CardTitle>
          <CardDescription>
            DevPilot fetches the diff, fans out to specialist agents, and waits
            for your approval before posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerReviewForm projectId={projectId} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}

        {reviews && reviews.length === 0 && (
          <EmptyState
            icon={GitPullRequest}
            title="No reviews yet"
            description="Paste a GitHub PR URL above to start your first review run."
          />
        )}

        {reviews?.map((review) => (
          <ReviewRunCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
