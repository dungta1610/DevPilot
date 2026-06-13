import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { relativeTime, shortPrLabel } from "@/lib/format";
import { AGENT_ORDER } from "@/lib/types";
import type { ReviewRun } from "@/lib/types";

export function ReviewRunCard({ review }: { review: ReviewRun }) {
  const completed = review.steps.filter((s) => s.status === "completed").length;
  const total = AGENT_ORDER.length;

  return (
    <Link
      href={`/projects/${review.projectId}/reviews/${review.id}`}
      className="block"
    >
      <Card className="hover:border-foreground/20 gap-2 p-3.5 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <GitPullRequest className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate font-mono text-sm font-medium">
              {shortPrLabel(review.prUrl)}
            </span>
          </div>
          <StatusBadge status={review.status} />
        </div>
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          <span>Started {relativeTime(review.startedAt)}</span>
          <span className="tabular-nums">
            {completed}/{total} steps
          </span>
        </div>
      </Card>
    </Link>
  );
}
