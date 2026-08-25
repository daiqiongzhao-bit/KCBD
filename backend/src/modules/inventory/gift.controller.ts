import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GiftService } from './gift.service';

/** 赠品 SKU 维护（P2 R-P2-02）。 */
@Controller('gifts')
@UseGuards(JwtAuthGuard)
export class GiftController {
  constructor(private readonly gift: GiftService) {}

  @Get()
  list(@Query('keyword') keyword?: string, @Query('page') page?: number, @Query('size') size?: number) {
    return this.gift.list({ keyword, page: Number(page) || 1, size: Number(size) || 20 });
  }

  @Post()
  create(
    @Body('sku_code') sku_code: string,
    @Body('effective_date') effective_date?: string,
    @Body('sku_name') sku_name?: string,
    @Body('product_id') product_id?: number | null,
  ) {
    return this.gift.create({ sku_code, effective_date, sku_name, product_id });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body('effective_date') effective_date?: string,
    @Body('sku_name') sku_name?: string,
    @Body('product_id') product_id?: number | null,
  ) {
    return this.gift.update(Number(id), { effective_date, sku_name, product_id });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gift.remove(Number(id));
  }
}
