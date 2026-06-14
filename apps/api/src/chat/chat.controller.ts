import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageDto> {
    return this.chatService.sendMessage(projectId, dto.content, userId);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(@Param('id') projectId: string): Promise<void> {
    return this.chatService.clearHistory(projectId);
  }
}
