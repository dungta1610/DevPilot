"use client";

import { useParams } from "next/navigation";
import { ChatWindow } from "@/components/assistant/ChatWindow";

export default function AssistantPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3 md:px-6">
        <h1 className="text-sm font-semibold tracking-tight">Project assistant</h1>
        <p className="text-muted-foreground text-xs">
          Scoped to this project&apos;s tasks, reviews, and activity.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatWindow projectId={projectId} />
      </div>
    </div>
  );
}
