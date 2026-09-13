import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KycStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Décision de revue d'un document KYC par un ADMIN.
 * Seuls APPROVED / REJECTED sont des décisions valides (pas de retour à PENDING).
 */
export class ReviewKycDto {
  @ApiProperty({ enum: [KycStatus.APPROVED, KycStatus.REJECTED] })
  @IsEnum(KycStatus)
  @IsIn([KycStatus.APPROVED, KycStatus.REJECTED], {
    message: 'status doit être APPROVED ou REJECTED',
  })
  status!: KycStatus;

  @ApiPropertyOptional({ description: 'Motif (obligatoire en cas de rejet)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
