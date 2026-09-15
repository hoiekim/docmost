import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Two body shapes reach /bases/create:
 *  - { name, spaceId, description?, icon? }   (top-level base in a space)
 *  - { parentPageId, template? }               (inline base under a document)
 */
export class CreateBaseDto {
  @ValidateIf((o) => !o.parentPageId)
  @IsUUID()
  spaceId?: string;

  @ValidateIf((o) => !o.spaceId)
  @IsString()
  @IsNotEmpty()
  parentPageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsIn(['kanban'])
  template?: 'kanban';
}

export class BasePageIdDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class UpdateBaseDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}

export class ConvertBaseDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsIn(['kanban'])
  template?: 'kanban';
}

export class ListBasesDto {
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
