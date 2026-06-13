"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

export function KanbanColumn({
  status,
  label,
  count,
  accent,
  onAdd,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  accent: string;
  onAdd: (status: TaskStatus) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", accent)} />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {count}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(status)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Add task to ${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "bg-muted/40 flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors",
          isOver && "bg-muted ring-2 ring-ring/40 ring-inset",
        )}
      >
        {children}
      </div>
    </div>
  );
}
