import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { FieldMappingService } from './field-mapping.service';
import { RowValidator } from './validation/row-validator';
import { Product } from '../inventory/entities/product.entity';
import { EopInventory } from '../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../inventory/entities/wms-inventory.entity';
import { UploadBatch } from '../inventory/entities/upload-batch.entity';
import { GiftSku } from '../inventory/entities/gift-sku.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ReconcileModule } from '../reconcile/reconcile.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      EopInventory,
      WmsInventory,
      UploadBatch,
      GiftSku,
    ]),
    InventoryModule,
    ReconcileModule,
    DashboardModule,
  ],
  providers: [UploadService, FieldMappingService, RowValidator],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
