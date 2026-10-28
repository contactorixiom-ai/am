import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Compte créé par l'équipe Axis : responsable d'exploitation ou convoyeur invité. */
export class CreateManagerDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80)
  firstName!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80)
  lastName!: string;

  @ApiProperty() @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string;
}
