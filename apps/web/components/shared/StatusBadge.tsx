import { cn } from "@/lib/utils";
import type { ReviewStatus, StepStatus } from "@/lib/types";

type AnyStatus = ReviewStatus | StepStatus;

type Config = {
  label: string;
  className: string;
  dot: string;
  pulse?: boolean;
};

const CONFIG: Record<AnyStatus, Config> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  running: {
    label: "Running",
    className: "bg-status-running/15 text-status-running",
    dot: "bg-status-running",
    pulse: true,
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "bg-status-awaiting/20 text-status-awaiting",
    dot: "bg-status-awaiting",
    pulse: true,
  },
  approved: {
    label: "Approved",
    className: "bg-status-success/15 text-status-success",
    dot: "bg-status-success",
  },
  completed: {
    label: "Completed",
    className: "bg-status-success/15 text-status-success",
    dot: "bg-status-success",
  },
  rejected: {
    label: "Rejected",
    className: "bg-status-failed/15 text-status-failed",
    dot: "bg-status-failed",
  },
  failed: {
    label: "Failed",
    className: "bg-status-failed/15 text-status-failed",
    dot: "bg-status-failed",
  },
  skipped: {
    label: "Skipped",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AnyStatus;
  className?: string;
}) {
  const config = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-full px-2 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              config.dot,
            )}
          />
        )}
        <span
          className={cn("relative inline-flex size-1.5 rounded-full", config.dot)}
        />
      </span>
      {config.label}
    </span>
  );
}
