import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { EopInventory } from './entities/eop-inventory.entity';
import { WmsInventory } from './entities/wms-inventory.entity';
import { WmsUnsortedOrder } from './entities/wms-unsorted-order.entity';
import { UploadBatch } from './entities/upload-batch.entity';
import { GiftSku } from './entities/gift-sku.entity';
import { InventoryReconcile } from '../reconcile/entities/inventory-reconcile.entity';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { GiftService } from './gift.service';
import { GiftController } from './gift.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      EopInventory,
      WmsInventory,
      WmsUnsortedOrder,
      UploadBatch,
      GiftSku,
      InventoryReconcile,
    ]),
  ],
  controllers: [InventoryController, GiftController],
  providers: [ProductService, InventoryService, GiftService],
  exports: [ProductService, InventoryService, TypeOrmModule],
})
export class InventoryModule {}
