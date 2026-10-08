import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionPhotoTag } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, IsUrl } from 'class-validator';

export class AddInspectionPhotoDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ enum: InspectionPhotoTag })
  @IsOptional() @IsEnum(InspectionPhotoTag)
  tag?: InspectionPhotoTag;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  longitude?: number;
}
