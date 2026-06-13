import { ChatMessage, ChatRole } from '@prisma/client';

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
