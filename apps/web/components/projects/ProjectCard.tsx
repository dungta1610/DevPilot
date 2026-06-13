import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="hover:border-foreground/20 h-full gap-3 p-4 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="group-hover:text-foreground text-sm font-semibold">
            {project.name}
          </h3>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {project.description || "No description"}
        </p>
        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
          <span className="inline-flex items-center gap-1 truncate font-mono">
            <GitBranch className="size-3.5 shrink-0" />
            {project.githubRepo}
          </span>
          <span className="shrink-0">{relativeTime(project.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
