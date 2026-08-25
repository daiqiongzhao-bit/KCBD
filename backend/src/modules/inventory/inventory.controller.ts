import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';
import { WarehouseType } from '../../common/constants/types';

/** 商品主数据与库存快照查询（R-P0-14）。 */
@Controller()
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly products: ProductService,
    private readonly inventory: InventoryService,
  ) {}

  @Get('products')
  listProducts(
    @Query('isGift') isGift?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.products.list({
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
      keyword,
      page: Number(page) || 1,
      size: size !== undefined ? Number(size) : 20,
    });
  }

  @Post('products')
  @RequirePermission('products.manage')
  createProduct(
    @Body('sku_code') sku_code: string,
    @Body('sku_name') sku_name?: string,
    @Body('barcode') barcode?: string,
    @Body('is_gift') is_gift?: boolean,
  ) {
    return this.products.create({ sku_code, sku_name, barcode, is_gift });
  }

  @Put('products/:id')
  @RequirePermission('products.manage')
  updateProduct(
    @Param('id') id: string,
    @Body() body: { sku_name?: string; barcode?: string; is_gift?: boolean },
  ) {
    return this.products.update(Number(id), body);
  }

  @Delete('products/:id')
  @RequirePermission('products.manage')
  removeProduct(@Param('id') id: string) {
    return this.products.remove(Number(id));
  }

  @Post('products/import')
  @RequirePermission('products.import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  importProducts(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.products.importFromExcel(file.buffer);
  }

  @Get('eop-inventory')
  listEop(
    @Query('batchId') batchId?: number,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('categoryNew') categoryNew?: string,
    @Query('brand') brand?: string,
    @Query('store') store?: string,
    @Query('subStore') subStore?: string,
    @Query('counter') counter?: string,
    @Query('isGift') isGift?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.inventory.listEop({
      batchId: batchId ? Number(batchId) : undefined,
      warehouse: warehouse as WarehouseType,
      sku,
      barcode,
      skuName,
      categoryNew,
      brand,
      store,
      subStore,
      counter,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
      page: Number(page) || 1,
      size: size !== undefined ? Number(size) : 20,
    });
  }

  @Get('eop-inventory/export')
  async exportEop(
    @Res() res: Response,
    @Query('batchId') batchId?: number,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('categoryNew') categoryNew?: string,
    @Query('brand') brand?: string,
    @Query('store') store?: string,
    @Query('subStore') subStore?: string,
    @Query('counter') counter?: string,
    @Query('isGift') isGift?: string,
  ) {
    const buf = await this.inventory.exportEop({
      batchId: batchId ? Number(batchId) : undefined,
      warehouse: warehouse as WarehouseType,
      sku,
      barcode,
      skuName,
      categoryNew,
      brand,
      store,
      subStore,
      counter,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="eop-inventory-${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
    return;
  }

  @Get('wms-inventory')
  listWms(
    @Query('batchId') batchId?: number,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('locationCode') locationCode?: string,
    @Query('isGift') isGift?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.inventory.listWms({
      batchId: batchId ? Number(batchId) : undefined,
      warehouse: warehouse as WarehouseType,
      sku,
      barcode,
      skuName,
      locationCode,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
      page: Number(page) || 1,
      size: size !== undefined ? Number(size) : 20,
    });
  }

  @Get('wms-inventory/export')
  async exportWms(
    @Res() res: Response,
    @Query('batchId') batchId?: number,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('locationCode') locationCode?: string,
    @Query('isGift') isGift?: string,
  ) {
    const buf = await this.inventory.exportWms({
      batchId: batchId ? Number(batchId) : undefined,
      warehouse: warehouse as WarehouseType,
      sku,
      barcode,
      skuName,
      locationCode,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="wms-inventory-${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
    return;
  }

  /** 未分拣出库单行明细（默认最新一批 WMS，可 batchId 回溯旧批次，区分正常/临期仓）。 */
  @Get('unsorted-orders')
  listUnsortedOrders(
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('batchId') batchId?: number,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('isGift') isGift?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.inventory.listUnsortedOrders({
      warehouse: warehouse as WarehouseType,
      batchId: batchId ? Number(batchId) : undefined,
      sku,
      barcode,
      skuName,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
      page: Number(page) || 1,
      size: size !== undefined ? Number(size) : 20,
    });
  }

  @Get('unsorted-orders/export')
  async exportUnsortedOrders(
    @Res() res: Response,
    @Query('warehouse') warehouse?: WarehouseType,
    @Query('batchId') batchId?: number,
    @Query('sku') sku?: string,
    @Query('barcode') barcode?: string,
    @Query('skuName') skuName?: string,
    @Query('isGift') isGift?: string,
  ) {
    const buf = await this.inventory.exportUnsortedOrders({
      warehouse: warehouse as WarehouseType,
      batchId: batchId ? Number(batchId) : undefined,
      sku,
      barcode,
      skuName,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="unsorted-orders-${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
    return;
  }

  /** 含未分拣出库单行的批次列表（供批次下拉回溯）。 */
  @Get('unsorted-batches')
  listUnsortedBatches() {
    return this.inventory.listUnsortedBatches();
  }

  @Put('eop-inventory/:id')
  @RequirePermission('inventory.edit')
  updateEop(
    @Param('id') id: string,
    @Body() body: { stock_qty?: number; actual_qty?: number; return_qty?: number; warehouse?: WarehouseType },
  ) {
    return this.inventory.updateEop(Number(id), body);
  }

  @Delete('eop-inventory/:id')
  @RequirePermission('inventory.edit')
  removeEop(@Param('id') id: string) {
    return this.inventory.removeEop(Number(id));
  }

  @Put('wms-inventory/:id')
  @RequirePermission('inventory.edit')
  updateWms(
    @Param('id') id: string,
    @Body()
    body: {
      stock_qty?: number;
      available_qty?: number;
      unsorted_qty?: number;
      warehouse?: WarehouseType;
    },
  ) {
    return this.inventory.updateWms(Number(id), body);
  }

  @Delete('wms-inventory/:id')
  @RequirePermission('inventory.edit')
  removeWms(@Param('id') id: string) {
    return this.inventory.removeWms(Number(id));
  }
}
