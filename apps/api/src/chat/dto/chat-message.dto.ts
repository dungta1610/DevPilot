import { ChatMessage, ChatRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AssistantMessage } from '../../agent/restate.client';

export class ChatMessageDto {
  id!: string;
  role!: 'user' | 'assistant';
  content!: string;
  createdAt!: string;
}

export function toChatMessageDto(message: ChatMessage): ChatMessageDto {
  return {
    id: message.id,
    role: message.role === ChatRole.ASSISTANT ? 'assistant' : 'user',
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Map a turn from the ProjectAssistant Virtual Object (Restate K/V) onto the
 * wire DTO. The object stores no id, so we derive a stable-enough one from the
 * message timestamp (or a random uuid for a freshly-returned reply).
 */
export function fromAssistantMessage(
  message: AssistantMessage,
  index?: number,
): ChatMessageDto {
  return {
    id:
      index === undefined
        ? randomUUID()
        : `${message.timestamp}-${message.role}-${index}`,
    role: message.role,
    content: message.content,
    createdAt: message.timestamp,
  };
}
