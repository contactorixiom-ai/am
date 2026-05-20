import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateInspectionDto {
  @ApiProperty({ enum: InspectionType })
  @IsEnum(InspectionType)
  type!: InspectionType;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  mileage?: number;

  @ApiPropertyOptional({ description: 'Niveau de carburant en %', minimum: 0, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  fuelLevel?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  exteriorNotes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  interiorNotes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  damageNotes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  generalNotes?: string;
}
