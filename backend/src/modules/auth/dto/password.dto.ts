import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

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
}

export class AccessLinkDto {
  @ApiProperty({ description: 'Utilisateur à qui envoyer un lien d\'accès' })
  @IsUUID()
  userId!: string;
}
