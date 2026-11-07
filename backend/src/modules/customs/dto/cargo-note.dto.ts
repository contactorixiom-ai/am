import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CargoTrackingStatus, CargoTrackingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCargoNoteDto {
  @ApiPropertyOptional({ description: 'Colis rattaché (facultatif si déclaration anticipée)' })
  @IsOptional() @IsUUID()
  parcelId?: string;

  @ApiProperty({ example: 'SN', description: 'Pays de destination (ISO alpha-2)' })
  @IsString() @Length(2, 2)
  destinationCountry!: string;

  @ApiPropertyOptional({
    enum: CargoTrackingType,
    description: 'Type de bordereau. Déduit automatiquement du pays si omis.',
  })
  @IsOptional() @IsEnum(CargoTrackingType)
  type?: CargoTrackingType;

  @ApiPropertyOptional({ description: 'N° de connaissement / Bill of Lading' })
  @IsOptional() @IsString() @MaxLength(60)
  blNumber?: string;

  @ApiPropertyOptional({ description: 'Code SH (Système Harmonisé) de la marchandise' })
  @IsOptional() @IsString() @MaxLength(20)
  hsCode?: string;

  @ApiPropertyOptional({ description: 'Valeur FOB en centimes (devise du pays)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  fobValueCents?: number;
}

export class UpdateCargoNoteStatusDto {
  @ApiProperty({ enum: CargoTrackingStatus })
  @IsEnum(CargoTrackingStatus)
  status!: CargoTrackingStatus;

  @ApiPropertyOptional({ description: 'N° du bordereau une fois émis' })
  @IsOptional() @IsString() @MaxLength(60)
  number?: string;

  @ApiPropertyOptional({ description: 'Frais du bordereau en centimes' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  feeCents?: number;
}
