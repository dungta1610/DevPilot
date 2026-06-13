import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { ChatMessageDto } from './dto/chat-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('projects/:id/chat')
@UseGuards(ProjectMemberGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history')
  history(@Param('id') projectId: string): Promise<ChatMessageDto[]> {
    return this.chatService.getHistory(projectId);
  }

  @Post()
  send(
    @Param('id') projectId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageDto> {
    return this.chatService.sendMessage(projectId, dto.content);
  }
}
