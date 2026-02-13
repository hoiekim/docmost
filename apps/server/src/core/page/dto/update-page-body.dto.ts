import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePageBodyDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  forceReplace?: boolean;
}
