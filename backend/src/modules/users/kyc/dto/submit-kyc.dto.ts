import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KycDocumentType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Soumission d'un document KYC.
 *
 * Le fichier doit avoir été uploadé au préalable via `POST /storage/upload`
 * (dossier `kyc`). On enregistre ici l'URL renvoyée + les métadonnées.
 */
export class SubmitKycDto {
  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  type!: KycDocumentType;

  @ApiProperty({ description: 'URL du fichier (issue de /storage/upload)' })
  @IsUrl({ require_tld: false })
  fileUrl!: string;

  @ApiProperty({ example: 'permis-recto.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType invalide' })
  mimeType!: string;

  @ApiProperty({ example: 482910, description: 'Taille en octets' })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiPropertyOptional({ description: 'Note libre du déposant' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
