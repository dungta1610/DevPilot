"use client";

import { Check, X } from "lucide-react";
import { GitHubIcon } from "@/components/shared/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useApproveReview, useRejectReview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ApprovalPanel({ reviewId }: { reviewId: string }) {
  const approve = useApproveReview(reviewId);
  const reject = useRejectReview(reviewId);
  const pending = approve.isPending || reject.isPending;

  return (
    <div className="border-status-awaiting/40 bg-status-awaiting/5 rounded-lg border p-4">
      <p className="text-sm font-medium">Post this review to GitHub?</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Approving resolves the agent&apos;s pending step and posts the
        synthesized review as a comment on the pull request. Rejecting discards
        it — nothing is posted.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button disabled={pending}>
                <Check className="size-4" />
                Approve &amp; post
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <GitHubIcon className="size-4" />
                Post review to GitHub
              </AlertDialogTitle>
              <AlertDialogDescription>
                This posts the full synthesized review as a comment on the pull
                request. The agent run will then complete.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => approve.mutate()}>
                Approve &amp; post
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" disabled={pending}>
                <X className="size-4" />
                Reject
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this review?</AlertDialogTitle>
              <AlertDialogDescription>
                The review will be discarded and nothing will be posted to
                GitHub. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "destructive" }))}
                onClick={() => reject.mutate()}
              >
                Reject review
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
