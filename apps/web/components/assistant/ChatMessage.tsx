import { Bot } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType, User } from "@/lib/types";

export function ChatMessage({
  message,
  user,
  streaming = false,
}: {
  message: ChatMessageType;
  user?: Pick<User, "name" | "avatarUrl">;
  streaming?: boolean;
}) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex gap-3", !isAssistant && "flex-row-reverse")}>
      <div className="shrink-0">
        {isAssistant ? (
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full">
            <Bot className="size-3.5" />
          </div>
        ) : user ? (
          <UserAvatar user={user} withTooltip={false} />
        ) : (
          <div className="bg-muted size-6 rounded-full" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          isAssistant
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {message.content}
        {streaming && (
          <span className="bg-foreground/70 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
