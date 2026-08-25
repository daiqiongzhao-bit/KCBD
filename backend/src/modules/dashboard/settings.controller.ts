import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles.enum';
import { AlertConfigService } from './alert-config.service';

/** 系统设置：对账容差 / 告警阈值（P1-09 / P2-03）。 */
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly alert: AlertConfigService) {}

  @Get('tolerance')
  async getTolerance() {
    const v = await this.alert.getNumber('diff_rate_tolerance', 0.005);
    return { diffRateTolerance: v };
  }

  @Put('tolerance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async putTolerance(@Body('diffRateTolerance') value: number) {
    const v = Number(value);
    if (isNaN(v) || v < 0 || v > 1) {
      return { diffRateTolerance: await this.alert.getNumber('diff_rate_tolerance', 0.005) };
    }
    await this.alert.set('diff_rate_tolerance', String(v));
    return { diffRateTolerance: v };
  }

  @Get('alerts')
  async getAlerts() {
    const unsortedOverdueDays = await this.alert.getNumber('unsorted_overdue_days', 3);
    const expiryWarnDays = await this.alert.getNumber('expiry_warn_days', 90);
    const expiryUrgentDays = await this.alert.getNumber('expiry_urgent_days', 30);
    return { unsortedOverdueDays, expiryWarnDays, expiryUrgentDays };
  }

  @Put('alerts')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async putAlerts(
    @Body('unsortedOverdueDays') unsortedOverdueDays?: number,
    @Body('expiryWarnDays') expiryWarnDays?: number,
    @Body('expiryUrgentDays') expiryUrgentDays?: number,
  ) {
    if (unsortedOverdueDays !== undefined)
      await this.alert.set('unsorted_overdue_days', String(unsortedOverdueDays));
    if (expiryWarnDays !== undefined)
      await this.alert.set('expiry_warn_days', String(expiryWarnDays));
    if (expiryUrgentDays !== undefined)
      await this.alert.set('expiry_urgent_days', String(expiryUrgentDays));
    return this.getAlerts();
  }
}
