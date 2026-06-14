import { Injectable } from '@nestjs/common';
import { RestateClient } from '../agent/restate.client';
import { ChatMessageDto, fromAssistantMessage } from './dto/chat-message.dto';

/**
 * Phase 3: the assistant is a Restate **Virtual Object** (`ProjectAssistant`),
 * keyed by projectId. This service is a thin adapter — it forwards to the object
 * over the Restate ingress and maps the stored turns onto the wire DTO. The
 * object owns the conversation history (in its K/V store) and serializes
 * concurrent messages per project, so there's no DB write or lock here.
 */
@Injectable()
export class ChatService {
  constructor(private readonly restate: RestateClient) {}

  async getHistory(projectId: string): Promise<ChatMessageDto[]> {
    const history = await this.restate.getAssistantHistory(projectId);
    return history.map((m, i) => fromAssistantMessage(m, i));
  }

  /** Sends the user's message and returns the assistant's reply. */
  async sendMessage(
    projectId: string,
    content: string,
    userId: string,
  ): Promise<ChatMessageDto> {
    const reply = await this.restate.chat(projectId, {
      message: content,
      userId,
    });
    return fromAssistantMessage(reply);
  }

  async clearHistory(projectId: string): Promise<void> {
    await this.restate.clearAssistantHistory(projectId);
  }
}
