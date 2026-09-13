import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CallStatus, CallType } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

class InitiateCallDto {
  @IsEnum(CallType)
  type!: CallType;
}

class UpdateCallDto {
  @IsEnum(CallStatus)
  status!: CallStatus;
}

@ApiTags('messaging')
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly gateway: MessagingGateway,
  ) {}

  @Get('conversations')
  async list(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    const { data, total } = await this.messaging.listConversations(userId, pagination.skip, pagination.take);
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Get('conversations/:id')
  getOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.messaging.getConversation(id, user);
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    const { data, total } = await this.messaging.listMessages(id, user, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Envoyer un message' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messaging.sendMessage(id, userId, dto);
    this.gateway.broadcastMessage(id, message);
    return message;
  }

  @Post('conversations/:id/read')
  read(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    return this.messaging.markRead(id, userId);
  }

  @Post('conversations/:id/calls')
  @ApiOperation({ summary: 'Initier un appel audio/vidéo' })
  async initiateCall(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateCallDto,
  ) {
    const call = await this.messaging.initiateCall(id, userId, dto.type);
    this.gateway.broadcastCall(id, call);
    return call;
  }

  @Post('calls/:id')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'un appel' })
  updateCall(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCallDto,
  ) {
    return this.messaging.updateCall(id, userId, dto.status);
  }
}
