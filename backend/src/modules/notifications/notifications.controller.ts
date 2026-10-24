import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PushPlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

class PushTokenDto {
  @IsString()
  @MaxLength(255)
  token!: string;

  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;
}

class RemovePushTokenDto {
  @IsString()
  @MaxLength(255)
  token!: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    const { data, total } = await this.notifications.list(userId, pagination.skip, pagination.take);
    return paginate(data, total, pagination.page, pagination.pageSize);
  }

  @Post('push-token')
  registerPushToken(@CurrentUser('id') userId: string, @Body() dto: PushTokenDto) {
    return this.notifications.registerPushToken(userId, dto.token, dto.platform, dto.deviceId);
  }

  @Delete('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePushToken(@CurrentUser('id') userId: string, @Body() dto: RemovePushTokenDto) {
    await this.notifications.removePushToken(userId, dto.token);
  }

  @Post(':id/read')
  read(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(id, userId);
  }

  @Post('read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
