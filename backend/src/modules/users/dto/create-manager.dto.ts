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

const TEAM = [UserRole.MANAGER, UserRole.HR, UserRole.SECRETARY, UserRole.ACCOUNTANT, UserRole.WEB_DESIGNER, UserRole.SPONSORSHIP];

/** Compte d'équipe créé par l'administrateur : exploitation, RH, secrétariat ou comptabilité. */
export class CreateStaffDto extends CreateManagerDto {
  @ApiPropertyOptional({ enum: TEAM, default: UserRole.MANAGER })
  @IsOptional()
  @IsIn(TEAM, { message: 'Rôle d\'équipe invalide.' })
  role?: UserRole;
}

/** Changement de rôle par l'administrateur (jamais vers administrateur). */
export class SetRoleDto {
  @ApiProperty({ enum: [UserRole.CLIENT, UserRole.DRIVER, ...TEAM] })
  @IsIn([UserRole.CLIENT, UserRole.DRIVER, ...TEAM], { message: 'Rôle invalide.' })
  role!: UserRole;
}
