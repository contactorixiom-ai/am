import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PickupMode, QuoteOptionKind, QuoteService, TransportMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Article de la grille import-export (fût, carton, m³, palette…). */
export class QuoteItemDto {
  @ApiProperty({ example: 'DRUM_200', description: 'Code de l\'article dans la grille (GET /quotes/tariffs)' })
  @IsString() @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 2, description: 'Nombre de pièces, ou volume en m³' })
  @Type(() => Number) @IsNumber() @Min(0.01) @Max(1000)
  quantity!: number;
}

export class CreateQuoteDto {
  @ApiProperty({ enum: QuoteService })
  @IsEnum(QuoteService)
  service!: QuoteService;

  @ApiPropertyOptional({ enum: TransportMode, description: 'AIR ou SEA pour colis/marchandise. ROAD pour convoyage.' })
  @IsOptional()
  @IsEnum(TransportMode)
  transportMode?: TransportMode;

  @ApiPropertyOptional({ enum: PickupMode, description: 'Pour les colis : HUB_DROP_OFF (gratuit), RELAY_DROP_OFF, HOME_PICKUP.' })
  @IsOptional()
  @IsEnum(PickupMode)
  pickupMode?: PickupMode;

  @ApiProperty()
  @IsString() @MaxLength(80)
  fromCity!: string;

  @ApiProperty({ example: 'FR' })
  @IsString() @MaxLength(2)
  fromCountry!: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLatitude()
  fromLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  fromLongitude?: number;

  @ApiProperty()
  @IsString() @MaxLength(80)
  toCity!: string;

  @ApiProperty({ example: 'BE' })
  @IsString() @MaxLength(2)
  toCountry!: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLatitude()
  toLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  toLongitude?: number;

  @ApiPropertyOptional({ description: 'Distance estimée en km (convoyage)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ description: 'Catégorie de véhicule (berline, SUV, utilitaire, luxe…) — grille convoyage' })
  @IsOptional() @IsString() @MaxLength(40)
  vehicleCategory?: string;

  @ApiPropertyOptional({ description: 'Distance domicile → hub en km (enlèvement à domicile)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  pickupDistanceKm?: number;

  @ApiPropertyOptional({ description: 'Poids en kg (colis, marchandise)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Volume en m³ (marchandise)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  volumeM3?: number;

  @ApiPropertyOptional({ description: 'Nombre d\'unités (palettes, colis)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  units?: number;

  @ApiPropertyOptional({ type: [QuoteItemDto], description: 'Envois maritimes : articles de la grille et quantités' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @ApiPropertyOptional({ enum: QuoteOptionKind, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(QuoteOptionKind, { each: true })
  options?: QuoteOptionKind[];
}
