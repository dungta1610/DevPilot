"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Bot,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/lib/queries";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: projects, isLoading } = useProjects();

  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <Bot className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">DevPilot</span>
      </div>

      <nav className="px-3 pt-1">
        <Link
          href="/projects"
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium",
            pathname === "/projects"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <FolderKanban className="size-4" />
          Projects
        </Link>
      </nav>

      <div className="mt-4 flex items-center justify-between px-4">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Your projects
        </span>
        <Link
          href="/projects/new"
          className="text-muted-foreground hover:text-foreground"
          aria-label="New project"
        >
          <Plus className="size-4" />
        </Link>
      </div>

      <ScrollArea className="mt-1 flex-1 px-3">
        <div className="flex flex-col gap-0.5 pb-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          {projects?.map((project) => {
            const href = `/projects/${project.id}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={project.id}
                href={href}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-sm",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <CircleDot className="size-3.5 shrink-0 opacity-60" />
                <span className="truncate">{project.name}</span>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3">
        <Link
          href="/projects/new"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
        >
          <Plus className="size-4" />
          New project
        </Link>
      </div>
    </aside>
  );
}
