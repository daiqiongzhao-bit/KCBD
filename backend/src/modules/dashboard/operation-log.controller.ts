import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OperationLogService } from './operation-log.service';

/** 操作日志查询（P1 R-P1-06）。 */
@Controller('operation-logs')
@UseGuards(JwtAuthGuard)
export class OperationLogController {
  constructor(private readonly logs: OperationLogService) {}

  @Get()
  list(
    @Query('user') user?: number,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.logs.list({
      user: user ? Number(user) : undefined,
      action,
      from,
      to,
      page: Number(page) || 1,
      size: Number(size) || 20,
    });
  }
}
