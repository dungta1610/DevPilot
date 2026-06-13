"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn } from "@/lib/utils";
import { formatDate, isPast } from "@/lib/format";
import type { Task, User } from "@/lib/types";

export function TaskCard({
  task,
  assignee,
  onOpen,
  overlay = false,
}: {
  task: Task;
  assignee?: User;
  onOpen?: (taskId: string) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });

  const overdue =
    task.dueDate && task.status !== "done" && isPast(task.dueDate);

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={() => onOpen?.(task.id)}
      className={cn(
        "cursor-grab gap-2 rounded-md p-2.5 shadow-none active:cursor-grabbing",
        "hover:border-foreground/20 transition-colors",
        isDragging && "opacity-40",
        overlay && "w-64 cursor-grabbing rotate-3 shadow-lg",
      )}
    >
      <p className="text-sm leading-snug font-medium">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {task.dueDate && (
            <span
              className={cn(
                "text-muted-foreground inline-flex items-center gap-1 text-xs",
                overdue && "text-status-failed",
              )}
            >
              <CalendarClock className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        {assignee && <UserAvatar user={assignee} className="size-5" />}
      </div>
    </Card>
  );
}
