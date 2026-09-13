import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Montant à débiter, en centimes (min 100 = 1,00).' })
  @IsInt()
  @Min(100)
  amountCents!: number;

  @ApiPropertyOptional({ example: 'eur', description: 'Code devise ISO (défaut : eur).' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Référence commande (mission/colis).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @ApiPropertyOptional({ description: 'Libellé affiché au paiement.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ description: 'URL de retour succès — doit contenir {CHECKOUT_SESSION_ID}.' })
  @IsString()
  @MaxLength(500)
  successUrl!: string;

  @ApiProperty({ description: 'URL de retour annulation.' })
  @IsString()
  @MaxLength(500)
  cancelUrl!: string;
}
