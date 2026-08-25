import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { UploadService } from './upload.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { SourceType } from '../../common/constants/types';

/** 上传限制：仅 xlsx/xls/csv，单文件 ≤ 10MB（P1-5）。 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_UPLOAD_EXT = /\.(xlsx|xls|csv)$/i;

// 服务端解析依赖 file.buffer（parseExcelBuffer），因此必须用内存存储
const uploadStorage = memoryStorage();
// 兼容 multer 的非 UTF-8 默认值：让 filename 字段按 utf8 解码（避免中文双重编码乱码）
(uploadStorage as any).defParamCharset = 'utf8';

const uploadFileFilter: (
  req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => void = (req, file, cb) => {
  if (!ALLOWED_UPLOAD_EXT.test(path.extname(file.originalname))) {
    cb(new BadRequestException('仅支持 xlsx/xls/csv 文件'), false);
    return;
  }
  cb(null, true);
};

const uploadLimits = { fileSize: MAX_FILE_SIZE };

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      fileFilter: uploadFileFilter,
      limits: uploadLimits,
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('source') source: SourceType,
    @Body('warehouse') warehouse?: string,
  ) {
    return this.uploadService.preview(file, source, (warehouse as any) || null);
  }

  @Post()
  @RequirePermission('import.create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      fileFilter: uploadFileFilter,
      limits: uploadLimits,
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: number },
    @Body('source') source: SourceType,
    @Body('mapping') mappingJson: string,
    @Body('force') force: string,
    @Body('warehouse') warehouse?: string,
    @Body('isGift') isGift?: string,
  ) {
    const mapping = mappingJson ? JSON.parse(mappingJson) : undefined;
    return this.uploadService.import(file, source, mapping, {
      uploaderId: user.id,
      force: force === 'true',
      warehouse: (warehouse as any) || null,
      isGift: isGift === 'true' ? true : isGift === 'false' ? false : undefined,
    });
  }

  @Get()
  async list(
    @Query('source') source?: SourceType,
    @Query('page', ParseIntPipe) page = 1,
    @Query('size', ParseIntPipe) size = 20,
  ) {
    return this.uploadService.listBatches({ source, page, size });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.uploadService.getBatch(id);
  }
}
