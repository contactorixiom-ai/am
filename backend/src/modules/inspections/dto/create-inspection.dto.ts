import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un point de dommage relevé sur le croquis du véhicule. */
export class DamagePointDto {
  @ApiProperty({ enum: ['top', 'front', 'rear', 'left', 'right'] })
  @IsIn(['top', 'front', 'rear', 'left', 'right'])
  view!: 'top' | 'front' | 'rear' | 'left' | 'right';

  @ApiProperty({ description: 'Position relative sur le croquis, de 0 à 1.' })
  @Type(() => Number) @IsNumber() @Min(0) @Max(1)
  x!: number;

  @ApiProperty({ description: 'Position relative sur le croquis, de 0 à 1.' })
  @Type(() => Number) @IsNumber() @Min(0) @Max(1)
  y!: number;

  @ApiProperty({ enum: ['R', 'F', 'E', 'C', 'M'], description: 'Rayure, Fissure, Enfoncement, Cassé, Manquant' })
  @IsIn(['R', 'F', 'E', 'C', 'M'])
  code!: 'R' | 'F' | 'E' | 'C' | 'M';
}

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

  @ApiPropertyOptional({ type: [DamagePointDto], description: 'Points relevés sur le croquis.' })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => DamagePointDto)
  damages?: DamagePointDto[];

  @ApiPropertyOptional({ description: 'Réponses aux contrôles Oui/Non du client.' })
  @IsOptional() @IsObject()
  controls?: Record<string, boolean>;
}
