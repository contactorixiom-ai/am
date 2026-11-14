import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** E-mail ou numéro de téléphone du compte. */
  @ApiProperty({ example: 'jean.dupont@example.com', description: 'E-mail ou téléphone' })
  @IsString()
  @MinLength(3, { message: 'Indiquez votre e-mail ou votre téléphone.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
