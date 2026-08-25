import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotifyService } from './notify.service';

/** 站内通知：列表 / 全部已读 / 标记已读。 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotifyController {
  constructor(private readonly notify: NotifyService) {}

  @Get()
  list(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notify.list({
      page: Number(page) || 1,
      size: Number(size) || 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user?: { id: number }) {
    return this.notify.markAllRead(user?.id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notify.markRead(Number(id));
  }
}
