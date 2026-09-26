import { ApiProperty } from '@nestjs/swagger';
import { Matches, IsString, MaxLength } from 'class-validator';

/**
 * Apposition d'une signature électronique sur un document.
 * `signatureUrl` est l'URL de l'image de signature : soit une URL http(s)
 * (issue de /storage/upload, dossier `signatures`), soit une data URL inline
 * (SVG vectoriel généré par le SignaturePad).
 */
export class SignDocumentDto {
  @ApiProperty({ description: 'URL http(s) ou data URL de l\'image de signature' })
  @IsString()
  @MaxLength(2_000_000)
  @Matches(/^(https?:\/\/|data:)/, {
    message: 'signatureUrl doit être une URL http(s) ou une data URL',
  })
  signatureUrl!: string;
}
