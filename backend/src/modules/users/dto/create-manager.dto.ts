import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

/** Compte d'équipe créé par l'administrateur : responsable d'exploitation ou RH. */
export class CreateStaffDto extends CreateManagerDto {
  @ApiPropertyOptional({ enum: [UserRole.MANAGER, UserRole.HR], default: UserRole.MANAGER })
  @IsOptional()
  @IsIn([UserRole.MANAGER, UserRole.HR], { message: 'Rôle d\'équipe invalide.' })
  role?: UserRole;
}
