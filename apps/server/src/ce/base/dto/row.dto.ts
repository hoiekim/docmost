import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRowDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  afterRowId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  position?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class RowInfoDto {
  @IsUUID()
  rowId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class UpdateRowDto {
  @IsUUID()
  rowId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsObject()
  cells: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  position?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowDto {
  @IsUUID()
  rowId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  rowIds: string[];

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReorderRowDto {
  @IsUUID()
  rowId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ListRowsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  /** FilterNode; shape validated with zod in the service. */
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;

  /** ViewSortConfig[]; shape validated with zod in the service. */
  @IsOptional()
  @IsArray()
  sorts?: unknown[];
}
