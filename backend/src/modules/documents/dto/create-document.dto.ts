import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory, DocumentVisibility } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @ApiPropertyOptional({ enum: DocumentVisibility })
  @IsOptional() @IsEnum(DocumentVisibility)
  visibility?: DocumentVisibility;

  @ApiProperty()
  @IsString() @MaxLength(180)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @Type(() => Number) @IsInt() @Min(0)
  fileSize!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  missionId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  parcelId?: string;
}
