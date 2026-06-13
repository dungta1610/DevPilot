"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, GitPullRequest, ListTodo, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { useMembers, useReviews, useTasks } from "@/lib/queries";
import { relativeTime, shortPrLabel } from "@/lib/format";

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: tasks } = useTasks(projectId);
  const { data: reviews } = useReviews(projectId);
  const { data: members } = useMembers(projectId);

  const openTasks =
    tasks?.filter((t) => t.status !== "done").length ?? undefined;
  const doneTasks = tasks?.filter((t) => t.status === "done").length ?? undefined;
  const openReviews =
    reviews?.filter((r) =>
      ["pending", "running", "awaiting_approval"].includes(r.status),
    ).length ?? undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListTodo} label="Open tasks" value={openTasks} />
        <Stat icon={CheckCircle2} label="Completed" value={doneTasks} />
        <Stat icon={GitPullRequest} label="Active reviews" value={openReviews} />
        <Stat icon={Users} label="Members" value={members?.length} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent reviews</CardTitle>
          <Link
            href={`/projects/${projectId}/reviews`}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {!reviews && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {reviews && reviews.length === 0 && (
            <EmptyState
              icon={GitPullRequest}
              title="No reviews yet"
              description="Trigger a review from the Reviews tab to see agent activity here."
            />
          )}
          {reviews && reviews.length > 0 && (
            <ul className="divide-y">
              {reviews.slice(0, 5).map((review) => (
                <li key={review.id}>
                  <Link
                    href={`/projects/${projectId}/reviews/${review.id}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <GitPullRequest className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate font-mono text-sm">
                        {shortPrLabel(review.prUrl)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-muted-foreground hidden text-xs sm:inline">
                        {relativeTime(review.startedAt)}
                      </span>
                      <StatusBadge status={review.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Team</CardTitle>
        </CardHeader>
        <CardContent>
          {!members && <Skeleton className="h-8 w-40" />}
          {members && (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <UserAvatar user={member.user} withTooltip={false} />
                  <span className="text-sm font-medium">{member.user.name}</span>
                  <span className="text-muted-foreground text-xs capitalize">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number | undefined;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5" />
        {label}
      </div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-10" />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      )}
    </Card>
  );
}
