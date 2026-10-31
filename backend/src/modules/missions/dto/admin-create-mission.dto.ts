import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissionPriority, VehicleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Commande saisie par Roger (prise de commande téléphonique) :
// le client peut être existant (clientId) ou créé à la volée (email + nom),
// et le véhicule peut être existant (vehicleId) ou décrit en ligne.
export class AdminCreateMissionDto {
  // --- Client ---
  @ApiPropertyOptional({ description: 'Client existant' })
  @IsOptional() @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Email du client (création à la volée)' })
  @IsOptional() @IsEmail()
  clientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80)
  clientFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80)
  clientLastName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(30)
  clientPhone?: string;

  // --- Véhicule ---
  @ApiPropertyOptional({ description: 'Véhicule existant du client' })
  @IsOptional() @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional() @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: 'Renault' })
  @IsOptional() @IsString() @MaxLength(80)
  vehicleMake?: string;

  @ApiPropertyOptional({ example: 'Master' })
  @IsOptional() @IsString() @MaxLength(80)
  vehicleModel?: string;

  @ApiPropertyOptional({ example: 2021 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2100)
  vehicleYear?: number;

  @ApiPropertyOptional({ example: 'AB-123-CD' })
  @IsOptional() @IsString() @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  vehicleVin?: string;

  // --- Convoyeur (facultatif : affectation immédiate) ---
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  driverId?: string;

  // --- Trajet ---
  @ApiPropertyOptional({ enum: MissionPriority })
  @IsOptional() @IsEnum(MissionPriority)
  priority?: MissionPriority;

  @ApiProperty()
  @IsString() @MaxLength(200)
  pickupAddress!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  pickupCity!: string;

  @ApiPropertyOptional({ example: 'FR' })
  @IsOptional() @IsString() @MaxLength(2)
  pickupCountry?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(12)
  pickupPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  pickupLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  pickupLongitude?: number;

  @ApiProperty()
  @IsDateString()
  pickupAt!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  pickupNotes?: string;

  @ApiProperty()
  @IsString() @MaxLength(200)
  deliveryAddress!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  deliveryCity!: string;

  @ApiPropertyOptional({ example: 'FR' })
  @IsOptional() @IsString() @MaxLength(2)
  deliveryCountry?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(12)
  deliveryPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  deliveryLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber()
  deliveryLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  deliveryAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  deliveryNotes?: string;

  // --- Commercial ---
  @ApiPropertyOptional({ description: 'Prix TTC convenu, en centimes' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({ description: 'Distance estimée en km' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  distanceKm?: number;
}
