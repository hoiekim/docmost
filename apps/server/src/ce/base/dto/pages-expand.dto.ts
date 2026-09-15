import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ExpandPagesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  pageIds: string[];
}
