"use client";

import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";

export default function TasksPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 md:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Drag cards between columns to update status. Click a card to edit.
        </p>
      </div>
      <div className="flex-1">
        <KanbanBoard projectId={projectId} />
      </div>
    </div>
  );
}
