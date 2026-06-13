"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodFormResolver } from "@/lib/zod-resolver";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTriggerReview } from "@/lib/queries";

const schema = z.object({
  prUrl: z
    .string()
    .min(1, "PR URL is required")
    .regex(
      /github\.com\/[^/]+\/[^/]+\/pull\/\d+/,
      "Enter a GitHub PR URL (…/pull/123)",
    ),
});

type FormValues = z.infer<typeof schema>;

export function TriggerReviewForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const trigger = useTriggerReview();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodFormResolver<FormValues>(schema),
    defaultValues: { prUrl: "" },
  });

  const onSubmit = handleSubmit((values) => {
    trigger.mutate(
      { projectId, prUrl: values.prUrl },
      {
        onSuccess: (review) => {
          reset();
          router.push(`/projects/${projectId}/reviews/${review.id}`);
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          {...register("prUrl")}
          placeholder="https://github.com/owner/repo/pull/142"
          className="font-mono"
          aria-invalid={Boolean(errors.prUrl)}
        />
        <Button type="submit" disabled={trigger.isPending} className="shrink-0">
          <Sparkles className="size-4" />
          {trigger.isPending ? "Starting…" : "Review PR"}
        </Button>
      </div>
      {errors.prUrl && (
        <p className="text-destructive text-xs">{errors.prUrl.message}</p>
      )}
    </form>
  );
}
