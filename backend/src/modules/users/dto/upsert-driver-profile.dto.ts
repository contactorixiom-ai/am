import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertDriverProfileDto {
  @ApiProperty()
  @IsString()
  licenseNumber!: string;

  @ApiProperty({ example: '2032-04-15' })
  @IsDateString()
  licenseExpiresAt!: string;

  @ApiProperty({ type: [String], example: ['B', 'BE'] })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  licenseCategories!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['FR', 'BE', 'DE'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  serviceCountries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  baseLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  baseLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
