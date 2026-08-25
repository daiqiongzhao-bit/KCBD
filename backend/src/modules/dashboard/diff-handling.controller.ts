import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DiffHandlingService } from './diff-handling.service';
import { WarehouseType } from '../../common/constants/types';
import { DiffCause } from '../../common/constants/types';

/** 差异处理：列表 / 详情时间线 / 标注改状态。 */
@Controller('diff-handling')
@UseGuards(JwtAuthGuard)
export class DiffHandlingController {
  constructor(private readonly handling: DiffHandlingService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('diffType') diffType?: string,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.handling.list({
      status,
      diffType,
      warehouse: warehouse as WarehouseType,
      page: Number(page) || 1,
      size: Number(size) || 20,
    });
  }

  @Get(':reconcileId')
  async detail(@Param('reconcileId') reconcileId: string) {
    const timeline = await this.handling.timeline(Number(reconcileId));
    return { reconcileId: Number(reconcileId), timeline };
  }

  /** 批量标注 / 改状态：body { ids: number[], cause?, note?, status? } */
  @Post('batch')
  handleBatch(
    @Body('ids') ids?: number[],
    @Body('cause') cause?: DiffCause,
    @Body('note') note?: string,
    @Body('status') status?: string,
    @CurrentUser() user?: { id: number },
  ) {
    return this.handling.handleBatch(
      Array.isArray(ids) ? ids.map(Number) : [],
      { cause, note, status },
      user?.id,
    );
  }

  @Post(':reconcileId')
  handle(
    @Param('reconcileId') reconcileId: string,
    @Body('cause') cause?: DiffCause,
    @Body('note') note?: string,
    @Body('status') status?: string,
    @CurrentUser() user?: { id: number },
  ) {
    return this.handling.handle(
      Number(reconcileId),
      { cause, note, status },
      user?.id,
    );
  }
}
