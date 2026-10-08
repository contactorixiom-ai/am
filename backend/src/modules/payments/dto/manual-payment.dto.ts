import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Règlement reçu hors de l'application (virement, espèces, chèque…). */
export class ManualPaymentDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() missionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parcelId?: string;

  @ApiProperty({ description: 'Montant TTC en centimes' })
  @Type(() => Number) @IsInt() @Min(100) @Max(10_000_000)
  amountCents!: number;

  @ApiProperty({ enum: ['TRANSFER', 'CASH', 'CHECK', 'CARD_TERMINAL', 'MOBILE_MONEY'] })
  @IsIn(['TRANSFER', 'CASH', 'CHECK', 'CARD_TERMINAL', 'MOBILE_MONEY'])
  method!: 'TRANSFER' | 'CASH' | 'CHECK' | 'CARD_TERMINAL' | 'MOBILE_MONEY';

  @ApiPropertyOptional({ description: 'Référence du virement, n° de chèque…' })
  @IsOptional() @IsString() @MaxLength(120)
  note?: string;
}
