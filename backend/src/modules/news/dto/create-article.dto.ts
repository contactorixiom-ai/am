import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty()
  @IsString() @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString() @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  excerpt?: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl({ require_tld: false })
  coverUrl?: string;

  @ApiPropertyOptional({ enum: NewsStatus })
  @IsOptional() @IsEnum(NewsStatus)
  status?: NewsStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  tags?: string[];
}
