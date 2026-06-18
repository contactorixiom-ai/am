import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CargoTrackingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Un document requis à l'import dans un pays donné.
 * Stocké tel quel (JSON) dans CountryRegulation.requiredDocuments.
 */
export class RequiredDocumentDto {
  @ApiProperty({ example: 'commercial_invoice', description: 'Clé technique stable' })
  @IsString() @MaxLength(60)
  key!: string;

  @ApiProperty({ example: 'Facture commerciale' })
  @IsString() @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ description: 'Document obligatoire (true) ou recommandé (false)', default: true })
  @IsOptional() @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ description: 'Précisions (nombre d\'exemplaires, langue, légalisation…)' })
  @IsOptional() @IsString() @MaxLength(240)
  note?: string;
}

export class CreateCountryRegulationDto {
  @ApiProperty({ example: 'SN', description: 'ISO 3166-1 alpha-2' })
  @IsString() @Length(2, 2)
  countryCode!: string;

  @ApiProperty({ example: 'Sénégal' })
  @IsString() @MaxLength(80)
  countryName!: string;

  @ApiPropertyOptional({ enum: CargoTrackingType })
  @IsOptional() @IsEnum(CargoTrackingType)
  cargoTrackingType?: CargoTrackingType;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  cargoMandatory?: boolean;

  @ApiPropertyOptional({ example: 'COSEC', description: 'Organisme émetteur' })
  @IsOptional() @IsString() @MaxLength(120)
  authority?: string;

  @ApiPropertyOptional({ example: 'XOF', default: 'XOF' })
  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  customsNotes?: string;

  @ApiProperty({ type: [RequiredDocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredDocumentDto)
  requiredDocuments!: RequiredDocumentDto[];
}

export class UpdateCountryRegulationDto extends PartialType(CreateCountryRegulationDto) {}
