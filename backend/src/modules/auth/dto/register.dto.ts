import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jean.dupont@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{8,20}$/, { message: 'Invalid phone format' })
  phone?: string;

  // L'inscription publique ne peut créer qu'un client ou un convoyeur. Le
  // champ acceptait toute valeur de UserRole, ADMIN compris : une seule
  // requête suffisait pour obtenir un compte administrateur et lire les
  // paiements, contrats et pièces d'identité de tous les clients. Le rôle
  // ADMIN ne s'obtient que par promotion (npm run promote:admin).
  @ApiPropertyOptional({ enum: [UserRole.CLIENT, UserRole.DRIVER], default: UserRole.CLIENT })
  @IsOptional()
  @IsIn([UserRole.CLIENT, UserRole.DRIVER], {
    message: 'Seuls les rôles CLIENT et DRIVER sont possibles à l\'inscription.',
  })
  role?: UserRole;

  @ApiPropertyOptional({ enum: AccountType, default: AccountType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  // Case « J'accepte les CGU et la politique de confidentialité ». Facultatif
  // côté serveur pour ne pas bloquer une ancienne version de l'application
  // pendant une mise à jour ; l'application l'exige.
  @ApiPropertyOptional({ description: 'Version des CGU acceptées, ex. 2026-09' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  acceptedTermsVersion?: string;

  @ApiPropertyOptional({ example: 'Axis Trans SARL' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  companyName?: string;
}
