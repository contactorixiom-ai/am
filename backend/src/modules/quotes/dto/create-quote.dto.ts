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
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Poids en kg (colis, marchandise)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Volume en m³ (marchandise)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  volumeM3?: number;

  @ApiPropertyOptional({ description: 'Nombre d\'unités (palettes, colis)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  units?: number;

  @ApiPropertyOptional({ enum: QuoteOptionKind, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(QuoteOptionKind, { each: true })
  options?: QuoteOptionKind[];
}
