"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumn } from "@/components/tasks/KanbanColumn";
import { TaskCard } from "@/components/tasks/TaskCard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { useTasks, useUpdateTask, useUsers } from "@/lib/queries";
import type { Task, TaskStatus, User } from "@/lib/types";

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: "backlog", label: "Backlog", accent: "bg-muted-foreground/50" },
  { status: "todo", label: "Todo", accent: "bg-status-running" },
  { status: "in_progress", label: "In progress", accent: "bg-status-awaiting" },
  { status: "done", label: "Done", accent: "bg-status-success" },
];

export function KanbanBoard({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = useTasks(projectId);
  const { data: users } = useUsers();
  const updateTask = useUpdateTask(projectId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const usersById = useMemo(() => {
    const map: Record<string, User> = {};
    for (const u of users ?? []) map[u.id] = u;
    return map;
  }, [users]);

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of tasks ?? []) groups[task.status].push(task);
    return groups;
  }, [tasks]);

  const activeTask = tasks?.find((t) => t.id === activeId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks?.find((t) => t.id === active.id);
    if (task && task.status !== newStatus) {
      updateTask.mutate({ taskId: task.id, input: { status: newStatus } });
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-4 md:p-6">
        {COLUMNS.map((col) => (
          <div key={col.status} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto p-4 md:p-6">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              accent={col.accent}
              count={byStatus[col.status].length}
              onAdd={setCreateStatus}
            >
              {byStatus[col.status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  assignee={
                    task.assigneeId ? usersById[task.assigneeId] : undefined
                  }
                  onOpen={() => setSelectedTask(task)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              assignee={
                activeTask.assigneeId
                  ? usersById[activeTask.assigneeId]
                  : undefined
              }
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <CreateTaskDialog
        projectId={projectId}
        open={createStatus !== null}
        onOpenChange={(open) => !open && setCreateStatus(null)}
        initialStatus={createStatus ?? "backlog"}
      />

      <TaskDetailSheet
        projectId={projectId}
        task={selectedTask}
        open={selectedTask !== null}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      />
    </>
  );
}
