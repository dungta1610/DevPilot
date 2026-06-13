"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useMembers, useProject } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: members } = useMembers(projectId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
          <CardDescription>Project details and linked repository.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!project ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Project name</Label>
                <Input defaultValue={project.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>GitHub repository</Label>
                <Input
                  defaultValue={project.githubRepo}
                  readOnly
                  className="font-mono"
                />
                <p className="text-muted-foreground text-xs">
                  The connected repository can&apos;t be changed after creation.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea defaultValue={project.description} rows={3} />
              </div>
              <Button
                size="sm"
                onClick={() => toast.success("Settings saved")}
              >
                Save changes
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Members</CardTitle>
          <CardDescription>People with access to this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {!members ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <ul className="divide-y">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar user={member.user} withTooltip={false} />
                    <div>
                      <p className="text-sm font-medium">{member.user.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs capitalize">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-sm">Danger zone</CardTitle>
          <CardDescription>
            Deleting a project removes its tasks, reviews, and history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" size="sm">
                  Delete project
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the project and all of its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(buttonVariants({ variant: "destructive" }))}
                  onClick={() =>
                    toast.info("Project deletion isn't wired up in this scaffold")
                  }
                >
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
