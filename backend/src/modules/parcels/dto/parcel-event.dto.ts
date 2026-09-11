import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParcelStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
