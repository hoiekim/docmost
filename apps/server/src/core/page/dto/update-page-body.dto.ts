import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class UpdatePageBodyDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, any>;
}
