import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

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

  @Post(':id/read')
  read(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(id, userId);
  }

  @Post('read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
