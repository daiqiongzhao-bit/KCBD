import { Controller, Get, Query, UseGuards, Header, Post, ForbiddenException, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { WarehouseType } from '../../common/constants/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';

/** 仪表盘 + 未分拣 + 退货在途 + 效期预警。 */
@Controller()
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard/summary')
  summary(
    @Query('warehouse') warehouse?: WarehouseType,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.dashboard.summary(warehouse as WarehouseType, user?.role);
  }

  @Get('dashboard/trend')
  trend(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('warehouse') warehouse?: WarehouseType,
  ) {
    return this.dashboard.trend(from, to, warehouse as WarehouseType);
  }

  @Get('dashboard/formula')
  formula(@Query('warehouse') warehouse?: WarehouseType) {
    return this.dashboard.formula(warehouse as WarehouseType);
  }

  @Get('unsorted')
  unsorted(
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.dashboard.unsorted(
      warehouse as WarehouseType,
      overdueOnly === 'true',
    );
  }

  @Get('unsorted/pivot')
  unsortedPivot(
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.dashboard.unsortedPivot(
      warehouse as WarehouseType,
      Number(page) || 1,
      Number(size) || 20,
    );
  }

  @Get('returns/transit')
  returnsTransit(
    @Query('warehouse') warehouse?: WarehouseType,
    @CurrentUser() user?: { role?: string },
  ) {
    return this.dashboard.returnsTransit(warehouse as WarehouseType, user?.role);
  }

  @Get('unsorted/export')
  @RequirePermission('unsorted.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="unsorted.csv"')
  async unsortedExport(@Query('warehouse') warehouse?: WarehouseType) {
    const items = await this.dashboard.exportUnsorted(
      warehouse as WarehouseType,
    );
    const header = [
      '仓库',
      '商品编码',
      '商品条码',
      '未分拣',
      '可用',
      '总库存',
      '超期天数',
      '级别',
      '快照时间',
    ];
    const levelLabel: Record<string, string> = {
      urgent: '紧急',
      warning: '警告',
      normal: '正常',
    };
    const whLabel = (w: string) => (w === 'expired' ? '临期仓' : '正常仓');
    const rows = items.map((i) =>
      [
        whLabel(i.warehouse),
        i.sku_code,
        i.barcode || '',
        i.unsorted_qty,
        i.available_qty,
        i.stock_qty,
        i.overdueDays,
        levelLabel[i.level] || i.level,
        i.snapshot_at,
      ]
        .map((c) => '"' + String(c).replace(/"/g, '""') + '"')
        .join(','),
    );
    return '﻿' + [header.join(','), ...rows].join('\r\n');
  }

  @Get('expiry/distribution')
  expiryDistribution() {
    return this.dashboard.expiry();
  }

  @Get('expiry/alerts')
  expiryAlerts() {
    return this.dashboard.expiry();
  }

  /** 清空所有业务数据（仅 admin）：保留 users/role_permissions/notifications/alert_configs 等系统表。 */
  @Post('admin/clear-all')
  clearAllData(@CurrentUser() user?: { role?: string }) {
    if (user?.role !== 'admin') {
      throw new ForbiddenException('仅系统管理员可执行清空操作');
    }
    return this.dashboard.clearAllData();
  }

  /** 单表行数（admin 端清空前预览）。 */
  @Get('admin/table-counts')
  async getTableCounts(@CurrentUser() user?: { role?: string }) {
    if (user?.role !== 'admin') {
      throw new ForbiddenException('仅系统管理员可查询表行数');
    }
    return this.dashboard.getTableCounts();
  }

  /** 清空单个表（仅 admin，破坏性，前端须二次确认）。 */
  @Post('admin/clear-table')
  clearTable(
    @Body('table') table: string,
    @CurrentUser() user?: { role?: string },
  ) {
    if (user?.role !== 'admin') {
      throw new ForbiddenException('仅系统管理员可执行清空操作');
    }
    return this.dashboard.clearTable(table);
  }
}
