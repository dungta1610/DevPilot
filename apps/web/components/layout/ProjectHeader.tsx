"use client";

import Link from "next/link";
import { ChevronRight, GitBranch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/queries";

export function ProjectHeader({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-6">
      <nav className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5" />
        {project ? (
          <span className="text-foreground font-medium">{project.name}</span>
        ) : (
          <Skeleton className="h-4 w-24" />
        )}
      </nav>
      {project && (
        <a
          href={`https://github.com/${project.githubRepo}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs"
        >
          <GitBranch className="size-3.5" />
          {project.githubRepo}
        </a>
      )}
    </div>
  );
}
