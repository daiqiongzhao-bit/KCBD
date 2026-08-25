import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryReconcile } from '../reconcile/entities/inventory-reconcile.entity';
import { DiffHandling } from './entities/diff-handling.entity';
import { OperationLog } from './entities/operation-log.entity';
import { AlertConfig } from './entities/alert-config.entity';
import { EopInventory } from '../inventory/entities/eop-inventory.entity';
import { WmsUnsortedOrder } from '../inventory/entities/wms-unsorted-order.entity';
import { Product } from '../inventory/entities/product.entity';
import { WmsInventory } from '../inventory/entities/wms-inventory.entity';
import { GiftSku } from '../inventory/entities/gift-sku.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotifyModule } from '../notify/notify.module';
import { DashboardService } from './dashboard.service';
import { AlertConfigService } from './alert-config.service';
import { OperationLogService } from './operation-log.service';
import { DiffHandlingService } from './diff-handling.service';
import { DashboardController } from './dashboard.controller';
import { DiffHandlingController } from './diff-handling.controller';
import { OperationLogController } from './operation-log.controller';
import { SettingsController } from './settings.controller';
import { MetaController } from './meta.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryReconcile,
      DiffHandling,
      OperationLog,
      AlertConfig,
      EopInventory,
      WmsInventory,
      WmsUnsortedOrder,
      GiftSku,
      Product,
    ]),
    InventoryModule,
    NotifyModule,
  ],
  providers: [
    DashboardService,
    AlertConfigService,
    OperationLogService,
    DiffHandlingService,
  ],
  controllers: [
    DashboardController,
    DiffHandlingController,
    OperationLogController,
    SettingsController,
    MetaController,
  ],
  exports: [AlertConfigService, OperationLogService, DiffHandlingService],
})
export class DashboardModule {}
