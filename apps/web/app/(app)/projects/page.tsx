"use client";

import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { useProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const { data: projects, isLoading, isError } = useProjects();

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <PageHeader
        title="Projects"
        description="Repositories DevPilot reviews and manages."
        actions={
          <Link href="/projects/new" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="size-4" />
            New project
          </Link>
        }
      />

      <div className="mt-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-32 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-1.5 h-3 w-2/3" />
              </Card>
            ))}
          </div>
        )}

        {isError && (
          <EmptyState
            icon={FolderKanban}
            title="Couldn't load projects"
            description="Check that the API is reachable, or enable mocks."
          />
        )}

        {projects && projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start reviewing PRs with DevPilot."
            action={
              <Link href="/projects/new" className={cn(buttonVariants({ size: "sm" }))}>
                <Plus className="size-4" />
                New project
              </Link>
            }
          />
        )}

        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
