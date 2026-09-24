import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jean.dupont@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Jeton reçu dans le lien' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // Un client créé par Axis au téléphone accepte les CGU ici, au moment
  // d'activer son compte.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  acceptedTermsVersion?: string;
}

export class AccessLinkDto {
  @ApiProperty({ description: 'Utilisateur à qui envoyer un lien d\'accès' })
  @IsUUID()
  userId!: string;
}
