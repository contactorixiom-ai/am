import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParcelStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class AddParcelEventDto {
  @ApiProperty({ enum: ParcelStatus })
  @IsEnum(ParcelStatus)
  status!: ParcelStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Nouvelle date d\'arrivée prévue, si Roger la corrige' })
  @IsOptional() @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ description: 'Transporteur du premier tronçon', example: 'Chronopost' })
  @IsOptional() @IsString()
  partnerCarrier?: string;

  @ApiPropertyOptional({ description: 'N° de suivi communiqué par ce transporteur' })
  @IsOptional() @IsString()
  partnerTracking?: string;
}
