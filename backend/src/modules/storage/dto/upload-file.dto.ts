import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Upload d'un fichier encodé en base64 (JSON).
 *
 * On privilégie le base64 plutôt que le multipart pour le pilote : le client
 * mobile (`apiFetch`) envoie déjà du JSON, cela évite d'ajouter une dépendance
 * (multer + @types/multer) et fonctionne de façon identique sur web et natif.
 * Le `data` accepte une data URL (`data:image/jpeg;base64,...`) ou du base64 brut.
 */
export class UploadFileDto {
  @ApiProperty({ example: 'permis-recto.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType invalide' })
  mimeType!: string;

  @ApiProperty({ description: 'Contenu base64 (data URL ou base64 brut)' })
  @IsString()
  @MinLength(8)
  data!: string;

  @ApiPropertyOptional({
    description: 'Dossier logique de rangement',
    enum: ['kyc', 'signatures', 'documents', 'avatars', 'misc'],
    default: 'misc',
  })
  @IsOptional()
  @IsIn(['kyc', 'signatures', 'documents', 'avatars', 'misc'])
  folder?: string;
}
