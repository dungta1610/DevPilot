import { Module } from '@nestjs/common';
import { RestateModule } from '../agent/restate.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RestateModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
