"use client";

import { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/assistant/ChatMessage";
import { ChatInput } from "@/components/assistant/ChatInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useChatHistory, useMe } from "@/lib/queries";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

// Module-scope id generator keeps the impure Date.now() out of render scope.
let messageSeq = 0;
function tempId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}_${Date.now()}_${messageSeq}`;
}

export function ChatWindow({ projectId }: { projectId: string }) {
  const { data: history, isLoading } = useChatHistory(projectId);
  const { data: user } = useMe();

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  // Seed local state from server history once it arrives.
  useEffect(() => {
    if (history && !seeded.current) {
      setMessages(history);
      seeded.current = true;
    }
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingId]);

  async function handleSend(content: string) {
    const userMessage: ChatMessageType = {
      id: tempId("local"),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const reply = await api.sendChat(projectId, content);
      const placeholder: ChatMessageType = { ...reply, content: "" };
      setMessages((prev) => [...prev, placeholder]);
      setStreamingId(reply.id);
      streamInReply(reply.id, reply.content);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: tempId("err"),
          role: "assistant",
          content: "Sorry — I couldn't reach the assistant. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
      setSending(false);
    }
  }

  // Reveal the reply word-by-word to mimic a streamed response.
  function streamInReply(id: string, full: string) {
    const words = full.split(" ");
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      const partial = words.slice(0, i).join(" ");
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: partial } : m)),
      );
      if (i >= words.length) {
        clearInterval(interval);
        setStreamingId(null);
        setSending(false);
      }
    }, 35);
  }

  const showEmpty = !isLoading && messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-4">
          {isLoading && (
            <>
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="ml-auto h-12 w-1/2" />
            </>
          )}

          {showEmpty && (
            <EmptyState
              icon={Bot}
              title="Project assistant"
              description="Ask me about sprint planning, code-quality trends, security findings, or what to work on next. I'm scoped to this project's tasks, reviews, and activity."
              className="mt-8"
            />
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              user={user ?? undefined}
              streaming={message.id === streamingId}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="mx-auto w-full max-w-2xl">
          <ChatInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
}
