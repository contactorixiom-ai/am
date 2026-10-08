import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCheckoutDto {
  // Conservé pour les versions installées de l'application : le serveur
  // l'ignore et facture le prix de la commande.
  @ApiPropertyOptional({ description: 'Ignoré — le montant est celui de la commande.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;

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

  @ApiPropertyOptional({ description: 'Convoyage réglé — rattache le paiement au dossier.' })
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiPropertyOptional({ description: 'Colis réglé — rattache le paiement au dossier.' })
  @IsOptional()
  @IsUUID()
  parcelId?: string;

  @ApiProperty({ description: 'URL de retour succès — doit contenir {CHECKOUT_SESSION_ID}.' })
  @IsString()
  @MaxLength(500)
  successUrl!: string;

  @ApiProperty({ description: 'URL de retour annulation.' })
  @IsString()
  @MaxLength(500)
  cancelUrl!: string;
}
