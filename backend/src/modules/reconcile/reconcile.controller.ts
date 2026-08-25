import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  Body,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ReconcileService } from './reconcile.service';
import { ReconcileQueryDto, RunReconcileDto } from './dto/reconcile-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { WarehouseType } from '../../common/constants/types';

@Controller('reconcile')
export class ReconcileController {
  constructor(private readonly reconcileService: ReconcileService) {}

  @Post('run')
  async run(@Body() dto: RunReconcileDto) {
    return this.reconcileService.run(
      dto.eopBatchId,
      dto.wmsBatchId,
      dto.warehouse as any,
    );
  }

  @Get()
  async findAll(
    @Query() query: ReconcileQueryDto,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.reconcileService.findAll(
      {
        warehouse: query.warehouse as any,
        status: query.status,
        diffType: query.diffType,
        sku: query.sku,
        isGift: query.isGift === 'true' ? true : query.isGift === 'false' ? false : undefined,
        batchId: query.batchId ? Number(query.batchId) : undefined,
        page: query.page ? Number(query.page) : undefined,
        size: query.size ? Number(query.size) : undefined,
        sort: query.sort,
      },
      user?.role,
    );
  }

  @Get('export')
  async export(
    @Res() res: Response,
    @Query() query: ReconcileQueryDto,
    @CurrentUser() user?: { role?: string },
  ) {
    const buf = await this.reconcileService.exportReconcile(
      {
        warehouse: query.warehouse as any,
        status: query.status,
        diffType: query.diffType,
        sku: query.sku,
        isGift: query.isGift === 'true' ? true : query.isGift === 'false' ? false : undefined,
        batchId: query.batchId ? Number(query.batchId) : undefined,
        page: query.page ? Number(query.page) : undefined,
        size: query.size ? Number(query.size) : undefined,
        sort: query.sort,
      },
      user?.role,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reconcile-${Date.now()}.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
    return;
  }

  @Get('gift')
  async gift(
    @Query() query: ReconcileQueryDto,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.reconcileService.giftView(
      {
        warehouse: query.warehouse as any,
        status: query.status,
        diffType: query.diffType,
        sku: query.sku,
        batchId: query.batchId ? Number(query.batchId) : undefined,
        page: query.page ? Number(query.page) : undefined,
        size: query.size ? Number(query.size) : undefined,
        sort: query.sort,
      },
      user?.role,
    );
  }

  @Get('report')
  async getReport(
    @Query('warehouse') warehouse?: WarehouseType,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.reconcileService.getReport(warehouse as WarehouseType | undefined);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.reconcileService.findOne(id, user?.role);
  }

  @Post(':id/clear-reference')
  @RequirePermission('reconcile.clear')
  async clearReference(@Param('id', ParseIntPipe) id: number) {
    return this.reconcileService.clearReference(id);
  }

  /** 清空全部对账数据（admin / 有 reconcile.clear 权限）。 */
  @Delete()
  @RequirePermission('reconcile.clear')
  async clearAll(@Query('warehouse') warehouse?: WarehouseType) {
    return this.reconcileService.clearAll(warehouse as WarehouseType);
  }
}
