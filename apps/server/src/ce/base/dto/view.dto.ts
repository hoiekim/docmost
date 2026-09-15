import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const VIEW_TYPES = ['table', 'kanban', 'calendar'];

export class CreateViewDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsIn(VIEW_TYPES)
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateViewDto {
  @IsUUID()
  viewId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(VIEW_TYPES)
  type?: string;

  /** ViewConfigPatch: null values delete keys. Validated with zod. */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  position?: string;
}

export class DeleteViewDto {
  @IsUUID()
  viewId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;
}
