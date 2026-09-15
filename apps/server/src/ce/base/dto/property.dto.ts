import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BASE_PROPERTY_TYPES } from '../types/base.types';

const TYPES = [...BASE_PROPERTY_TYPES];

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsIn(TYPES)
  type: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class UpdatePropertyDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeletePropertyDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReorderPropertyDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

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
