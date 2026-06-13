"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "tasks", label: "Tasks" },
  { segment: "reviews", label: "Reviews" },
  { segment: "assistant", label: "Assistant" },
  { segment: "settings", label: "Settings" },
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="flex h-11 items-center gap-1 overflow-x-auto px-4 md:px-6">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active =
          tab.segment === ""
            ? pathname === base
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "relative flex h-11 items-center px-2.5 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {active && (
              <span className="bg-foreground absolute inset-x-2.5 -bottom-px h-0.5 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
