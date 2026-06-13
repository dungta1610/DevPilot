import { ArrowDown, ArrowUp, ChevronsUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types";

const CONFIG: Record<
  TaskPriority,
  { label: string; className: string; icon: typeof Minus }
> = {
  low: {
    label: "Low",
    className: "text-muted-foreground",
    icon: ArrowDown,
  },
  medium: {
    label: "Medium",
    className: "text-status-running",
    icon: Minus,
  },
  high: {
    label: "High",
    className: "text-status-awaiting",
    icon: ArrowUp,
  },
  urgent: {
    label: "Urgent",
    className: "text-status-failed",
    icon: ChevronsUp,
  },
};

export function PriorityBadge({
  priority,
  showLabel = false,
  className,
}: {
  priority: TaskPriority;
  showLabel?: boolean;
  className?: string;
}) {
  const config = CONFIG[priority];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        config.className,
        className,
      )}
      title={`${config.label} priority`}
    >
      <Icon className="size-3.5" />
      {showLabel && config.label}
    </span>
  );
}
