import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { SourceType } from '../../../common/constants/types';

export class UploadListQueryDto {
  @IsOptional()
  @IsIn(['eop', 'wms', 'gift'])
  source?: SourceType;

  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  size?: number = 20;
}

export class UploadPreviewDto {
  @IsOptional()
  @IsString()
  source?: SourceType;
}
