import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissionPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMissionDto {
  @ApiProperty()
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ enum: MissionPriority })
  @IsOptional()
  @IsEnum(MissionPriority)
  priority?: MissionPriority;

  // Pickup
  @ApiProperty()
  @IsString() @MaxLength(200)
  pickupAddress!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  pickupCity!: string;

  @ApiProperty({ example: 'FR' })
  @IsString() @MaxLength(2)
  pickupCountry!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  pickupPostalCode?: string;

  @ApiProperty({ example: 48.8566 })
  @Type(() => Number) @IsLatitude()
  pickupLatitude!: number;

  @ApiProperty({ example: 2.3522 })
  @Type(() => Number) @IsLongitude()
  pickupLongitude!: number;

  @ApiProperty()
  @IsDateString()
  pickupAt!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  pickupNotes?: string;

  // Delivery
  @ApiProperty()
  @IsString() @MaxLength(200)
  deliveryAddress!: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  deliveryCity!: string;

  @ApiProperty({ example: 'BE' })
  @IsString() @MaxLength(2)
  deliveryCountry!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  deliveryPostalCode?: string;

  @ApiProperty({ example: 50.8503 })
  @Type(() => Number) @IsLatitude()
  deliveryLatitude!: number;

  @ApiProperty({ example: 4.3517 })
  @Type(() => Number) @IsLongitude()
  deliveryLongitude!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  deliveryAt?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  deliveryNotes?: string;
}
