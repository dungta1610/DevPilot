"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodFormResolver } from "@/lib/zod-resolver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(60, "Keep it under 60 chars"),
  description: z.string().max(280, "Keep it under 280 chars"),
  githubRepo: z
    .string()
    .min(1, "Repository is required")
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Use "owner/repo" format'),
});

type FormValues = z.infer<typeof schema>;

export function CreateProjectForm() {
  const router = useRouter();
  const createProject = useCreateProject();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodFormResolver<FormValues>(schema),
    defaultValues: { name: "", description: "", githubRepo: "" },
  });

  const onSubmit = handleSubmit((values) => {
    createProject.mutate(values, {
      onSuccess: (project) => router.push(`/projects/${project.id}`),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Project name" error={errors.name?.message}>
        <Input
          {...register("name")}
          placeholder="Payments API"
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <Field
        label="GitHub repository"
        error={errors.githubRepo?.message}
        hint="The repo DevPilot will review PRs against."
      >
        <Input
          {...register("githubRepo")}
          placeholder="owner/repo"
          className="font-mono"
          aria-invalid={Boolean(errors.githubRepo)}
        />
      </Field>

      <Field label="Description" error={errors.description?.message}>
        <Textarea
          {...register("description")}
          placeholder="What does this service do?"
          rows={3}
          aria-invalid={Boolean(errors.description)}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={createProject.isPending}>
          {createProject.isPending ? "Creating…" : "Create project"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={createProject.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={cn(error && "text-destructive")}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-muted-foreground text-xs">{hint}</p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
