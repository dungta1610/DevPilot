"use client";

import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodFormResolver } from "@/lib/zod-resolver";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteTask, useUpdateTask, useUsers } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const UNASSIGNED = "unassigned";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  description: z.string().max(2000),
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigneeId: z.string(),
  dueDate: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function TaskDetailSheet({
  projectId,
  task,
  open,
  onOpenChange,
}: {
  projectId: string;
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const { data: users } = useUsers();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodFormResolver<FormValues>(schema),
    values: task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId ?? UNASSIGNED,
          dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        }
      : undefined,
  });

  if (!task) return null;

  const onSubmit = handleSubmit((values) => {
    updateTask.mutate(
      {
        taskId: task.id,
        input: {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          assigneeId:
            values.assigneeId === UNASSIGNED ? null : values.assigneeId,
          dueDate: values.dueDate
            ? new Date(values.dueDate).toISOString()
            : null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Task details</SheetTitle>
          <SheetDescription>
            Created {relativeTime(task.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input {...register("title")} aria-invalid={Boolean(errors.title)} />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea {...register("description")} rows={5} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Status"
              name="status"
              control={control}
              options={STATUS_LABELS}
            />
            <SelectField
              label="Priority"
              name="priority"
              control={control}
              options={PRIORITY_LABELS}
            />
            <div className="flex flex-col gap-1.5">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Due date</Label>
              <Input type="date" {...register("dueDate")} />
            </div>
          </div>
        </form>

        <SheetFooter className="flex-row items-center justify-between border-t">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &ldquo;{task.title}&rdquo;. This
                  can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(buttonVariants({ variant: "destructive" }))}
                  onClick={() =>
                    deleteTask.mutate(task.id, {
                      onSuccess: () => onOpenChange(false),
                    })
                  }
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={onSubmit} disabled={!isDirty || updateTask.isPending}>
            {updateTask.isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SelectField({
  label,
  name,
  control,
  options,
}: {
  label: string;
  name: "status" | "priority";
  control: import("react-hook-form").Control<FormValues>;
  options: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(options).map(([value, text]) => (
                <SelectItem key={value} value={value}>
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
