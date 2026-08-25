import { IsOptional, IsString, IsInt, IsNumber } from 'class-validator';

export class ReconcileQueryDto {
  @IsOptional()
  @IsString()
  warehouse?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  diffType?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  isGift?: string;

  @IsOptional()
  @IsInt()
  batchId?: number;

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  size?: number;

  @IsOptional()
  @IsString()
  sort?: string;
}

export class RunReconcileDto {
  @IsOptional()
  eopBatchId?: number;

  @IsOptional()
  wmsBatchId?: number;

  @IsOptional()
  warehouse?: string;

  @IsOptional()
  tolerance?: number;
}
