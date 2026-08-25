import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconcileService } from './reconcile.service';
import { ReconcileController } from './reconcile.controller';
import { InventoryReconcile } from './entities/inventory-reconcile.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotifyModule } from '../notify/notify.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryReconcile]),
    InventoryModule,
    forwardRef(() => NotifyModule),
    forwardRef(() => DashboardModule),
  ],
  providers: [ReconcileService],
  controllers: [ReconcileController],
  exports: [ReconcileService],
})
export class ReconcileModule {}
